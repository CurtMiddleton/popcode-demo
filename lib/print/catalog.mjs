// Server-authoritative print-product catalog + Prodigi item / pricing helpers.
//
// This is the single source of truth for which products can be ordered and what
// SKU/attributes each maps to. The quote and checkout endpoints validate every
// client request against this — a client-sent SKU or price is NEVER trusted.
//
// Loaded with dynamic import() inside the Vercel functions (they bundle as CJS,
// so a static import of this .mjs would throw ERR_REQUIRE_ESM — same pattern as
// api/identify.js loading identify.mjs).
//
// v1 scope = single-image products only (flat prints + photo tiles). Photo books
// and calendars are a later phase; they slot in as new PRODUCTS entries plus a
// multi-asset builder, with no schema change (asset_urls is already a jsonb array).
//
// SKU strings below are Prodigi GLOBAL print-on-demand SKUs. Verify/extend each
// against `GET /v4.0/products/{sku}` in the Prodigi sandbox before going live —
// SKUs and valid attributes are authoritative there. `printArea` is 'default' for
// all single-image products.

export const PRODUCTS = {
  print: [
    { id: 'fap-8x10',  label: 'Photo Print 8×10"',        sku: 'GLOBAL-FAP-8x10',  sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
    { id: 'fap-11x14', label: 'Photo Print 11×14"',       sku: 'GLOBAL-FAP-11x14', sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
    { id: 'fap-16x24', label: 'Fine Art Print 16×24"',    sku: 'GLOBAL-FAP-16x24', sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
  ],
  tile: [
    { id: 'tile-5x7',  label: 'Framed Photo Tile 5×7"',   sku: 'GLOBAL-FPT-5X7',   sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
    { id: 'tile-8x8',  label: 'Framed Photo Tile 8×8"',   sku: 'GLOBAL-FPT-8X8',   sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
    { id: 'tile-8x10', label: 'Framed Photo Tile 8×10"',  sku: 'GLOBAL-FPT-8X10',  sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
  ],
};

// The product types a client may request (also what the UI renders).
export const PRODUCT_TYPES = Object.keys(PRODUCTS);

// Look up a variant by product type + variant id. Returns null for anything not
// in the catalog — callers MUST treat null as "reject the request".
export function findVariant(productType, variantId) {
  const list = PRODUCTS[productType];
  if (!list) return null;
  return list.find((v) => v.id === variantId) || null;
}

// Build the Prodigi `items[]` array. Used by BOTH quote and order creation so the
// thing we price is exactly the thing we order.
//   - assetUrls: array of { url } (or plain string URLs); single element in v1.
//     Pass [] for quotes (Prodigi prices by SKU + destination, no asset needed).
export function buildProdigiItems({ variant, copies = 1, assetUrls = [] }) {
  const assets = assetUrls
    .map((a) => (typeof a === 'string' ? { url: a } : a))
    .filter((a) => a && a.url)
    .map((a) => ({ printArea: a.print_area || variant.printArea || 'default', url: a.url }));

  const item = {
    sku: variant.sku,
    copies: Math.max(1, parseInt(copies, 10) || 1),
    sizing: variant.sizing || 'fillPrintArea',
  };
  if (variant.attributes && Object.keys(variant.attributes).length) item.attributes = variant.attributes;
  if (assets.length) item.assets = assets;
  return [item];
}

// Pricing: all money math in integer minor units (cents), rounded ONCE here so
// margin is reproducible. total = round(prodigiCostMinor * markup).
export function priceFromQuote(quoteCostMinor, markup) {
  const m = Number(markup);
  const safeMarkup = Number.isFinite(m) && m > 0 ? m : 1.4;
  return Math.round(quoteCostMinor * safeMarkup);
}

// Sum a Prodigi quote response into a single minor-unit total (product + shipping)
// and the currency. Prodigi returns costs as decimal strings in `quotes[]`, each
// with costSummary.items{Cost} and costSummary.shipping{Cost} ({ amount, currency }).
// Defensive across minor response shape differences.
export function sumQuoteMinor(quoteResponse) {
  const quote = quoteResponse?.quotes?.[0];
  if (!quote) return null;
  const cs = quote.costSummary || {};
  const parts = [cs.items, cs.shipping].filter(Boolean);
  if (!parts.length) return null;

  let totalMinor = 0;
  let currency = 'USD';
  for (const p of parts) {
    const amount = p.amount ?? p.Amount;
    if (amount == null) continue;
    currency = p.currency || p.Currency || currency;
    totalMinor += Math.round(parseFloat(amount) * 100);
  }
  return { totalMinor, currency };
}
