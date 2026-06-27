// POST /api/finalize-order — finalize a paid print order from the success page,
// independent of the Stripe webhook (Stripe's recommended belt-and-suspenders:
// fulfill on the success redirect AND the webhook; whichever runs first wins,
// the other is a no-op via the idempotency guard).
//
// Auth: Authorization: Bearer <supabase access token>.
// Body: { sessionId }   (the Stripe Checkout session id from ?session_id=)
// 200  { status, prodigi_order_id }
//
// Verifies the session is paid (server-side via Stripe), loads the matching
// print_orders row, checks ownership, then submits to Prodigi (or dry-run) and
// advances status. Safe to call repeatedly.
//
// Env: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, PRODIGI_API_KEY,
//      PRODIGI_BASE_URL, PRODIGI_DRY_RUN.

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Sentry } from './_sentry.js';

const SUPABASE_URL = 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd3BraHNsdXpva3l0cHZtd3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA2MDksImV4cCI6MjA5MTE2NjYwOX0.YMfuRpKvcmfoJ75Gxhf7ekoCaeDfR0Dsz_9Beg5ULAI';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PRODIGI_BASE_URL = (process.env.PRODIGI_BASE_URL || 'https://api.sandbox.prodigi.com').trim().replace(/\/+$/, '');
const PRODIGI_API_KEY = (process.env.PRODIGI_API_KEY || '').trim();
const PRODIGI_DRY_RUN = (process.env.PRODIGI_DRY_RUN || '').trim().toLowerCase() === 'true';

const ALREADY_HANDLED = new Set(['submitted', 'in_production', 'shipped', 'complete', 'prodigi_failed']);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (!SUPABASE_SERVICE_KEY || !STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Finalize backend not configured' });
  }

  try {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid token' });

    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: order, error: loadErr } = await admin
      .from('print_orders').select('*').eq('stripe_session_id', sessionId).single();
    if (loadErr || !order) return res.status(404).json({ error: 'Order not found' });
    if (order.user_id !== user.id) return res.status(403).json({ error: 'Not your order' });

    // Idempotent: already submitted/handled.
    if (order.prodigi_order_id || ALREADY_HANDLED.has(order.status)) {
      return res.status(200).json({ status: order.status, prodigi_order_id: order.prodigi_order_id });
    }

    if (session.payment_status !== 'paid') {
      return res.status(200).json({ status: order.status, note: 'not paid yet' });
    }

    // Mark paid + reconcile charged amount.
    await admin.from('print_orders')
      .update({ status: 'paid', total_charged_minor: session.amount_total, updated_at: new Date().toISOString() })
      .eq('id', order.id);

    const { buildProdigiItems, cleanRecipient } = await import('../lib/print/catalog.mjs');
    const variant = { sku: order.sku, sizing: order.sizing || 'fillPrintArea', attributes: order.attributes || {}, printArea: 'default' };
    const items = buildProdigiItems({ variant, copies: order.copies, assetUrls: order.asset_urls || [] });
    const orderBody = {
      merchantReference: order.id,
      shippingMethod: order.shipping_method || 'Standard',
      recipient: cleanRecipient(order.recipient),
      items,
    };

    // Dry-run: prove the chain without placing a real (live) Prodigi order.
    if (PRODIGI_DRY_RUN) {
      await admin.from('print_orders')
        .update({
          status: 'submitted',
          prodigi_order_id: `DRYRUN-${order.id}`,
          prodigi_response: { dryRun: true, wouldSend: orderBody },
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);
      return res.status(200).json({ status: 'submitted', prodigi_order_id: `DRYRUN-${order.id}`, dryRun: true });
    }

    let prodigiResp, prodigiData;
    try {
      prodigiResp = await fetch(`${PRODIGI_BASE_URL}/v4.0/orders`, {
        method: 'POST',
        headers: { 'X-API-Key': PRODIGI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(orderBody),
      });
      prodigiData = await prodigiResp.json().catch(() => ({}));
    } catch (netErr) {
      await admin.from('print_orders').update({ status: 'prodigi_failed', prodigi_response: { error: netErr.message }, updated_at: new Date().toISOString() }).eq('id', order.id);
      Sentry.captureException(netErr);
      await Sentry.flush(2000);
      return res.status(200).json({ status: 'prodigi_failed' });
    }

    if (!prodigiResp.ok) {
      await admin.from('print_orders').update({ status: 'prodigi_failed', prodigi_response: prodigiData, updated_at: new Date().toISOString() }).eq('id', order.id);
      console.error(`Prodigi order failed (${prodigiResp.status}) for ${order.id}`, JSON.stringify(prodigiData).slice(0, 500));
      Sentry.captureException(new Error(`Prodigi order failed (${prodigiResp.status}) for ${order.id}`));
      await Sentry.flush(2000);
      return res.status(200).json({ status: 'prodigi_failed' });
    }

    const prodigiOrderId = prodigiData?.order?.id || prodigiData?.id || null;
    await admin.from('print_orders')
      .update({ status: 'submitted', prodigi_order_id: prodigiOrderId, prodigi_response: prodigiData, updated_at: new Date().toISOString() })
      .eq('id', order.id);

    return res.status(200).json({ status: 'submitted', prodigi_order_id: prodigiOrderId });
  } catch (e) {
    console.error('finalize-order error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    res.status(500).json({ error: e.message });
  }
}
