// POST /api/create-checkout — validate an order, re-quote Prodigi, create a
// pending print_orders row, and open a Stripe Checkout Session.
//
// Auth: Authorization: Bearer <supabase access token> (same pattern as
//       api/delete-account.js). Returns { url } — client does window.location = url.
//
// Body: {
//   collectionId, productType, variantId, copies, shippingMethod,
//   recipient: { name, email, address:{ line1,line2,townOrCity,stateOrCounty,postalOrZipCode,countryCode } },
//   assetUrls: [{ target_index, print_area, url }]   // already uploaded to the public print-assets bucket
// }
//
// The client's displayed price is NOT trusted: we re-quote Prodigi server-side
// for the real destination and charge that × markup. The SKU is validated against
// the catalog, the collection ownership is verified, and every asset URL must live
// under this Supabase project's public print-assets prefix.
//
// Env: PRODIGI_API_KEY, PRODIGI_BASE_URL, PRINT_MARKUP_MULTIPLIER,
//      STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, (optional) PUBLIC_BASE_URL.

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Sentry } from './_sentry.js';

const SUPABASE_URL = 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd3BraHNsdXpva3l0cHZtd3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA2MDksImV4cCI6MjA5MTE2NjYwOX0.YMfuRpKvcmfoJ75Gxhf7ekoCaeDfR0Dsz_9Beg5ULAI';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PRODIGI_BASE_URL = (process.env.PRODIGI_BASE_URL || 'https://api.sandbox.prodigi.com').trim().replace(/\/+$/, '');
const PRODIGI_API_KEY = (process.env.PRODIGI_API_KEY || '').trim();
const MARKUP = Number(process.env.PRINT_MARKUP_MULTIPLIER || 1.4);

// Composited print images are uploaded to the existing public `experiences`
// bucket (reuses its owner-write policy). Only accept asset URLs under it.
const PUBLIC_ASSET_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/experiences/`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (!SUPABASE_SERVICE_KEY || !STRIPE_SECRET_KEY || !PRODIGI_API_KEY) {
    return res.status(500).json({ error: 'Checkout backend not configured' });
  }

  try {
    // 1. Authenticate the buyer.
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid token' });

    // 2. Validate the request shape against the catalog.
    const { collectionId, productType, variantId, copies, shippingMethod, recipient, assetUrls } = req.body || {};
    const { findVariant, buildProdigiItems, priceFromQuote, sumQuoteMinor } = await import('../lib/print/catalog.mjs');
    const variant = findVariant(productType, variantId);
    if (!variant) return res.status(400).json({ error: 'Unknown product' });

    if (!recipient?.name || !recipient?.email || !recipient?.address?.line1 ||
        !recipient?.address?.townOrCity || !recipient?.address?.postalOrZipCode ||
        !recipient?.address?.countryCode) {
      return res.status(400).json({ error: 'Incomplete shipping address' });
    }

    if (!Array.isArray(assetUrls) || !assetUrls.length) {
      return res.status(400).json({ error: 'No print assets provided' });
    }
    for (const a of assetUrls) {
      if (!a?.url || typeof a.url !== 'string' || !a.url.startsWith(PUBLIC_ASSET_PREFIX)) {
        return res.status(400).json({ error: 'Invalid asset URL' });
      }
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 3. Verify the buyer owns the project being printed.
    const { data: collection, error: colErr } = await admin
      .from('collections')
      .select('id, user_id, name, slug')
      .eq('id', collectionId)
      .single();
    if (colErr || !collection) return res.status(404).json({ error: 'Project not found' });
    if (collection.user_id !== user.id) return res.status(403).json({ error: 'Not your project' });

    // 4. Authoritative re-quote (never trust the client's displayed price).
    const items = buildProdigiItems({ variant, copies, forQuote: true });
    // Retry transient empty quotes so a Prodigi blip can't fail a paid checkout.
    let summed = null;
    for (let attempt = 0; attempt < 3 && !summed; attempt++) {
      try {
        const quote = await prodigiQuote({ shippingMethod, destinationCountryCode: recipient.address.countryCode, items });
        summed = sumQuoteMinor(quote);
      } catch (err) { if (attempt === 2) throw err; }
    }
    if (!summed) return res.status(502).json({ error: 'Could not price this order' });
    const totalMinor = priceFromQuote(summed.totalMinor, MARKUP);

    // 5. Persist a pending order. (service role bypasses RLS)
    const copiesInt = Math.max(1, parseInt(copies, 10) || 1);
    const { data: order, error: insErr } = await admin
      .from('print_orders')
      .insert({
        user_id: user.id,
        collection_id: collection.id,
        status: 'pending',
        product_type: productType,
        sku: variant.sku,
        copies: copiesInt,
        sizing: variant.sizing || 'fillPrintArea',
        attributes: variant.attributes || {},
        asset_urls: assetUrls,
        recipient,
        shipping_method: shippingMethod || 'Standard',
        currency: summed.currency,
        quote_cost_minor: summed.totalMinor,
        markup: MARKUP,
        total_charged_minor: totalMinor,
      })
      .select('id')
      .single();
    if (insErr || !order) throw insErr || new Error('Could not create order');

    // 6. Stripe Checkout Session.
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const base = process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: recipient.email,
      client_reference_id: order.id,
      metadata: { print_order_id: order.id },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: summed.currency.toLowerCase(),
          unit_amount: totalMinor,
          product_data: {
            name: `${variant.label} — ${collection.name || 'Popcode print'}`,
            description: `Quantity: ${copiesInt}`,
          },
        },
      }],
      success_url: `${base}/order-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/order.html?id=${encodeURIComponent(collection.slug)}&cancelled=1`,
    });

    await admin.from('print_orders').update({ stripe_session_id: session.id, updated_at: new Date().toISOString() }).eq('id', order.id);

    res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('create-checkout error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    res.status(500).json({ error: e.message });
  }
}

async function prodigiQuote({ shippingMethod, destinationCountryCode, items }) {
  const resp = await fetch(`${PRODIGI_BASE_URL}/v4.0/quotes`, {
    method: 'POST',
    headers: { 'X-API-Key': PRODIGI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ shippingMethod: shippingMethod || 'Standard', destinationCountryCode, items }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Prodigi quote failed (${resp.status}): ${text.slice(0, 300)}`);
  }
  return resp.json();
}
