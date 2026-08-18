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
  // One variant per size × colour; black keeps the original bare id so saved
  // designs and links from before the colour option keep resolving.
  tile: [
    ['5x7', 'PHOTIL-FRA-0507', 5 / 7],
    ['8x8', 'PHOTIL-FRA-0808', 1],
    ['8x10', 'PHOTIL-FRA-0810', 8 / 10],
  ].flatMap(([size, sku, aspect]) => ['black', 'white'].map((color) => ({
    id: `tile-${size}${color === 'black' ? '' : '-' + color}`,
    label: `Framed Photo Tile ${size}" (${color[0].toUpperCase() + color.slice(1)})`,
    sku, aspect, sizing: 'fillPrintArea', printArea: 'default', attributes: { color },
  }))),
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
  // frame `color` is the required attribute. Prodigi offers 8 classic-frame
  // colours (black, white, natural, brown, antique silver/gold, dark/light
  // grey) — we curate the classic trio. One variant per size × colour; black
  // keeps the original bare id so saved designs keep resolving. SKU sizes +
  // the color value casing are best-guesses to verify via a sandbox order
  // (may need a mount/glaze attr).
  framed: [
    ['8x10', 8 / 10],
    ['11x14', 11 / 14],
    ['12x16', 12 / 16],
    ['16x24', 16 / 24],
  ].flatMap(([size, aspect]) => ['black', 'white', 'natural'].map((color) => ({
    id: `cfp-${size}${color === 'black' ? '' : '-' + color}`,
    label: `Framed Print ${size}" (${color[0].toUpperCase() + color.slice(1)})`,
    sku: `GLOBAL-CFP-${size}`, aspect, sizing: 'fillPrintArea', printArea: 'default', attributes: { color },
  }))).concat(
    // Mounted variants (GLOBAL-CFPM): the conservation mount sits between the
    // frame and the print, so the FRAME size is bigger than the printed image —
    // `aspect` here is the IMAGE space (what the photo is cropped to), per
    // Prodigi's published pairings (12x16 frame → 8x12 image, 16x20 → 12x16,
    // 20x28 → 16x24). Mount colour left at Prodigi's default (snow white);
    // verify via sandbox quote whether a mountColor attribute is required.
    [
      ['12x16', '8×12', 8 / 12],
      ['16x20', '12×16', 12 / 16],
      ['20x28', '16×24', 16 / 24],
    ].flatMap(([size, img, aspect]) => ['black', 'white', 'natural'].map((color) => ({
      id: `cfpm-${size}${color === 'black' ? '' : '-' + color}`,
      label: `Framed Print + Mount ${size}" (${img}" image, ${color[0].toUpperCase() + color.slice(1)})`,
      sku: `GLOBAL-CFPM-${size}`, aspect, sizing: 'fillPrintArea', printArea: 'default', attributes: { color },
    })))
  ),
  // Classic framed canvas (GLOBAL-FRA-SLIMCAN): 38mm stretched canvas set in
  // the classic frame. Same 8 frame colours as CFP — same curated trio here.
  // Size tokens follow the FAP/CFP pattern; verify each via a sandbox quote.
  framedcanvas: [
    ['12x16', 12 / 16],
    ['16x20', 16 / 20],
    ['16x24', 16 / 24],
    ['20x28', 20 / 28],
  ].flatMap(([size, aspect]) => ['black', 'white', 'natural'].map((color) => ({
    id: `fcan-${size}${color === 'black' ? '' : '-' + color}`,
    label: `Framed Canvas ${size}" (${color[0].toUpperCase() + color.slice(1)})`,
    sku: `GLOBAL-FRA-SLIMCAN-${size}`, aspect, sizing: 'fillPrintArea', printArea: 'default', attributes: { color },
  }))),
  // Acrylic prints (GLOBAL-MOU-ACRY): 10mm high-gloss acrylic panel with an
  // invisible floating subframe. Sizes from Prodigi's acrylic-panels page
  // (16x48 panoramic omitted). Verify via a sandbox quote.
  acrylic: [
    { id: 'acry-8x8',   label: 'Acrylic Print 8×8"',   sku: 'GLOBAL-MOU-ACRY-8x8',   aspect: 1,       sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
    { id: 'acry-8x12',  label: 'Acrylic Print 8×12"',  sku: 'GLOBAL-MOU-ACRY-8x12',  aspect: 8 / 12,  sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
    { id: 'acry-12x16', label: 'Acrylic Print 12×16"', sku: 'GLOBAL-MOU-ACRY-12x16', aspect: 12 / 16, sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
    { id: 'acry-16x24', label: 'Acrylic Print 16×24"', sku: 'GLOBAL-MOU-ACRY-16x24', aspect: 16 / 24, sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
  ],
  // Photo books (multi-page, API-only). Unlike single-image products the asset is
  // a whole print-ready PDF (cover first, back cover last, 300 DPI) built by
  // book.html's buildBookPrintPdf() — NOT a cropped photo, so there's no `aspect`.
  // `isBook` tells buildProdigiItems to attach `pageCount` to the asset (books are
  // priced per page; the first 24 are included in the base). SKU verified against
  // `GET /v4.0/products/{sku}` in the Prodigi sandbox before going live.
  book: [
    { id: 'book-a4l-layflat', label: 'Layflat Photo Book — A4 Landscape', sku: 'BOOK-FE-A4-L-LF-G', isBook: true, sizing: 'fillPrintArea', printArea: 'default', attributes: {}, minPages: 24, maxPages: 122 },
    // 8.3 × 8.3" (210 × 210 mm) square layflat. Prodigi's public docs confirm the
    // size exists but don't publish the SKU string — this follows the
    // BOOK-FE-{size}-{orientation}-{binding}-{finish} pattern of the verified A4
    // SKUs. VERIFY via a sandbox quote before go-live (a wrong SKU surfaces
    // instantly as SkuNotFound when the order is quoted).
    { id: 'book-21sq-layflat', label: 'Layflat Photo Book — 8×8" Square', sku: 'BOOK-FE-21X21-SQ-LF-G', isBook: true, sizing: 'fillPrintArea', printArea: 'default', attributes: {}, minPages: 24, maxPages: 122 },
  ],
  // Wall calendar (Wire-O, landscape). The undated SKU takes ONE complete
  // 26-page PDF (front cover, 12 × [photo page + month grid page], back cover)
  // at A4 landscape (297 × 210 mm) — exactly what calendar.html's
  // buildCalendarPrintPdf() produces. SKU confirmed from Prodigi's published
  // calendar product-range sheet (CALENDAR-A4-L-UNDATED / -A5- / -DATED).
  // Fixed page count — not page-priced, so no isBook/pageCount handling.
  calendar: [
    { id: 'cal-a4-undated', label: 'Wall Calendar — A4 (12 months)', sku: 'CALENDAR-A4-L-UNDATED', sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
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
//   - pageCount: total PDF page count for photo books (required by Prodigi for
//     page-priced products). Attached to the asset for both quote and order.
export function buildProdigiItems({ variant, copies = 1, assetUrls = [], forQuote = false, pageCount = null }) {
  const item = {
    sku: variant.sku,
    copies: Math.max(1, parseInt(copies, 10) || 1),
  };
  if (variant.attributes && Object.keys(variant.attributes).length) item.attributes = variant.attributes;

  const pc = variant.isBook ? (parseInt(pageCount, 10) || null) : null;

  if (forQuote) {
    // Quote items still need the print-area declared (MissingRequiredAssets
    // otherwise) — printArea only, no image URL and no sizing. Books also carry
    // pageCount so the quote prices the extra pages.
    const asset = { printArea: variant.printArea || 'default' };
    if (pc) asset.pageCount = pc;
    item.assets = [asset];
    return [item];
  }

  item.sizing = variant.sizing || 'fillPrintArea';
  const assets = assetUrls
    .map((a) => (typeof a === 'string' ? { url: a } : a))
    .filter((a) => a && a.url)
    .map((a) => {
      const asset = { printArea: a.print_area || variant.printArea || 'default', url: a.url };
      const aPc = pc || (a.page_count ? parseInt(a.page_count, 10) : null);
      if (aPc) asset.pageCount = aPc;
      return asset;
    });
  if (assets.length) item.assets = assets;
  return [item];
}

// Sanitize a recipient for Prodigi's ORDER endpoint: trim address fields and DROP
// any that are empty/whitespace. Prodigi rejects an empty `line2` with
// MustNotBeEmptyOrWhitespace — optional fields must be omitted, not sent blank.
export function cleanRecipient(recipient) {
  if (!recipient) return recipient;
  // Prodigi's order endpoint rejects present-but-empty string fields with
  // MustNotBeEmptyOrWhitespace, so drop anything blank rather than sending "".
  // Applies at both levels: address (line2, stateOrCounty) and top level
  // (phoneNumber, which is optional but recommended on international orders).
  const prune = (obj) => {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) {
      if (typeof v === 'string') {
        const t = v.trim();
        if (t) out[k] = t;
      } else if (v != null) {
        out[k] = v;
      }
    }
    return out;
  };
  const { address, ...rest } = recipient;
  return { ...prune(rest), address: prune(address) };
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
