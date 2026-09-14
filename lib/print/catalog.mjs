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
  // Board book — the FIRST non-Prodigi product (Printify board book, blueprint 2727).
  // A real 6×6 laminated chipboard baby board book (District Photo, US). Unlike the
  // single-image/PDF products, its asset is a FIXED set of 11 flat images tagged by
  // print position: `cover` (3863×1875px) + `spread_1..spread_10` (3675×1875px each,
  // ~312 DPI). The builder produces those and tags each asset's print_area with the
  // position; each spread can carry a Popcode. Fulfilled by the printify adapter.
  //
  // `baseCostMinor` is the FIXED per-copy product cost (Printify prices by variant,
  // not artwork). It is NULL until the first send_to_production:false test order
  // reveals it — until then quote() reports it as unpriceable (UI shows "—"), so this
  // product is dormant/safe even though it's in the catalog. NOT yet exposed in the
  // Shop UI (that's the builder phase). See docs/board-book-printify-plan.md.
  boardbook: [
    {
      id: 'bb-6x6',
      label: '6×6" Board Book',
      sku: 'PRINTIFY-BB-2727-148738',
      printify: {
        shopId: 28663478,
        blueprintId: 2727,
        printProviderId: 28,
        variantId: 148738,
        positions: ['cover', 'spread_1', 'spread_2', 'spread_3', 'spread_4', 'spread_5', 'spread_6', 'spread_7', 'spread_8', 'spread_9', 'spread_10'],
        baseCostMinor: 1650,   // $16.50 per copy — from the send_to_production:false test order 2026-08-21 (line_item cost; shipping quoted live). Product price is fixed regardless of artwork.
        currency: 'USD',
      },
      attributes: {},
    },
  ],
};

// The product types a client may request (also what the UI renders).
// The companion postcard is intentionally absent — see COMPANION_CARD below.
export const PRODUCT_TYPES = Object.keys(PRODUCTS);

/* ══════════════════════════════════════════════════════════════════════
   COMPANION POSTCARD

   The card inserted into orders of flat/wall products, carrying that order's
   popcode.app URL. Design + renderer: public/postcard.html. Rationale and the
   open questions: docs/postcard-brief.md.

   Deliberately NOT a PRODUCTS entry, and so not in PRODUCT_TYPES: nobody
   chooses one, the server adds it, and a client must not be able to order a
   bare postcard. It carries the same fields a variant does, so it still flows
   through buildProdigiItems() unchanged.

   Artwork is generated per order — the URL differs every time, which is
   exactly why a vendor "branded insert" (one static file for every parcel)
   can't do this job.
   ══════════════════════════════════════════════════════════════════════ */

// Product types that ship with a card. The multi-page products (book,
// calendar, boardbook) already print the URL and instructions on their back
// cover, so a card in those parcels is redundant.
export const COMPANION_CARD_FOR = new Set([
  'print', 'framed', 'framedcanvas', 'canvas', 'acrylic', 'tile',
]);

export const COMPANION_CARD = {
  id: 'companion-postcard-6x4',
  label: 'Popcode companion card 6×4"',

  // Fine art postcard, matte Mohawk 324gsm, 6×4" landscape, ships with the
  // order (the CLASSIC-POST SKUs are a mail-direct service and never reach the
  // parcel — see the brief).
  //
  // VERIFIED against GET /v4.0/products/{sku} on 2026-09-14: outcome Ok,
  // 15.2 × 10.2 cm, Mohawk Superfine 324gsm, ships to ~200 countries including
  // US and GB. "BLA" is the blank ENVELOPE it ships with, not a blank back.
  sku: 'GLOBAL-POST-MOH-6X4-BLA',

  // The SKU's only variant declares these. Sent explicitly so the order can't
  // be ambiguous about stock.
  attributes: {
    paperType: 'Mohawk Superfine',
    style: 'Single',
    substrateWeight: '324gsm',
  },

  // OFF. Turned on 2026-09-14 and straight back off the same day: this SKU is
  // fulfilled in the UK/EU while the flat and wall products are fulfilled in the
  // US, so Prodigi quotes the card as a SEPARATE SHIPMENT. An 8x10 print that
  // should total ~$30 was quoting $76 — about $33 of unexplained cost against a
  // card that costs ~$1.30, i.e. a second transatlantic parcel.
  //
  // The cost is the smaller problem. A separate shipment means the card does not
  // travel with the print, so it is not a companion card at all — it would land
  // days later, on its own, from another continent.
  //
  // Do NOT simply flip this back on. A card as a line item only works with a SKU
  // fulfilled alongside the product. The better route is Prodigi's per-order
  // branded insert (branding.postcard.url in the order schema), which the
  // fulfilling lab puts in the box — see docs/postcard-brief.md.
  enabled: false,

  sizing: 'fillPrintArea',
  printArea: 'default',

  // Verified geometry. Prodigi's required asset for the single print area is
  // 3708 × 1263px, which is not the shape of a card: it is BOTH SIDES on one
  // sheet, side by side. 2 × (15.2 + 0.5) × (10.2 + 0.5) cm at 300 DPI is
  // 3709 × 1264, matching to a pixel of rounding — so bleed is 2.5mm, not the
  // 3mm originally assumed, and the blank back is not optional: the sheet
  // carries it either way.
  trimCm: { w: 15.2, h: 10.2 },
  bleedMm: 2.5,
  dpi: 300,
  sheetPx: { w: 3708, h: 1263 },

  // One asset, one print area: the combined sheet. Confirmed by the SKU's own
  // printAreas — { default: { required: true } } and nothing else. The earlier
  // front/back split was a guess about how a two-sided card would be declared;
  // Prodigi instead wants both sides on a single canvas.
  faces: [{ face: 'sheet', printArea: 'default' }],
};

/**
 * Does this cart earn a companion card?
 * @param {Array<{productType: string}>} lines normalized cart lines
 */
export function cartNeedsCompanionCard(lines) {
  return (lines || []).some((l) => COMPANION_CARD_FOR.has(l.productType));
}

/**
 * The distinct popcodes in a cart that earn a card, keyed by collection id.
 *
 * ONE CARD PER POPCODE, not per order and not per item. The brief leaned toward
 * a single card listing every link, but the approved artwork carries exactly one
 * URL set in 56pt display type — so a multi-link card would be a different
 * design, not a config choice. Two prints of the SAME popcode still get one
 * card, since the link is identical.
 *
 * Keyed by collectionId because that is what a cart line actually carries; the
 * slug (which is what the card prints) is looked up server-side at checkout.
 *
 * @param {Array<{productType: string, collectionId: ?string}>} lines
 * @returns {string[]} distinct collection ids, in cart order
 */
export function companionCardCollectionIds(lines) {
  const seen = new Set();
  for (const l of lines || []) {
    if (!COMPANION_CARD_FOR.has(l.productType)) continue;
    if (l.collectionId) seen.add(l.collectionId);
  }
  return [...seen];
}

/**
 * Where a popcode's card artwork lives in the `experiences` bucket.
 *
 * Deterministic, so the server builds these URLs itself from the slug rather
 * than trusting a client-supplied one. The client only has to put the files
 * there; it never gets to say what the order points at.
 */
export function companionCardPaths(slug) {
  return { sheet: `${slug}/companion-card.png` };
}

/**
 * Turn rendered faces into the assetUrls array buildProdigiItems() expects.
 *
 * Only the faces the SKU actually declares are sent: supplying an asset for a
 * print area the SKU doesn't have is as much an error as omitting a required
 * one. Throws rather than silently dropping a face, because a missing asset
 * here becomes a blank or rejected printed card.
 *
 * @param {{front?: string, back?: string}} urls uploaded asset URLs by face
 */
export function companionCardAssets(urls) {
  if (!urls) throw new Error('Companion card: no uploaded assets given');
  return COMPANION_CARD.faces.map(({ face, printArea }) => {
    const url = urls && urls[face];
    if (!url) throw new Error(`Companion card: no uploaded asset for the ${face} face`);
    return { url, print_area: printArea };
  });
}


// Which fulfillment provider makes each product type. Everything today is Prodigi;
// a new vendor (e.g. Printify for a 6×6 board book) is a one-line entry here plus
// its adapter in lib/print/providers/ — the API routes dispatch on this. See
// docs/board-book-printify-plan.md.
export const PRODUCT_PROVIDER = {
  boardbook: 'printify',
};
export function providerFor(productType) {
  return PRODUCT_PROVIDER[productType] || 'prodigi';
}

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
