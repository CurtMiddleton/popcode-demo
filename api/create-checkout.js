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
//      STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, (optional) PUBLIC_BASE_URL,
//      (optional) STRIPE_TAX_ENABLED, STRIPE_TAX_CODE.

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import { Sentry } from './_sentry.js';

const SUPABASE_URL = 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd3BraHNsdXpva3l0cHZtd3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA2MDksImV4cCI6MjA5MTE2NjYwOX0.YMfuRpKvcmfoJ75Gxhf7ekoCaeDfR0Dsz_9Beg5ULAI';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const MARKUP = Number(process.env.PRINT_MARKUP_MULTIPLIER || 1.4);

/* Stripe Tax, behind a switch. This is the money path: a session created with
   automatic_tax against a misconfigured account THROWS, and a throw here is
   checkout down for everyone. An env var means it can be turned off without a
   deploy, and means merging this cannot break anything by itself.

   It also fails soft at the call site — if the taxed session is rejected we
   retry once without tax and take the order, because an order that undercharges
   tax is recoverable and a customer who cannot pay is not. */
const TAX_ENABLED = String(process.env.STRIPE_TAX_ENABLED || '').toLowerCase() === 'true';
const TAX_CODE = process.env.STRIPE_TAX_CODE || '';

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

    /* Where we will and won't ship. The dropdown already hides these, so
       reaching here means a stale page or a crafted request — either way this
       is the gate that actually holds, and it runs before the re-quote, the
       order row and the Stripe session, so a refusal costs nothing. */
    {
      const { destinationRestriction } = await import('../lib/print/destinations.mjs');
      const blocked = destinationRestriction(
        recipient.address.countryCode, recipient.address.postalOrZipCode,
      );
      if (blocked) return res.status(400).json({ error: blocked.message, restricted: true });
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
      .from('collections').select('id, user_id, name, slug, mind_file_url').in('id', collectionIds);
    if (colErr) throw colErr;
    const byId = new Map((collections || []).map((c) => [c.id, c]));
    for (const id of collectionIds) {
      const c = byId.get(id);
      if (!c) return res.status(404).json({ error: 'Design not found' });
      if (c.user_id !== user.id) return res.status(403).json({ error: 'Not your design' });
    }

    // 3b. Resolve this order's branded inserts: the companion postcard (if the
    // order earns one) and the round packaging sticker. Both are BRANDED
    // INSERTS, not line items — the fulfilling lab puts them in/on the box, so
    // they are absent from the quote and add no shipping. Note they ARE billed
    // per SHIPMENT, so an order split across labs pays for each one twice.
    // The card's URL is built from the slug read above, never from the client.
    const { COMPANION_INSERT, PACKAGING_STICKER, companionInsertCollectionId,
            companionInsertPath, buildBranding } = await import('../lib/print/catalog.mjs');

    /* Confirm each asset exists before naming it. Prodigi fetches these URLs
       from their own servers, so a 404 here becomes a failed order AFTER the
       customer has paid — going without an insert is much the better failure.
       Same guard create-montage.js uses on a soundtrack URL. */
    const reachable = async (url) => {
      try { return (await fetch(url, { method: 'HEAD' })).ok; } catch { return false; }
    };

    let postcardUrl = null;
    if (COMPANION_INSERT.enabled) {
      const cardFor = companionInsertCollectionId(lines);
      const col = cardFor && byId.get(cardFor);
      /* Only a SCANNABLE collection earns a card. A saved print design is a
         collections row with mind_file_url '' — printing its slug would put
         "Experience not found" on a physical card. Better no card than a dead
         one, and the dashboard's generic set still ships. */
      const slug = col && col.mind_file_url ? col.slug : null;
      if (slug) {
        // The client uploads this best-effort, so it can legitimately be missing.
        const url = PUBLIC_ASSET_PREFIX + companionInsertPath(slug);
        if (await reachable(url)) postcardUrl = url;
      }
    }

    /* ONLY override the dashboard's default set when we have a per-order card to
       put in its place. Sending `branding` replaces that set outright, so a
       sticker-only object would ship a box with no card at all — worse than the
       generic card the default already provides. This is the case on a
       multi-project order, where there is no single slug to print.

       So: card + sticker when we have a card; otherwise leave `branding` off
       and let the dashboard default stand, exactly as it does today. */
    let stickerUrl = null;
    if (postcardUrl && PACKAGING_STICKER.enabled) {
      // Static art in our own repo, but still checked: naming a missing asset
      // fails the whole order rather than just losing the sticker.
      if (await reachable(PACKAGING_STICKER.url)) stickerUrl = PACKAGING_STICKER.url;
    }

    const branding = postcardUrl ? buildBranding({ postcardUrl, stickerUrl }) : null;

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
          branding,
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
          // Per-type markup means MARKUP is only a fallback — record the rate
          // this group was actually priced at.
          markup: group.effectiveMarkup ?? MARKUP,
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
          /* 'exclusive' — tax is added on top of this amount. Without it Stripe
             falls back to the account default, which may be 'inclusive' and
             would quietly take the tax out of margin instead of charging it.
             Harmless when automatic_tax is off. */
          tax_behavior: 'exclusive',
          product_data: {
            name: label.slice(0, 250),
            description: titles.join(', ').slice(0, 250),
            ...(TAX_CODE ? { tax_code: TAX_CODE } : {}),
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

    /* Stripe needs somewhere to send the goods before it can work out the tax.
       We already collected the address, so it goes on a Customer rather than
       being asked for a second time on Stripe's page — re-asking would also let
       the two addresses diverge, and the one we send Prodigi is this one. */
    let taxCustomerId = null;
    if (TAX_ENABLED) {
      try {
        const { toStripeAddress } = await import('../lib/print/tax.mjs');
        const addr = toStripeAddress(recipient.address);
        const customer = await stripe.customers.create({
          email: recipient.email,
          name: recipient.name,
          address: addr,
          shipping: { name: recipient.name, address: addr },
        });
        taxCustomerId = customer.id;
      } catch (e) {
        // No customer means no automatic tax on this session; the order still
        // goes through, untaxed, rather than failing.
        console.error('tax customer create failed:', e.message);
        Sentry.captureException(e);
      }
    }

    const baseSession = {
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
    };

    /* customer and customer_email are mutually exclusive — Stripe rejects a
       session carrying both. The Customer already holds the address and the
       email, so the bare field is DELETED rather than set to undefined: an
       undefined value still leaves the key present, which is enough for the
       SDK to send it and for Stripe to refuse the call. */
    let taxedSession = baseSession;
    if (taxCustomerId) {
      taxedSession = { ...baseSession, customer: taxCustomerId, automatic_tax: { enabled: true } };
      delete taxedSession.customer_email;
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create(taxedSession);
    } catch (e) {
      if (taxedSession === baseSession) throw e;
      /* The one retry that matters. Stripe rejects automatic_tax for reasons we
         cannot see from here — no origin address, a lapsed registration, a
         product tax code it will not accept. Taking the order untaxed is
         recoverable; refusing to take it is not. */
      console.error('taxed checkout session rejected, retrying untaxed:', e.message);
      Sentry.captureException(e);
      session = await stripe.checkout.sessions.create(baseSession);
    }

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
