// POST /api/sync-print-order — pull an order's real state from Prodigi.
//
// The callback (api/prodigi-callback.js) is the live path. This is the one that
// makes it trustworthy, for two cases it cannot cover:
//
//   1. Orders placed BEFORE callbacks existed. They carry no callbackUrl, so
//      Prodigi will never tell us anything about them. Without this they sit on
//      "submitted" forever no matter what actually happened to them.
//   2. A callback that was missed — Prodigi retries, but a deploy window or a
//      bad minute is enough to lose one permanently, and nothing would notice.
//
// Body: { orderId }  — one order, or { all: true } to sweep every order that is
// still open. Uses exactly the same read and the same patch builder as the
// callback, so the two can never form different opinions about one order.
//
// Auth: Authorization: Bearer <supabase token>; caller must be the admin.
// Env: SUPABASE_SERVICE_ROLE_KEY, PRODIGI_API_KEY, PRODIGI_BASE_URL.

import { createClient } from '@supabase/supabase-js';
import { Sentry } from './_sentry.js';

const SUPABASE_URL = 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd3BraHNsdXpva3l0cHZtd3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA2MDksImV4cCI6MjA5MTE2NjYwOX0.YMfuRpKvcmfoJ75Gxhf7ekoCaeDfR0Dsz_9Beg5ULAI';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAILS = ['curtmid@gmail.com', 'curt@theworkshop.works'];

// Sweeping means one Prodigi call per order, so it is bounded.
const SWEEP_LIMIT = 50;

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
    if (!ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
      return res.status(403).json({ error: 'Admins only' });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
    const { orderId, all } = req.body || {};

    let rows;
    if (all) {
      /* Only orders Prodigi could still have news about. A complete or
         cancelled order will never change again, and re-reading every order
         ever placed would grow into a slow sweep for no information. */
      const { data, error } = await admin
        .from('print_orders')
        .select('id, status, prodigi_order_id, provider_status')
        .not('prodigi_order_id', 'is', null)
        .in('status', ['submitted', 'in_production', 'shipped'])
        .order('created_at', { ascending: false })
        .limit(SWEEP_LIMIT);
      if (error) throw error;
      rows = data || [];
    } else {
      if (!orderId) return res.status(400).json({ error: 'Missing orderId' });
      const { data, error } = await admin
        .from('print_orders')
        .select('id, status, prodigi_order_id, provider_status')
        .eq('id', orderId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Order not found' });
      if (!data.prodigi_order_id) {
        return res.status(400).json({ error: 'Order was never submitted to Prodigi' });
      }
      rows = [data];
    }

    const { fetchProdigiOrder, baseUrl } = await import('../lib/print/providers/prodigi.mjs');
    const { buildOrderPatch, shouldAdvance } = await import('../lib/print/order-status.mjs');
    const where = baseUrl();

    const results = [];
    for (const row of rows) {
      // A dry-run order has no counterpart at Prodigi to read.
      if (String(row.prodigi_order_id).startsWith('DRYRUN-')) {
        results.push({ id: row.id, skipped: 'dry run' });
        continue;
      }

      /* Already established as absent from THIS Prodigi. Orders placed against
         the sandbox do not exist in live and never will, so without this every
         sync forever re-asks about them, burns a call each, and ends in a wall
         of identical 404s that mean nothing.

         Keyed on the base URL, not a bare flag: point the app back at the
         sandbox and these become findable again, so the note has to expire by
         itself rather than hide them permanently. */
      const gone = row.provider_status && row.provider_status.unreachable;
      if (gone && gone.base_url === where) {
        results.push({ id: row.id, skipped: 'not on this Prodigi environment' });
        continue;
      }

      const fetched = await fetchProdigiOrder(row.prodigi_order_id);
      if (!fetched.ok) {
        /* 404 is the provider saying this id does not exist here — permanent,
           unlike a 500 or a timeout, which are worth asking about again. */
        if (fetched.status === 404) {
          await admin.from('print_orders').update({
            provider_status: {
              ...(row.provider_status || {}),
              unreachable: { base_url: where, status: 404, at: new Date().toISOString() },
            },
            updated_at: new Date().toISOString(),
          }).eq('id', row.id);
          results.push({ id: row.id, error: fetched.error, permanent: true });
          continue;
        }
        results.push({ id: row.id, error: fetched.error });
        continue;
      }

      const patch = buildOrderPatch(fetched.order);
      const from = row.status;
      // Same monotonic rule as the callback — a sweep must not undo a state a
      // late callback or a manual edit already moved forward.
      if (!shouldAdvance(from, patch.status)) delete patch.status;

      const { error: upErr } = await admin
        .from('print_orders')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (upErr) { results.push({ id: row.id, error: upErr.message }); continue; }

      results.push({
        id: row.id,
        from,
        to: patch.status || from,
        changed: !!patch.status,
        shipments: patch.shipments.length,
        tracking: patch.tracking_url,
      });
    }

    return res.status(200).json({ ok: true, checked: results.length, results });
  } catch (err) {
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return res.status(500).json({ error: String(err && err.message || err) });
  }
}
