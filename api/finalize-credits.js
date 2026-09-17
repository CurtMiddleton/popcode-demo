// POST /api/finalize-credits — add a paid pack's credits to the buyer's account.
//
// Auth: Authorization: Bearer <supabase access token>.
// Body: { sessionId }   (the Stripe Checkout session id from ?credits_session=)
// 200  { status, credits, allowance }
//
// Called by the pricing page on its way back from Stripe. Verifies the session
// is paid server-side, then claims the order atomically before granting: the
// success page and (later) a webhook can both arrive, and only the one that
// wins the claim adds credits. Safe to call repeatedly.
//
// Env: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY.

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

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: orders, error: loadError } = await admin
      .from('credit_orders').select('*').eq('stripe_session_id', sessionId);
    if (loadError) throw loadError;
    if (!orders || !orders.length) return res.status(404).json({ error: 'Unknown session' });

    const order = orders[0];
    if (order.user_id !== user.id) return res.status(403).json({ error: 'Not your order' });
    if (order.status === 'granted') {
      return res.status(200).json({ status: 'granted', credits: order.credits, already: true });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(200).json({ status: order.status, note: 'not paid yet' });
    }

    // Atomic claim. Without it the success page and a webhook could both read
    // 'pending' and both add the credits — the same double-submit that print
    // orders guard against.
    const { data: claimed, error: claimError } = await admin
      .from('credit_orders')
      .update({ status: 'granting', updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .eq('status', 'pending')
      .select();
    if (claimError) throw claimError;
    if (!claimed || !claimed.length) {
      // Someone else is mid-grant, or it is already done. Report current state.
      const { data: now } = await admin
        .from('credit_orders').select('status, credits').eq('id', order.id).single();
      return res.status(200).json({ status: now?.status || 'granting', credits: now?.credits });
    }

    // Read-modify-write rather than an increment expression, because PostgREST
    // has no atomic add. The claim above is what makes this safe: only one
    // caller ever reaches here for a given order.
    const { data: existing } = await admin
      .from('popcode_credits').select('purchased, granted').eq('user_id', user.id).maybeSingle();
    const purchased = (existing?.purchased || 0) + order.credits;
    const { error: upsertError } = await admin
      .from('popcode_credits')
      .upsert({ user_id: user.id, purchased, updated_at: new Date().toISOString() },
              { onConflict: 'user_id' });
    if (upsertError) {
      // Put it back so the next call can retry rather than stranding the claim.
      await admin.from('credit_orders')
        .update({ status: 'pending', updated_at: new Date().toISOString() }).eq('id', order.id);
      throw upsertError;
    }

    await admin.from('credit_orders')
      .update({ status: 'granted', updated_at: new Date().toISOString() }).eq('id', order.id);

    res.status(200).json({
      status: 'granted',
      credits: order.credits,
      purchased,
      allowance: 5 + purchased + (existing?.granted || 0),
    });
  } catch (e) {
    Sentry.captureException(e);
    await Sentry.flush(2000);
    res.status(500).json({ error: e.message || 'Could not finalize' });
  }
}
