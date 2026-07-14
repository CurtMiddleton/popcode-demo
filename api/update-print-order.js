// POST /api/update-print-order — admin-only edits to a print order.
//
// Two actions (Basho-style order editor):
//   action:'save'      → update status / tracking_url / admin_notes
//   action:'preflight' → server-side fetch each asset URL and report whether
//                        Prodigi will be able to download it (status + size)
//
// Resubmitting to Prodigi lives in api/retry-print-order.js. This endpoint never
// touches Prodigi — it only edits our own row or checks asset reachability.
//
// Auth: Authorization: Bearer <supabase token>; caller must be the admin.
//
// Env: SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from '@supabase/supabase-js';
import { Sentry } from './_sentry.js';

const SUPABASE_URL = 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd3BraHNsdXpva3l0cHZtd3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA2MDksImV4cCI6MjA5MTE2NjYwOX0.YMfuRpKvcmfoJ75Gxhf7ekoCaeDfR0Dsz_9Beg5ULAI';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = 'curtmid@gmail.com';

const ALLOWED_STATUS = new Set([
  'pending', 'paid', 'submitting', 'submitted', 'in_production',
  'shipped', 'complete', 'prodigi_failed', 'payment_failed', 'cancelled',
]);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (!SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'Backend not configured' });

  try {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid token' });
    if ((user.email || '').toLowerCase() !== ADMIN_EMAIL) return res.status(403).json({ error: 'Admins only' });

    const { orderId, action } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: order, error: loadErr } = await admin
      .from('print_orders').select('*').eq('id', orderId).single();
    if (loadErr || !order) return res.status(404).json({ error: 'Order not found' });

    // ── Preflight: can Prodigi fetch every asset? ──────────────────────────
    if (action === 'preflight') {
      const assets = Array.isArray(order.asset_urls) ? order.asset_urls : [];
      if (!assets.length) return res.status(200).json({ ok: false, results: [], message: 'No assets on this order' });
      const results = [];
      for (const a of assets) {
        const url = typeof a === 'string' ? a : a && a.url;
        if (!url) { results.push({ url: null, ok: false, error: 'missing url' }); continue; }
        try {
          let r = await fetch(url, { method: 'HEAD' });
          // Some hosts don't allow HEAD — fall back to a ranged GET.
          if (!r.ok) r = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
          results.push({
            url,
            ok: r.ok,
            status: r.status,
            contentLength: r.headers.get('content-length') || null,
            contentType: r.headers.get('content-type') || null,
          });
        } catch (e) {
          results.push({ url, ok: false, error: e.message });
        }
      }
      return res.status(200).json({ ok: results.every(r => r.ok), results });
    }

    // ── Save: status / tracking_url / admin_notes ──────────────────────────
    const { status, tracking_url, admin_notes } = req.body || {};
    const patch = { updated_at: new Date().toISOString() };
    if (status !== undefined) {
      if (!ALLOWED_STATUS.has(status)) return res.status(400).json({ error: 'Invalid status' });
      patch.status = status;
    }
    if (tracking_url !== undefined) patch.tracking_url = (tracking_url || '').trim() || null;
    if (admin_notes !== undefined) patch.admin_notes = (admin_notes || '').trim() || null;

    const { data: updated, error: updErr } = await admin
      .from('print_orders').update(patch).eq('id', orderId)
      .select('id, status, tracking_url, admin_notes').single();
    if (updErr) throw updErr;

    return res.status(200).json({ ok: true, order: updated });
  } catch (e) {
    console.error('update-print-order error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    return res.status(500).json({ error: e.message });
  }
}
