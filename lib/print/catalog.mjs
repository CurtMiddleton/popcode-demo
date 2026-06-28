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

// `aspect` (width/height) is the product's print shape. order.html center-crops
// each photo to this BEFORE compositing the badge, so the badge always lands in
// the corner of what actually prints (and Prodigi's fillPrintArea won't crop the
// matching-aspect asset further).
export const PRODUCTS = {
  print: [
    { id: 'fap-8x10',  label: 'Fine Art Print 8×10"',     sku: 'GLOBAL-FAP-8x10',  aspect: 8 / 10,  sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
    { id: 'fap-10x10', label: 'Fine Art Print 10×10"',    sku: 'GLOBAL-FAP-10x10', aspect: 1,       sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
    { id: 'fap-11x14', label: 'Fine Art Print 11×14"',    sku: 'GLOBAL-FAP-11x14', aspect: 11 / 14, sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
    { id: 'fap-12x16', label: 'Fine Art Print 12×16"',    sku: 'GLOBAL-FAP-12x16', aspect: 12 / 16, sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
    { id: 'fap-16x24', label: 'Fine Art Print 16×24"',    sku: 'GLOBAL-FAP-16x24', aspect: 16 / 24, sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
    { id: 'fap-20x28', label: 'Fine Art Print 20×28"',    sku: 'GLOBAL-FAP-20x28', aspect: 20 / 28, sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
    { id: 'fap-24x36', label: 'Fine Art Print 24×36"',    sku: 'GLOBAL-FAP-24x36', aspect: 24 / 36, sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
  ],
  // Framed photo tiles require a frame `color` attribute (valid: white | black).
  tile: [
    { id: 'tile-5x7',  label: 'Framed Photo Tile 5×7"',   sku: 'PHOTIL-FRA-0507',  aspect: 5 / 7,   sizing: 'fillPrintArea', printArea: 'default', attributes: { color: 'black' } },
    { id: 'tile-8x8',  label: 'Framed Photo Tile 8×8"',   sku: 'PHOTIL-FRA-0808',  aspect: 1,       sizing: 'fillPrintArea', printArea: 'default', attributes: { color: 'black' } },
    { id: 'tile-8x10', label: 'Framed Photo Tile 8×10"',  sku: 'PHOTIL-FRA-0810',  aspect: 8 / 10,  sizing: 'fillPrintArea', printArea: 'default', attributes: { color: 'black' } },
  ],
  // Stretched canvas. `wrap: MirrorWrap` keeps the whole image (incl. badge) on the
  // front face (ImageWrap would bleed the edges onto the sides). GLOBAL-CAN-10x10
  // is confirmed; the other sizes are common-canvas guesses to spot-check.
  canvas: [
    { id: 'can-10x10', label: 'Canvas 10×10"', sku: 'GLOBAL-CAN-10x10', aspect: 1,       sizing: 'fillPrintArea', printArea: 'default', attributes: { wrap: 'MirrorWrap' } },
    { id: 'can-12x16', label: 'Canvas 12×16"', sku: 'GLOBAL-CAN-12x16', aspect: 12 / 16, sizing: 'fillPrintArea', printArea: 'default', attributes: { wrap: 'MirrorWrap' } },
    { id: 'can-16x20', label: 'Canvas 16×20"', sku: 'GLOBAL-CAN-16x20', aspect: 16 / 20, sizing: 'fillPrintArea', printArea: 'default', attributes: { wrap: 'MirrorWrap' } },
    { id: 'can-16x24', label: 'Canvas 16×24"', sku: 'GLOBAL-CAN-16x24', aspect: 16 / 24, sizing: 'fillPrintArea', printArea: 'default', attributes: { wrap: 'MirrorWrap' } },
  ],
  // Classic framed print (GLOBAL-CFP): fine-art paper + perspex glaze by default;
  // frame `color` is the required attribute (Black default for v1 — a frame-colour
  // picker is a future enhancement). SKU sizes + the color value casing are
  // best-guesses to verify via a sandbox order (may need a mount/glaze attr).
  framed: [
    { id: 'cfp-8x10',  label: 'Framed Print 8×10" (Black)',  sku: 'GLOBAL-CFP-8x10',  aspect: 8 / 10,  sizing: 'fillPrintArea', printArea: 'default', attributes: { color: 'black' } },
    { id: 'cfp-11x14', label: 'Framed Print 11×14" (Black)', sku: 'GLOBAL-CFP-11x14', aspect: 11 / 14, sizing: 'fillPrintArea', printArea: 'default', attributes: { color: 'black' } },
    { id: 'cfp-12x16', label: 'Framed Print 12×16" (Black)', sku: 'GLOBAL-CFP-12x16', aspect: 12 / 16, sizing: 'fillPrintArea', printArea: 'default', attributes: { color: 'black' } },
    { id: 'cfp-16x24', label: 'Framed Print 16×24" (Black)', sku: 'GLOBAL-CFP-16x24', aspect: 16 / 24, sizing: 'fillPrintArea', printArea: 'default', attributes: { color: 'black' } },
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

// Build the Prodigi `items[]` array.
//   - forQuote: the QUOTE endpoint's item schema is narrower than the ORDER
//     endpoint's — it rejects `sizing` (ModelBindingFailed/UnknownField) and
//     needs no asset URLs (Prodigi prices by SKU + destination). The ORDER
//     endpoint wants `sizing` + `assets:[{printArea,url}]`.
//   - assetUrls: array of { url } (or plain string URLs); single element in v1.
export function buildProdigiItems({ variant, copies = 1, assetUrls = [], forQuote = false }) {
  const item = {
    sku: variant.sku,
    copies: Math.max(1, parseInt(copies, 10) || 1),
  };
  if (variant.attributes && Object.keys(variant.attributes).length) item.attributes = variant.attributes;

  if (forQuote) {
    // Quote items still need the print-area declared (MissingRequiredAssets
    // otherwise) — but only the printArea, no image URL and no sizing.
    item.assets = [{ printArea: variant.printArea || 'default' }];
    return [item];
  }

  item.sizing = variant.sizing || 'fillPrintArea';
  const assets = assetUrls
    .map((a) => (typeof a === 'string' ? { url: a } : a))
    .filter((a) => a && a.url)
    .map((a) => ({ printArea: a.print_area || variant.printArea || 'default', url: a.url }));
  if (assets.length) item.assets = assets;
  return [item];
}

// Sanitize a recipient for Prodigi's ORDER endpoint: trim address fields and DROP
// any that are empty/whitespace. Prodigi rejects an empty `line2` with
// MustNotBeEmptyOrWhitespace — optional fields must be omitted, not sent blank.
export function cleanRecipient(recipient) {
  if (!recipient) return recipient;
  const addr = recipient.address || {};
  const cleanedAddr = {};
  for (const [k, v] of Object.entries(addr)) {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) cleanedAddr[k] = t;
    } else if (v != null) {
      cleanedAddr[k] = v;
    }
  }
  return { ...recipient, address: cleanedAddr };
}

// Pricing: all money math in integer minor units (cents). total = marked-up
// Prodigi cost, rounded UP to a whole dollar so displayed and charged prices are
// clean whole numbers ("$42", not "$41.37") and margin is never rounded below
// the marked-up cost. Single source of truth for both the quote display and the
// amount charged at checkout, so they always match.
export function priceFromQuote(quoteCostMinor, markup) {
  const m = Number(markup);
  const safeMarkup = Number.isFinite(m) && m > 0 ? m : 1.4;
  return Math.ceil((quoteCostMinor * safeMarkup) / 100) * 100;
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
