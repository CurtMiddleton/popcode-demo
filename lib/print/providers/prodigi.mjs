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

export const name = 'prodigi';

function cfg() {
  return {
    baseUrl: (process.env.PRODIGI_BASE_URL || 'https://api.sandbox.prodigi.com').trim().replace(/\/+$/, ''),
    apiKey: (process.env.PRODIGI_API_KEY || '').trim(),
    dryRun: (process.env.PRODIGI_DRY_RUN || '').trim().toLowerCase() === 'true',
  };
}

// Is this provider usable? (used by create-checkout's "not configured" guard.)
export function isConfigured() { return !!cfg().apiKey; }

// Live price for a variant to a destination. Returns { totalMinor, currency }
// (product + shipping, minor units) or null if the quote came back empty; throws
// on an HTTP error so the caller can retry a transient Prodigi blip.
export async function quote({ variant, copies, pageCount = null, destinationCountryCode, shippingMethod }) {
  const c = cfg();
  const items = buildProdigiItems({ variant, copies, forQuote: true, pageCount });
  const resp = await fetch(`${c.baseUrl}/v4.0/quotes`, {
    method: 'POST',
    headers: { 'X-API-Key': c.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ shippingMethod: shippingMethod || 'Standard', destinationCountryCode, items }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const err = new Error(`Prodigi quote failed (${resp.status}): ${text.slice(0, 300)}`);
    // A 4xx is Prodigi telling us this SKU / destination / shipping-method
    // combination isn't servable. It's deterministic, so retrying is pointless
    // and it isn't an outage — callers surface it as an unservable route.
    err.prodigiStatus = resp.status;
    err.unservable = resp.status >= 400 && resp.status < 500;
    throw err;
  }
  return sumQuoteMinor(await resp.json());
}

// Submit a paid order to Prodigi. `order` is the print_orders row. Does NO DB
// writes — returns a normalized result the route persists:
//   { ok:true, providerOrderId, response }                     — submitted
//   { ok:true, dryRun:true, providerOrderId, response }        — dry-run (no real order)
//   { ok:false, error, response, networkError?/httpStatus? }   — failed
export async function submitOrder({ order }) {
  const c = cfg();
  const variant = {
    sku: order.sku,
    sizing: order.sizing || 'fillPrintArea',
    attributes: order.attributes || {},
    printArea: 'default',
  };
  const items = buildProdigiItems({ variant, copies: order.copies, assetUrls: order.asset_urls || [] });
  const orderBody = {
    merchantReference: order.id,
    shippingMethod: order.shipping_method || 'Standard',
    recipient: cleanRecipient(order.recipient),
    items,
  };

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
