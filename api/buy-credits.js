// POST /api/buy-credits — open a Stripe Checkout Session for a Popcode pack.
//
// Auth: Authorization: Bearer <supabase access token> (same pattern as
//       api/create-checkout.js). Returns { url } — client does window.location = url.
// Body: { packId }            'pack25' | 'pack100'
//
// The client sends a pack id and nothing else: credits and price come from
// lib/credits/packs.mjs, so a tampered request can only buy a real pack at its
// real price. A pending credit_orders row is written before the session so the
// purchase is recoverable if the browser never comes back.
//
// Env: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, (optional) PUBLIC_BASE_URL.

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
    return res.status(500).json({ error: 'Checkout backend not configured' });
  }

  try {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid token' });

    // Vercel bundles api/*.js as CommonJS, so a static import of a local .mjs
    // becomes a require() of an ES module and throws ERR_REQUIRE_ESM. Dynamic
    // import is the documented way round it (see api/identify.js).
    const { findPack } = await import('../lib/credits/packs.mjs');
    const pack = findPack((req.body || {}).packId);
    if (!pack) return res.status(400).json({ error: 'Unknown pack' });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: order, error: insertError } = await admin
      .from('credit_orders')
      .insert({
        user_id: user.id,
        pack_id: pack.id,
        credits: pack.credits,
        amount_minor: pack.amountMinor,
        currency: pack.currency,
        status: 'pending',
      })
      .select()
      .single();
    if (insertError || !order) {
      throw new Error('Could not open the order: ' + (insertError?.message || 'no row'));
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const base = process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      allow_promotion_codes: true,
      customer_email: user.email || undefined,
      client_reference_id: order.id,
      metadata: { credit_order_id: order.id, pack_id: pack.id, credits: String(pack.credits) },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: pack.currency,
          unit_amount: pack.amountMinor,
          product_data: {
            name: pack.label,
            description: `${pack.credits} Popcodes, yours to use whenever. Five years of hosting on each.`,
          },
        },
      }],
      // Back to the pricing page, which finalizes and says what landed.
      success_url: `${base}/pricing.html?credits_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing.html`,
    });

    await admin.from('credit_orders')
      .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
      .eq('id', order.id);

    res.status(200).json({ url: session.url, credit_order_id: order.id });
  } catch (e) {
    Sentry.captureException(e);
    await Sentry.flush(2000);
    res.status(500).json({ error: e.message || 'Could not start checkout' });
  }
}
