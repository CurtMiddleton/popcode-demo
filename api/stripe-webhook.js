// POST /api/stripe-webhook — Stripe -> us. On checkout.session.completed, submit
// the paid order to Prodigi and advance its status.
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

// Terminal/in-flight statuses we must not re-submit on a webhook retry.
const ALREADY_HANDLED = new Set(['submitted', 'in_production', 'shipped', 'complete', 'prodigi_failed']);

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
    const printOrderId = session.metadata?.print_order_id;
    if (!printOrderId) return res.status(200).json({ received: true, note: 'no print_order_id' });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: order, error: loadErr } = await admin
      .from('print_orders').select('*').eq('id', printOrderId).single();
    if (loadErr || !order) {
      console.error('stripe-webhook: order not found', printOrderId);
      return res.status(200).json({ received: true, note: 'order not found' });
    }

    // Idempotency: already submitted / handled -> noop.
    if (order.prodigi_order_id || ALREADY_HANDLED.has(order.status)) {
      return res.status(200).json({ received: true, idempotent: true });
    }

    if (session.payment_status !== 'paid') {
      await admin.from('print_orders')
        .update({ status: 'payment_failed', updated_at: new Date().toISOString() })
        .eq('id', order.id);
      return res.status(200).json({ received: true, note: 'not paid' });
    }

    // Atomically claim this order for submission. This route and the success-page
    // /api/finalize-order can fire at the same time and both clear the idempotency
    // check above before either writes prodigi_order_id — without a claim that
    // races into TWO Prodigi orders (double print + double charge;
    // merchantReference is NOT a Prodigi-side uniqueness guarantee). Only the
    // caller that flips pending/paid -> submitting proceeds.
    const { data: claimed } = await admin.from('print_orders')
      .update({ status: 'submitting', total_charged_minor: session.amount_total, updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .is('prodigi_order_id', null)
      .in('status', ['pending', 'paid'])
      .select();
    if (!claimed || claimed.length === 0) {
      return res.status(200).json({ received: true, idempotent: true });
    }

    // Submit via the order's fulfillment provider (defaults to Prodigi for rows
    // written before the provider column). merchantReference = our order id makes a
    // manual retry idempotent on the vendor side too. The adapter builds the vendor
    // payload + honors its own dry-run; DB writes stay here.
    const { getProvider } = await import('../lib/print/providers/index.mjs');
    const provider = getProvider(order.provider || 'prodigi');
    const result = await provider.submitOrder({ order });

    if (result.dryRun) {
      await admin.from('print_orders')
        .update({ status: 'submitted', prodigi_order_id: result.providerOrderId, prodigi_response: result.response, updated_at: new Date().toISOString() })
        .eq('id', order.id);
      return res.status(200).json({ received: true, dryRun: true });
    }

    if (!result.ok) {
      await markProdigiFailed(admin, order.id, result.response);
      const err = new Error(result.error || `Order submission failed for ${order.id}`);
      console.error(err.message, JSON.stringify(result.response).slice(0, 500));
      Sentry.captureException(err);
      await Sentry.flush(2000);
      return res.status(200).json({ received: true, prodigi: result.networkError ? 'network_error' : 'rejected' });
    }

    await admin.from('print_orders')
      .update({ status: 'submitted', prodigi_order_id: result.providerOrderId, prodigi_response: result.response, updated_at: new Date().toISOString() })
      .eq('id', order.id);

    return res.status(200).json({ received: true, prodigi_order_id: result.providerOrderId });
  } catch (e) {
    console.error('stripe-webhook handler error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    // Unexpected server error — let Stripe retry.
    return res.status(500).json({ error: e.message });
  }
}

async function markProdigiFailed(admin, id, response) {
  await admin.from('print_orders')
    .update({ status: 'prodigi_failed', prodigi_response: response, updated_at: new Date().toISOString() })
    .eq('id', id);
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
