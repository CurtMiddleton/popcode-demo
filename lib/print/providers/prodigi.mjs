// Prodigi fulfillment adapter.
//
// All Prodigi-specific HTTP (quote + order submission) lives here so the API
// routes (prodigi-quote, create-checkout, finalize-order, stripe-webhook) stay
// vendor-neutral and just dispatch through the provider registry. This is Phase 1
// of the multi-provider refactor (see docs/board-book-printify-plan.md): a pure
// lift of the existing Prodigi calls into an adapter — no behavior change.
//
// The adapter reads its own env (PRODIGI_*) so each provider owns its config; the
// routes don't thread Prodigi keys around. Loaded via dynamic import() from the
// CJS-bundled routes (same ERR_REQUIRE_ESM reason as catalog.mjs).

import { buildProdigiItems, cleanRecipient, sumQuoteMinor } from '../catalog.mjs';
import { UNSERVABLE_STATUSES } from './statuses.mjs';

export const name = 'prodigi';

function cfg() {
  return {
    baseUrl: (process.env.PRODIGI_BASE_URL || 'https://api.sandbox.prodigi.com').trim().replace(/\/+$/, ''),
    apiKey: (process.env.PRODIGI_API_KEY || '').trim(),
    dryRun: (process.env.PRODIGI_DRY_RUN || '').trim().toLowerCase() === 'true',
    /* Absolute and pinned to production: Prodigi calls this from their servers,
       so it has to be publicly reachable, and a preview deployment answers 401
       behind Deployment Protection. Override to point a sandbox order at a
       tunnel when testing callbacks locally. */
    callbackUrl: (process.env.PRODIGI_CALLBACK_URL
      || 'https://popcode.app/api/prodigi-callback').trim(),
  };
}

/* Which Prodigi we are pointed at. Sandbox and live are separate worlds with
   separate order ids, so a caller that records "this order was not found" has
   to record WHERE it was not found — otherwise switching environments makes
   that note silently wrong. */
export function baseUrl() { return cfg().baseUrl; }

// Is this provider usable? (used by create-checkout's "not configured" guard.)
export function isConfigured() { return !!cfg().apiKey; }

// Live price. Takes either a full cart group (`lines`) or the legacy single
// (`variant`, `copies`, `pageCount`) shape. A group is quoted as ONE Prodigi
// quote with several items, so the customer pays one shipping cost for the whole
// shipment rather than per item — the whole reason the cart exists.
//
// Returns { totalMinor, currency } (product + shipping, minor units) or null if
// the quote came back empty; throws on an HTTP error so the caller can retry a
// transient Prodigi blip.
export async function quote({ lines = null, variant, copies, pageCount = null, destinationCountryCode, shippingMethod }) {
  const c = cfg();
  const items = lines && lines.length
    ? lines.flatMap((l) => buildProdigiItems({ variant: l.variant, copies: l.copies, forQuote: true, pageCount: l.pageCount }))
    : buildProdigiItems({ variant, copies, forQuote: true, pageCount });
  const resp = await fetch(`${c.baseUrl}/v4.0/quotes`, {
    method: 'POST',
    headers: { 'X-API-Key': c.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ shippingMethod: shippingMethod || 'Standard', destinationCountryCode, items }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const err = new Error(`Prodigi quote failed (${resp.status}): ${text.slice(0, 300)}`);
    // Some 4xxs are Prodigi telling us this SKU / destination / shipping-method
    // combination isn't servable: deterministic, pointless to retry, not an
    // outage, and surfaced to the customer as an unservable route.
    //
    // But NOT every 4xx. A 401/403 is OUR key being wrong or revoked, and a 429
    // is a rate limit that clears — neither says anything about the route. They
    // were misclassified here until 2026-09-20, which meant a broken key
    // presented to every customer as "we can't ship this to your country": a
    // total outage wearing the costume of a product limitation, with the retry
    // skipped and no error reported because the condition read as expected.
    err.prodigiStatus = resp.status;
    err.unservable = UNSERVABLE_STATUSES.has(resp.status);
    throw err;
  }
  return sumQuoteMinor(await resp.json());
}

/* Read an order back from Prodigi. This is the verification step behind
   api/prodigi-callback.js: that endpoint is public and unsigned, so nothing
   from its body is stored — the id is used to ask Prodigi directly, with our
   own key, and the answer is what gets written.

   Returns { ok:true, order } or { ok:false, error }. Never throws: the caller
   is a webhook that must answer 200 either way. */
export async function fetchProdigiOrder(prodigiOrderId) {
  const c = cfg();
  if (!c.apiKey) return { ok: false, error: 'Prodigi not configured' };
  let resp, data;
  try {
    resp = await fetch(`${c.baseUrl}/v4.0/orders/${encodeURIComponent(prodigiOrderId)}`, {
      headers: { 'X-API-Key': c.apiKey },
    });
    data = await resp.json().catch(() => ({}));
  } catch (netErr) {
    return { ok: false, error: netErr.message };
  }
  if (!resp.ok) return { ok: false, error: `Prodigi get order failed (${resp.status})`, status: resp.status };
  const order = data?.order;
  if (!order) return { ok: false, error: 'Prodigi returned no order' };
  return { ok: true, order };
}

// Turn a print_orders row into the Prodigi items[] array. A multi-item order
// (from the cart) carries its lines in `order.items`; a legacy single-item row
// has sku/copies/asset_urls at the top level. Both produce the same shape.
function itemsForOrder(order) {
  if (Array.isArray(order.items) && order.items.length) {
    return order.items.flatMap((it) => buildProdigiItems({
      variant: {
        sku: it.sku,
        sizing: it.sizing || 'fillPrintArea',
        attributes: it.attributes || {},
        printArea: it.print_area || 'default',
      },
      copies: it.copies,
      // pageCount is deliberately NOT passed at the item level: it is already
      // stamped per-asset by cart.normalizeLines, which skips the spine (Prodigi
      // rejects a spine asset that carries a page count). An item-level count
      // would put it back on every asset.
      assetUrls: it.asset_urls || [],
    }));
  }
  return buildProdigiItems({
    variant: {
      sku: order.sku,
      sizing: order.sizing || 'fillPrintArea',
      attributes: order.attributes || {},
      printArea: 'default',
    },
    copies: order.copies,
    assetUrls: order.asset_urls || [],
  });
}

// Submit a paid order to Prodigi. `order` is the print_orders row. Does NO DB
// writes — returns a normalized result the route persists:
//   { ok:true, providerOrderId, response }                     — submitted
//   { ok:true, dryRun:true, providerOrderId, response }        — dry-run (no real order)
//   { ok:false, error, response, networkError?/httpStatus? }   — failed
export async function submitOrder({ order }) {
  const c = cfg();
  const items = itemsForOrder(order);
  const orderBody = {
    merchantReference: order.id,
    shippingMethod: order.shipping_method || 'Standard',
    recipient: cleanRecipient(order.recipient),
    items,
  };
  // Companion postcard, resolved per order at checkout. Prodigi's dashboard
  // inserts are one static file for every parcel; naming it here is what lets
  // the card carry a URL that changes every time.
  if (order.branding && Object.keys(order.branding).length) orderBody.branding = order.branding;

  /* Where Prodigi tells us this order moved. Without it, `status` stops at
     "submitted" forever and tracking has to be typed in by hand.

     Set per order rather than once in the dashboard's merchant settings, so a
     sandbox order cannot call production's endpoint (and vice versa) and the
     value travels with the code rather than living only in a web form. It is
     pinned to production for the same reason as the packaging sticker: Prodigi
     calls it from their servers, and a preview deployment answers 401. */
  if (c.callbackUrl) orderBody.callbackUrl = c.callbackUrl;

  // Dry-run: prove the chain without placing a real (live) order. Records the exact
  // body that would have been sent.
  if (c.dryRun) {
    return { ok: true, dryRun: true, providerOrderId: `DRYRUN-${order.id}`, response: { dryRun: true, wouldSend: orderBody } };
  }

  let resp, data;
  try {
    resp = await fetch(`${c.baseUrl}/v4.0/orders`, {
      method: 'POST',
      headers: { 'X-API-Key': c.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(orderBody),
    });
    data = await resp.json().catch(() => ({}));
  } catch (netErr) {
    return { ok: false, networkError: true, error: netErr.message, response: { error: netErr.message } };
  }
  if (!resp.ok) {
    return { ok: false, httpStatus: resp.status, error: `Prodigi order failed (${resp.status}) for ${order.id}`, response: data };
  }
  const providerOrderId = data?.order?.id || data?.id || null;
  return { ok: true, providerOrderId, response: data };
}
