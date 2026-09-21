// POST /api/prodigi-callback — Prodigi tells us an order moved.
//
// Prodigi sends a CloudEvent when an order's stage changes or a shipment is
// made. Before this existed, `status` was written at checkout and never again
// and `tracking_url` was only ever typed by hand, so every customer's order
// read "Submitted" forever.
//
// SECURITY: Prodigi documents no signature on these callbacks, so the endpoint
// is public and anyone can post to it. The body is therefore treated as a HINT
// ONLY — all it supplies is an order id. Every field we store is read back from
// `GET /v4.0/orders/{id}` with our own API key, which is what makes the write
// safe: an attacker can at most make us re-check an order we already own, and
// a forged payload changes nothing.
//
// Always answers 200. A non-2xx makes Prodigi retry, and retrying will not fix
// a bad row or a missing env var — it just buries the real error under a
// retry storm. Failures go to Sentry instead.
//
// Env: SUPABASE_SERVICE_ROLE_KEY, PRODIGI_API_KEY, PRODIGI_BASE_URL.

import { createClient } from '@supabase/supabase-js';
import { Sentry } from './_sentry.js';

const SUPABASE_URL = 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // `ok:true` on every path below: see the header note on retries.
  const done = (detail) => res.status(200).json({ ok: true, ...detail });

  try {
    const { orderIdFromEvent, buildOrderPatch, shouldAdvance } =
      await import('../lib/print/order-status.mjs');

    const prodigiOrderId = orderIdFromEvent(req.body);
    if (!prodigiOrderId) return done({ ignored: 'no order id in event' });

    if (!SUPABASE_SERVICE_KEY) {
      Sentry.captureException(new Error('prodigi-callback: SUPABASE_SERVICE_ROLE_KEY missing'));
      await Sentry.flush(2000);
      return done({ ignored: 'not configured' });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    /* Find our row FIRST. An event for an id we never placed is not an error —
       the same Prodigi account could be used elsewhere, and a stranger can post
       anything here — so it is ignored without ever calling Prodigi. */
    const { data: row, error: findErr } = await admin
      .from('print_orders')
      .select('id, status, prodigi_order_id')
      .eq('prodigi_order_id', prodigiOrderId)
      .maybeSingle();

    if (findErr) throw findErr;
    if (!row) return done({ ignored: 'unknown order' });

    const { fetchProdigiOrder } = await import('../lib/print/providers/prodigi.mjs');
    const fetched = await fetchProdigiOrder(prodigiOrderId);
    if (!fetched.ok) {
      // Prodigi unreachable or the key is wrong. Nothing to store; the next
      // event or a manual sync picks it up.
      Sentry.captureException(new Error(`prodigi-callback: fetch failed for ${prodigiOrderId}: ${fetched.error}`));
      await Sentry.flush(2000);
      return done({ ignored: 'could not verify with Prodigi' });
    }

    /* Cross-check that Prodigi's own record points back at this row. It is the
       reason an order id alone is enough to act on: we are reading our own
       merchantReference out of their copy, not believing the caller's. */
    const ref = fetched.order?.merchantReference;
    if (ref && ref !== row.id) {
      Sentry.captureException(new Error(
        `prodigi-callback: ${prodigiOrderId} references ${ref}, expected ${row.id}`));
      await Sentry.flush(2000);
      return done({ ignored: 'merchant reference mismatch' });
    }

    const patch = buildOrderPatch(fetched.order);

    /* Never walk an order backwards. Callbacks can arrive late or out of order,
       and a stale "in production" landing after "shipped" would un-ship a
       parcel the customer can already track. Terminal states are left alone by
       the same argument, except that Prodigi may legitimately cancel. */
    if (!shouldAdvance(row.status, patch.status)) {
      delete patch.status;
    }

    const { error: upErr } = await admin
      .from('print_orders')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (upErr) throw upErr;

    return done({
      order: row.id,
      status: patch.status || row.status,
      shipments: patch.shipments.length,
    });
  } catch (err) {
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return done({ ignored: 'error', message: String(err && err.message || err) });
  }
}

