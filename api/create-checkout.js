// POST /api/create-checkout — validate an order, re-quote the print provider,
// create the pending print_orders row(s), and open a Stripe Checkout Session.
//
// Auth: Authorization: Bearer <supabase access token> (same pattern as
//       api/delete-account.js). Returns { url } — client does window.location = url.
//
// Two body shapes, one pipeline:
//
//   CART      { items: [{ collectionId, productType, variantId, copies,
//                         assetUrls, pageCount, title }], recipient, shippingMethod }
//   SINGLE    { collectionId, productType, variantId, copies, assetUrls,
//               pageCount, recipient, shippingMethod }        (legacy "buy it now")
//
// The single shape is normalized into a one-line cart, so the makers' existing
// buy-now buttons keep working untouched.
//
// Lines are grouped by fulfillment provider — each group becomes ONE provider
// order (one shipment, one shipping charge) and ONE print_orders row, and all
// rows from a checkout share an order_group_id.
//
// The client's displayed price is NOT trusted: every group is re-quoted
// server-side for the real destination and charged at that × markup. Every SKU is
// validated against the catalog, collection ownership is verified, and every
// asset URL must live under this Supabase project's public storage prefix.
//
// Env: PRODIGI_API_KEY, PRODIGI_BASE_URL, PRINT_MARKUP_MULTIPLIER,
//      STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, (optional) PUBLIC_BASE_URL.

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import { Sentry } from './_sentry.js';

const SUPABASE_URL = 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd3BraHNsdXpva3l0cHZtd3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA2MDksImV4cCI6MjA5MTE2NjYwOX0.YMfuRpKvcmfoJ75Gxhf7ekoCaeDfR0Dsz_9Beg5ULAI';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
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

  if (!SUPABASE_SERVICE_KEY || !STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Checkout backend not configured' });
  }

  try {
    // 1. Authenticate the buyer.
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid token' });

    const body = req.body || {};
    const { recipient, shippingMethod } = body;
    const isCart = Array.isArray(body.items) && body.items.length > 0;
    const rawLines = isCart ? body.items : [{
      collectionId: body.collectionId,
      productType: body.productType,
      variantId: body.variantId,
      copies: body.copies,
      assetUrls: body.assetUrls,
      pageCount: body.pageCount,
    }];

    if (!recipient?.name || !recipient?.email || !recipient?.address?.line1 ||
        !recipient?.address?.townOrCity || !recipient?.address?.postalOrZipCode ||
        !recipient?.address?.countryCode) {
      return res.status(400).json({ error: 'Incomplete shipping address' });
    }

    // 2. Validate every line against the catalog + our own storage prefix.
    const { normalizeLines, quoteCart, CartError } = await import('../lib/print/cart.mjs');
    let lines;
    try {
      lines = normalizeLines(rawLines, { requireAssets: true, assetPrefix: PUBLIC_ASSET_PREFIX });
    } catch (e) {
      if (e instanceof CartError) return res.status(e.status).json({ error: e.message });
      throw e;
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 3. Verify the buyer owns every project being printed.
    const collectionIds = [...new Set(lines.map((l) => l.collectionId).filter(Boolean))];
    if (!collectionIds.length) return res.status(400).json({ error: 'Nothing to order' });
    const { data: collections, error: colErr } = await admin
      .from('collections').select('id, user_id, name, slug').in('id', collectionIds);
    if (colErr) throw colErr;
    const byId = new Map((collections || []).map((c) => [c.id, c]));
    for (const id of collectionIds) {
      const c = byId.get(id);
      if (!c) return res.status(404).json({ error: 'Design not found' });
      if (c.user_id !== user.id) return res.status(403).json({ error: 'Not your design' });
    }

    // 4. Authoritative re-quote, per provider group (never trust the client price).
    const { getProvider } = await import('../lib/print/providers/index.mjs');
    let priced;
    try {
      priced = await quoteCart({
        lines,
        address: recipient.address,
        shippingMethod: shippingMethod || 'Standard',
        markup: MARKUP,
        getProvider,
      });
    } catch (e) {
      if (e instanceof CartError) {
        return res.status(e.status).json({ error: e.message, ...(e.unservable ? { unservable: true } : {}) });
      }
      throw e;
    }

    // 5. Persist one pending order per provider group. (service role bypasses RLS)
    const orderGroupId = randomUUID();
    const orderIds = [];
    for (const group of priced.groups) {
      const first = group.lines[0];
      const items = group.lines.map((l) => ({
        collection_id: l.collectionId,
        product_type: l.productType,
        variant_id: l.variantId,
        sku: l.variant.sku,
        copies: l.copies,
        sizing: l.variant.sizing || 'fillPrintArea',
        attributes: l.variant.attributes || {},
        print_area: l.variant.printArea || 'default',
        provider_meta: l.variant.printify || null,
        page_count: l.pageCount,
        asset_urls: l.assetUrls,
        title: l.title,
      }));
      const { data: order, error: insErr } = await admin
        .from('print_orders')
        .insert({
          user_id: user.id,
          // A group can span designs; the row's collection_id points at the first
          // (kept for the existing admin views), with the full mapping in `items`.
          collection_id: first.collectionId,
          order_group_id: orderGroupId,
          status: 'pending',
          product_type: first.productType,
          provider: group.provider,
          provider_meta: first.variant.printify || null,
          sku: first.variant.sku,
          copies: first.copies,
          sizing: first.variant.sizing || 'fillPrintArea',
          attributes: first.variant.attributes || {},
          // Legacy single-item readers (admin tools, retry-print-order) still see
          // the first line's assets here; `items` is the full truth.
          asset_urls: first.assetUrls,
          items,
          recipient,
          shipping_method: shippingMethod || 'Standard',
          currency: group.currency,
          quote_cost_minor: group.costMinor,
          markup: MARKUP,
          total_charged_minor: group.totalMinor,
        })
        .select('id')
        .single();
      if (insErr || !order) throw insErr || new Error('Could not create order');
      orderIds.push(order.id);
      group.orderId = order.id;
    }

    // 6. One Stripe Checkout Session for the whole cart — a line per shipment, so
    //    the receipt reads the way the parcels arrive.
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const base = process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;
    const lineItems = priced.groups.map((group) => {
      const titles = group.lines.map((l) => `${l.title}${l.copies > 1 ? ` ×${l.copies}` : ''}`);
      const label = group.lines.length === 1
        ? `${group.lines[0].variant.label} — ${byId.get(group.lines[0].collectionId)?.name || 'Popcode print'}`
        : `Popcode order — ${group.lines.length} items`;
      return {
        quantity: 1,
        price_data: {
          currency: group.currency.toLowerCase(),
          unit_amount: group.totalMinor,
          product_data: {
            name: label.slice(0, 250),
            description: titles.join(', ').slice(0, 250),
          },
        },
      };
    });

    const firstLine = lines[0];
    const cancelUrl = isCart
      ? `${base}/cart.html?cancelled=1`
      : firstLine.productType === 'boardbook'
        // Board books are created/ordered in boardbook.html (no single-image order
        // page), so cancel returns to the library rather than order.html.
        ? `${base}/manage.html?cancelled=1`
        : `${base}/order.html?id=${encodeURIComponent(byId.get(firstLine.collectionId)?.slug || '')}&cancelled=1`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Show a promo-code box on the Stripe Checkout page. Lets a valid
      // promotion code (e.g. a 100%-off test/comp code) be entered to reduce
      // the charged amount. Note: the server re-quote still drives the base
      // price; the code only discounts from there.
      allow_promotion_codes: true,
      customer_email: recipient.email,
      client_reference_id: orderGroupId,
      // print_order_id stays for single-order sessions (older webhook lookups);
      // print_order_group is the cart-aware key.
      metadata: {
        print_order_group: orderGroupId,
        ...(orderIds.length === 1 ? { print_order_id: orderIds[0] } : {}),
      },
      line_items: lineItems,
      success_url: `${base}/order-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    await admin.from('print_orders')
      .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
      .in('id', orderIds);

    res.status(200).json({ url: session.url, order_group_id: orderGroupId });
  } catch (e) {
    console.error('create-checkout error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    res.status(500).json({ error: e.message });
  }
}
