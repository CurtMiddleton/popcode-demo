// POST /api/stripe-webhook — Stripe -> us. On checkout.session.completed, submit
// every paid order for that session to its fulfillment provider and advance status.
// (A cart checkout produces one order row per provider.)
//
// Signature verification needs the RAW request body, so Vercel's JSON body parser
// is disabled below and we read the stream into a Buffer ourselves. This route is
// NOT CORS-enabled and only accepts POST.
//
// Idempotent: Stripe retries deliveries, so if the order already has a
// prodigi_order_id (or a terminal status) we 200 immediately and do nothing. Once
// payment is valid we always 200 — a Prodigi failure is recorded as
// `prodigi_failed` and retried out-of-band rather than via Stripe redelivery.
//
// Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY,
//      PRODIGI_API_KEY, PRODIGI_BASE_URL.

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Sentry } from './_sentry.js';

export const config = { api: { bodyParser: false } };

const SUPABASE_URL = 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);

  let event;
  try {
    const rawBody = await readRawBody(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    // Bad signature / unparseable — tell Stripe so it shows the error.
    console.error('stripe-webhook signature error:', e.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${e.message}` });
  }

  // Everything past signature verification must end in 200 (payment is real) unless
  // we hit an unexpected server error we want Stripe to retry.
  try {
    if (event.type !== 'checkout.session.completed') {
      return res.status(200).json({ received: true, ignored: event.type });
    }

    const session = event.data.object;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { loadOrdersForSession, fulfillSession } = await import('../lib/print/fulfill.mjs');

    // A cart checkout produces one print_orders row per fulfillment provider, all
    // sharing this session id. Look them up by session (works for the legacy
    // single-order case too) and fall back to the metadata id for a row whose
    // stripe_session_id write didn't land.
    const orders = await loadOrdersForSession(admin, session.id, session.metadata?.print_order_id || null);
    if (!orders.length) {
      console.error('stripe-webhook: no orders for session', session.id);
      return res.status(200).json({ received: true, note: 'order not found' });
    }

    if (session.payment_status !== 'paid') {
      await admin.from('print_orders')
        .update({ status: 'payment_failed', updated_at: new Date().toISOString() })
        .in('id', orders.map((o) => o.id))
        .in('status', ['pending']);
      return res.status(200).json({ received: true, note: 'not paid' });
    }

    // merchantReference = our order id makes a manual retry idempotent on the
    // vendor side too. Each row is claimed atomically inside fulfillSession, so
    // this route and the success page's /api/finalize-order can race safely.
    const results = await fulfillSession({
      admin,
      orders,
      amountTotalMinor: session.amount_total,
      onError: (err, result) => {
        console.error(err.message, JSON.stringify(result.response).slice(0, 500));
        Sentry.captureException(err);
      },
    });
    await Sentry.flush(2000);

    return res.status(200).json({ received: true, orders: results });
  } catch (e) {
    console.error('stripe-webhook handler error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    // Unexpected server error — let Stripe retry.
    return res.status(500).json({ error: e.message });
  }
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
