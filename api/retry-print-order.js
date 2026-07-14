// POST /api/retry-print-order — admin-only resubmit of a print order to Prodigi.
//
// finalize-order / stripe-webhook mark an order `prodigi_failed` and never retry
// it (terminal by design, so a genuine rejection doesn't loop). This endpoint is
// the manual escape hatch behind the analytics.html "Retry" button: once the
// underlying cause is fixed (e.g. a missing Prodigi card, a transient outage), an
// admin can push the same order to Prodigi again. Payment was already captured at
// checkout, so there is NO Stripe step here — it only re-submits the fulfillment.
//
// Auth: Authorization: Bearer <supabase access token>; the caller's email must be
//       the admin (same gate as analytics.html + the admin RPCs).
// Body: { orderId }
//
// Env: SUPABASE_SERVICE_ROLE_KEY, PRODIGI_API_KEY, PRODIGI_BASE_URL, PRODIGI_DRY_RUN.

import { createClient } from '@supabase/supabase-js';
import { Sentry } from './_sentry.js';

const SUPABASE_URL = 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd3BraHNsdXpva3l0cHZtd3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA2MDksImV4cCI6MjA5MTE2NjYwOX0.YMfuRpKvcmfoJ75Gxhf7ekoCaeDfR0Dsz_9Beg5ULAI';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRODIGI_BASE_URL = (process.env.PRODIGI_BASE_URL || 'https://api.sandbox.prodigi.com').trim().replace(/\/+$/, '');
const PRODIGI_API_KEY = (process.env.PRODIGI_API_KEY || '').trim();
const PRODIGI_DRY_RUN = (process.env.PRODIGI_DRY_RUN || '').trim().toLowerCase() === 'true';
const ADMIN_EMAIL = 'curtmid@gmail.com';

// Statuses we allow a manual resubmit from: a hard failure, a payment that never
// got submitted, or a claim that got stuck mid-submit (a crash after claiming).
const RETRYABLE = new Set(['prodigi_failed', 'paid', 'submitting']);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (!SUPABASE_SERVICE_KEY || !PRODIGI_API_KEY) {
    return res.status(500).json({ error: 'Print backend not configured' });
  }

  try {
    // 1. Authenticate + gate to admin.
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid token' });
    if ((user.email || '').toLowerCase() !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Admins only' });
    }

    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: order, error: loadErr } = await admin
      .from('print_orders')
      .select('*')
      .eq('id', orderId)
      .single();
    if (loadErr || !order) return res.status(404).json({ error: 'Order not found' });

    // Already fulfilled — nothing to do.
    if (order.prodigi_order_id) {
      return res.status(200).json({ status: order.status, prodigi_order_id: order.prodigi_order_id, alreadyDone: true });
    }
    if (!RETRYABLE.has(order.status)) {
      return res.status(409).json({ error: `Order is '${order.status}', not retryable` });
    }

    // Atomic claim so a concurrent finalize/webhook can't double-submit.
    const { data: claimed } = await admin
      .from('print_orders')
      .update({ status: 'submitting', updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .is('prodigi_order_id', null)
      .in('status', ['prodigi_failed', 'paid', 'submitting'])
      .select('id');
    if (!claimed || !claimed.length) {
      const { data: cur } = await admin.from('print_orders').select('status, prodigi_order_id').eq('id', order.id).single();
      return res.status(200).json({ status: cur?.status, prodigi_order_id: cur?.prodigi_order_id, idempotent: true });
    }

    // 2. Rebuild the Prodigi order body from the stored row (same as finalize-order).
    const { buildProdigiItems, cleanRecipient } = await import('../lib/print/catalog.mjs');
    const variant = { sku: order.sku, sizing: order.sizing || 'fillPrintArea', attributes: order.attributes || {}, printArea: 'default' };
    const items = buildProdigiItems({ variant, copies: order.copies, assetUrls: order.asset_urls || [] });
    const orderBody = {
      merchantReference: order.id,
      shippingMethod: order.shipping_method || 'Standard',
      recipient: cleanRecipient(order.recipient),
      items,
    };

    if (PRODIGI_DRY_RUN) {
      await admin.from('print_orders')
        .update({ status: 'submitted', prodigi_order_id: `DRYRUN-${order.id}`, prodigi_response: { dryRun: true, wouldSend: orderBody }, updated_at: new Date().toISOString() })
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
      return res.status(200).json({ status: 'prodigi_failed', error: netErr.message });
    }

    if (!prodigiResp.ok) {
      await admin.from('print_orders').update({ status: 'prodigi_failed', prodigi_response: prodigiData, updated_at: new Date().toISOString() }).eq('id', order.id);
      console.error(`Prodigi retry failed (${prodigiResp.status}) for ${order.id}`, JSON.stringify(prodigiData).slice(0, 500));
      return res.status(200).json({ status: 'prodigi_failed', prodigi: prodigiData });
    }

    const prodigiOrderId = prodigiData?.order?.id || prodigiData?.id || null;
    await admin.from('print_orders')
      .update({ status: 'submitted', prodigi_order_id: prodigiOrderId, prodigi_response: prodigiData, updated_at: new Date().toISOString() })
      .eq('id', order.id);
    return res.status(200).json({ status: 'submitted', prodigi_order_id: prodigiOrderId });
  } catch (e) {
    console.error('retry-print-order error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    return res.status(500).json({ error: e.message });
  }
}
