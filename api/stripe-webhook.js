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
const PRODIGI_BASE_URL = (process.env.PRODIGI_BASE_URL || 'https://api.sandbox.prodigi.com').trim().replace(/\/+$/, '');
const PRODIGI_API_KEY = (process.env.PRODIGI_API_KEY || '').trim();

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

    // Mark paid + reconcile the charged amount against Stripe.
    await admin.from('print_orders')
      .update({ status: 'paid', total_charged_minor: session.amount_total, updated_at: new Date().toISOString() })
      .eq('id', order.id);

    // Submit to Prodigi. merchantReference = our order id makes a manual retry
    // idempotent on Prodigi's side too.
    const { buildProdigiItems } = await import('../lib/print/catalog.mjs');
    const variant = {
      sku: order.sku,
      sizing: order.sizing || 'fillPrintArea',
      attributes: order.attributes || {},
      printArea: 'default',
    };
    const items = buildProdigiItems({ variant, copies: order.copies, assetUrls: order.asset_urls || [] });
    const orderBody = {
      merchantReference: order.id,
      shippingMethod: order.shipping_method || 'Standard',
      recipient: order.recipient,
      items,
    };

    let prodigiResp, prodigiData;
    try {
      prodigiResp = await fetch(`${PRODIGI_BASE_URL}/v4.0/orders`, {
        method: 'POST',
        headers: { 'X-API-Key': PRODIGI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(orderBody),
      });
      prodigiData = await prodigiResp.json().catch(() => ({}));
    } catch (netErr) {
      await markProdigiFailed(admin, order.id, { error: netErr.message });
      Sentry.captureException(netErr);
      await Sentry.flush(2000);
      return res.status(200).json({ received: true, prodigi: 'network_error' });
    }

    if (!prodigiResp.ok) {
      await markProdigiFailed(admin, order.id, prodigiData);
      const err = new Error(`Prodigi order failed (${prodigiResp.status}) for ${order.id}`);
      console.error(err.message, JSON.stringify(prodigiData).slice(0, 500));
      Sentry.captureException(err);
      await Sentry.flush(2000);
      return res.status(200).json({ received: true, prodigi: 'rejected' });
    }

    const prodigiOrderId = prodigiData?.order?.id || prodigiData?.id || null;
    await admin.from('print_orders')
      .update({
        status: 'submitted',
        prodigi_order_id: prodigiOrderId,
        prodigi_response: prodigiData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    return res.status(200).json({ received: true, prodigi_order_id: prodigiOrderId });
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
