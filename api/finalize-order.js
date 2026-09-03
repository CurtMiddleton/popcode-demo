// POST /api/finalize-order — finalize a paid print order from the success page,
// independent of the Stripe webhook (Stripe's recommended belt-and-suspenders:
// fulfill on the success redirect AND the webhook; whichever runs first wins,
// the other is a no-op via the idempotency guard).
//
// Auth: Authorization: Bearer <supabase access token>.
// Body: { sessionId }   (the Stripe Checkout session id from ?session_id=)
// 200  { status, prodigi_order_id }
//
// Verifies the session is paid (server-side via Stripe), loads EVERY print_orders
// row for that session (a cart checkout makes one per fulfillment provider),
// checks ownership, then submits each to its provider (or dry-run) and advances
// status. Safe to call repeatedly.
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
    const { loadOrdersForSession, fulfillSession } = await import('../lib/print/fulfill.mjs');

    // A cart checkout produces one row per fulfillment provider, all sharing this
    // session id — finalize every one of them, not just the first.
    const orders = await loadOrdersForSession(admin, sessionId, session.metadata?.print_order_id || null);
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    if (orders.some((o) => o.user_id !== user.id)) return res.status(403).json({ error: 'Not your order' });

    if (session.payment_status !== 'paid') {
      return res.status(200).json({ status: orders[0].status, note: 'not paid yet' });
    }

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

    // Single-order sessions keep the original flat response shape so
    // order-success.html's existing handling is unchanged.
    const first = results[0] || {};
    return res.status(200).json({
      status: first.status,
      prodigi_order_id: first.prodigi_order_id,
      ...(first.idempotent ? { idempotent: true } : {}),
      ...(first.dryRun ? { dryRun: true } : {}),
      orders: results,
    });
  } catch (e) {
    console.error('finalize-order error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    res.status(500).json({ error: e.message });
  }
}
