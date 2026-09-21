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
    // Small sizes, all four verified against GET /v4.0/products/{sku}
    // (sandbox, 2026-09-15): enhanced matte art, 200gsm, one required
    // 'default' print area each, same as the larger sizes already selling.
    // 4x6 is RETIRED from the shop: Prodigi charges the same to make and post it
    // as a 5x7, so it earned identical margin for a visibly smaller print and
    // only ever undercut the 5x7. Kept here, hidden, so a design saved while it
    // was on sale still resolves and can still be reordered — dropping the
    // variant outright would break those rows. Not in order.html's size picker.
    { id: 'fap-4x6',   label: 'Fine Art Print 4\u00d76"',      sku: 'GLOBAL-FAP-4x6',   aspect: 4 / 6,   sizing: 'fillPrintArea', printArea: 'default', attributes: {}, hidden: true },
    { id: 'fap-5x7',   label: 'Fine Art Print 5\u00d77"',      sku: 'GLOBAL-FAP-5x7',   aspect: 5 / 7,   sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
    { id: 'fap-6x6',   label: 'Fine Art Print 6\u00d76"',      sku: 'GLOBAL-FAP-6x6',   aspect: 1,       sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
    { id: 'fap-8x8',   label: 'Fine Art Print 8\u00d78"',      sku: 'GLOBAL-FAP-8x8',   aspect: 1,       sizing: 'fillPrintArea', printArea: 'default', attributes: {} },
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
  // colours — the catalogue reports them as
  //   black | brown | dark grey | gold | light grey | natural | silver | white
  // and we curate the classic trio, whose lowercase spelling matches exactly.
  // One variant per size × colour; black keeps the original bare id so saved
  // designs keep resolving. The SKU carries its own glaze and mount, so no
  // extra attribute is needed for the unmounted frame.
  framed: [
    // 5x7 and 8x8 verified against GET /v4.0/products/{sku} (sandbox,
    // 2026-09-15). There is NO GLOBAL-CFP-6x6 — the classic frame has no 6x6,
    // though the bare print does; don't add it back on symmetry grounds.
    ['5x7', 5 / 7],
    ['8x8', 1],
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
  // `isBook` tells buildProdigiItems to attach `pageCount` to the asset. Books are
  // priced per page and the curve is perfectly LINEAR — $1.06 per 2 pages at the
  // A4 landscape size, with no inclusive starting band, so the minimum page count
  // directly sets the advertised "From" price. SKU verified against
  // `GET /v4.0/products/{sku}` in the Prodigi sandbox before going live.
  //
  // minPages/maxPages are the REAL limits, established by probing the live quote
  // API (2026-09-16): 16 is refused, 18 quotes, 122 quotes, 124 is refused. The
  // refusal at 124 is what makes 18 trustworthy — it proves Prodigi enforces the
  // range at quote time rather than accepting anything and failing later.
  book: [
    { id: 'book-a4l-layflat', label: 'Layflat Photo Book — A4 Landscape', sku: 'BOOK-FE-A4-L-LF-G', isBook: true, sizing: 'fillPrintArea', printArea: 'default', attributes: {}, minPages: 18, maxPages: 122 },
    // 8.3 × 8.3" (210 × 210 mm) square layflat. SKU verified in the Prodigi
    // dashboard catalogue (2026-09-21): "Square Layflat Book, Gloss, 190gsm,
    // Matte Cover, 8.3x8.3" / 21x21cm", US + DE fulfilled, min 18 pages at
    // $28.50 + $0.53/extra page. The size token is `8_3` (underscore for the
    // decimal), which is why the earlier BOOK-FE-21X21-… guess never resolved.
    { id: 'book-21sq-layflat', label: 'Layflat Photo Book — 8×8" Square', sku: 'BOOK-FE-8_3-SQ-LF-G', isBook: true, sizing: 'fillPrintArea', printArea: 'default', attributes: {}, minPages: 18, maxPages: 122 },
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
   COMPANION POSTCARD — a per-order BRANDED INSERT.

   The card that goes in the box with a flat or wall print, carrying that
   order's popcode.app URL. Design + renderer: public/postcard-render.js.

   NOT a line item. It was built that way first, using a GLOBAL-POST SKU, and
   that was wrong: those postcards are fulfilled in the UK/EU while the flat and
   wall products are fulfilled in the US, so Prodigi quoted the card as a second
   transatlantic shipment. An 8×10 print that should total ~$30 quoted $76 — and
   worse, the card would not have travelled with the print at all.

   A branded insert is placed in the box by whichever lab fulfils the order, so
   there is one parcel, one shipping charge, and the card is where it belongs.
   Prodigi's dashboard only takes a static file, but the ORDER schema takes a
   per-order URL — which is what makes this work for a URL that changes every
   time. See docs/postcard-brief.md.
   ══════════════════════════════════════════════════════════════════════ */

// Product types that earn a card. The multi-page products (book, calendar,
// boardbook) already print the URL on their back cover.
// Everything Prodigi fulfils. Books and calendars print the URL on their own
// back cover, but a card costs nothing extra and a customer can easily miss a
// back cover, so reinforce it.
//
// 'boardbook' is deliberately absent and is NOT an oversight: it is fulfilled by
// Printify, which has no insert mechanism at all — providers/printify.mjs ignores
// `branding` entirely. Listing it here would generate and upload a card that
// nobody ever prints. If board books should carry the URL, it has to go into the
// artwork the builder produces.
export const COMPANION_INSERT_FOR = new Set([
  'print', 'framed', 'framedcanvas', 'canvas', 'acrylic', 'tile',
  'book', 'calendar',
]);

export const COMPANION_INSERT = {
  // ON. An insert is not part of the quote, so this cannot repeat the line
  // item's mistake of adding a second shipment — the fulfilling lab puts the
  // card in the same box. create-checkout HEAD-checks the artwork first, so a
  // slug whose card never uploaded simply ships without one.
  enabled: true,

  // Prodigi's insert postcard: "Single-sided A6 (4.1x5.8"), 260gsm postcard
  // with a smooth finish. Includes a 4mm white border." — its own words, read
  // off the dashboard on 2026-09-20. 4.1 × 5.8in is 105 × 148mm, so the STOCK
  // is A6 portrait; an earlier version of this file declared a landscape file
  // and was wrong.
  //
  // The ARTWORK still reads landscape — it is the approved design, unchanged —
  // and is rotated a quarter turn on export to fill this portrait file. See
  // buildPostcardInsert() in public/postcard-render.js, which is what actually
  // produces it, and whose PRINT.insertPx must agree with pxSize below.
  //
  // Pre-cut, so there is no bleed to supply, and Prodigi adds the 4mm border
  // itself — the artwork leaves 8mm clear of content.
  trimMm: { w: 105, h: 148 },
  borderMm: 4,
  dpi: 300,
  pxSize: { w: 1240, h: 1748 },
};

/**
 * The popcode a companion insert should point at, or null if the order gets none.
 *
 * ONE insert per parcel — that is how branded inserts work, unlike the line
 * item, which could be one per popcode. So an order mixing several popcodes
 * gets NO card rather than a card naming one of them, which would send the
 * customer to the wrong project. A multi-link card is a different design, not a
 * config change.
 *
 * @param {Array<{productType: string, collectionId: ?string}>} lines
 * @returns {?string} the single qualifying collection id, or null
 */
export function companionInsertCollectionId(lines) {
  const ids = new Set();
  for (const l of lines || []) {
    if (COMPANION_INSERT_FOR.has(l.productType) && l.collectionId) ids.add(l.collectionId);
  }
  return ids.size === 1 ? [...ids][0] : null;
}

/** Where a popcode's insert artwork lives in the `experiences` bucket. */
export function companionInsertPath(slug) {
  return `${slug}/companion-card.png`;
}

/** The Prodigi order's `branding` object for a given artwork URL. */
/* Prodigi's `branding` is a MAP OF INSERT SLOTS — postcard, flyer, two packing
   slips and four stickers — and sending it REPLACES the whole default set
   configured in the dashboard rather than merging into it.

   That is exactly what went wrong on order 14540074: we sent `{ postcard }`,
   Prodigi took us at our word, and the account's round packaging sticker did
   not ship. The cost summary proved it — `Inserts $5.00` is two postcards at
   $2.50 and nothing else; two stickers would have made it $7.50.

   So every insert we want on an order has to be named here. Note the casing is
   genuinely mixed in Prodigi's schema: `postcard` and `flyer` are single words,
   the stickers and packing slips are snake_case. A misspelt key is not an
   error — the slot simply does not ship.

   Returns null when there is nothing to send, so the caller omits `branding`
   entirely and Prodigi falls back to the dashboard default. */
export function buildBranding({ postcardUrl = null, stickerUrl = null } = {}) {
  const branding = {};
  if (postcardUrl) branding.postcard = { url: postcardUrl };
  // "Round sticker on external packaging" — the only branding on what is
  // otherwise a plain brown envelope.
  if (stickerUrl) branding.sticker_exterior_round = { url: stickerUrl };
  return Object.keys(branding).length ? branding : null;
}

// Kept for callers that only ever send a card.
export function companionInsertBranding(url) {
  return buildBranding({ postcardUrl: url });
}

export const PACKAGING_STICKER = {
  // The round sticker that goes on the OUTSIDE of the box: 65mm / 2.5"
  // high-gloss, $1.25, configured in the Prodigi dashboard as "Popcode Round
  // packaging sticker". On tubes it goes on the end cap.
  //
  // The asset is the approved artwork, committed unmodified: 827x827 at 300 DPI
  // = a 70mm square, so the bleed is 2.5mm around the 65mm cut, and it runs to
  // all four corners. Billed PER SHIPMENT like the postcard, so an order split
  // across labs pays for it twice.
  enabled: true,

  /* Static art — the same on every order, unlike the postcard, whose URL
     carries the order's slug. Served from our own site rather than Supabase
     storage because it is a repo asset, not something a customer uploaded.

     ABSOLUTE and pinned to production on purpose: Prodigi fetches this URL
     from their servers, so it has to be publicly reachable. A preview
     deployment is not — Deployment Protection answers 401 — and deriving the
     origin from the request would quietly send Prodigi a URL it cannot read.
     Overridable for testing against a different host. */
  url: (process.env.PACKAGING_STICKER_URL || 'https://popcode.app/assets/popcode-packaging-sticker.png').trim(),
};

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

// Pricing: all money math in integer minor units (cents).
//
// THE MODEL: markup applies to the PRODUCT ONLY; shipping is passed through at
// cost. It used to apply to product + shipping together, which never lost money
// but priced small items absurdly — a 5x7 print costs ~$6 to make and ~$11 to
// post, so marking up the whole $17 put a postcard-sized print at $24 while the
// competition advertises pennies. Shipping is a pass-through, not inventory; we
// add no value to it and shouldn't earn on it.
//
// That is also what lets the shop advertise a product price at all. A price
// that bundles shipping can only be shown once the destination is known, and it
// makes the cheapest item look the worst. Now the shop says "From $9, plus
// shipping" and checkout adds the carrier cost as its own line.
//
// Both parts round UP to a whole unit: prices stay clean ("$9", not "$8.40"),
// margin is never rounded below the marked-up cost, and shipping is never
// rounded below what the carrier charges. Rounding shipping DOWN would lose real
// money on every order now that the markup no longer absorbs it.
//
// Single source of truth for the quote display and the amount charged, so they
// can't drift.
function safeMarkup(markup) {
  const m = Number(markup);
  return Number.isFinite(m) && m > 0 ? m : 1.4;
}

/* Markup by product type.
   One number can't fit the catalogue. Now that shipping is passed through at
   cost, the markup has to cover it out of the goods, and the ratio of carrier
   cost to goods cost varies enormously: posting a 5x7 print costs nearly twice
   what printing it does, while an acrylic panel's shipping is a quarter of its
   make cost. A single multiplier either starves the small items or overprices
   the big ones.

   Each figure below is 1 + 0.40 + 0.25 × (shipping ÷ goods) for a representative
   size — 40% on the goods, plus a contribution of a quarter of the carrier cost —
   rounded to something readable. That earns real margin on the shipping-heavy
   items without putting a postcard-sized print back at $24.

   These are business numbers, not physics. Tune them here, or without a deploy
   via PRINT_MARKUP_BY_TYPE, a JSON object of the same shape:
       PRINT_MARKUP_BY_TYPE={"print":2.0,"tile":2.2}
   Anything absent falls back to this table, then to PRINT_MARKUP_MULTIPLIER. */
export const TYPE_MARKUPS = {
  print: 1.8,          // ship ~$11 vs $6–22 goods — the most shipping-dominated
  tile: 2.0,           // ship ~$22 vs $8–10 goods, and tiles do NOT share a parcel
  canvas: 1.6,
  framed: 1.55,
  framedcanvas: 1.55,
  acrylic: 1.5,        // goods dwarf shipping, so it needs the least help
  book: 1.45,
  calendar: 1.5,
  boardbook: 1.5,
};

let envMarkupsCache;
function envMarkups() {
  if (envMarkupsCache) return envMarkupsCache;
  try {
    const raw = process.env.PRINT_MARKUP_BY_TYPE;
    const parsed = raw ? JSON.parse(raw) : {};
    envMarkupsCache = parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    // A malformed override must not take pricing down; fall back to the table.
    envMarkupsCache = {};
  }
  return envMarkupsCache;
}

// The markup for one product type: env override, then the table above, then the
// caller's global default (PRINT_MARKUP_MULTIPLIER), then 1.4.
export function markupFor(productType, fallback) {
  for (const candidate of [envMarkups()[productType], TYPE_MARKUPS[productType], fallback]) {
    const m = Number(candidate);
    if (Number.isFinite(m) && m > 0) return m;
  }
  return 1.4;
}

// Split a provider quote into what the customer pays for the goods and what they
// pay to ship them. `summed` is a provider quote: { totalMinor, itemsMinor?,
// shippingMinor? }. A provider that reports no shipping (Printify without a full
// address) yields shipping 0, so the caller shows a product-only price.
export function priceParts(summed, markup) {
  const shipCost = summed.shippingMinor || 0;
  const itemsCost = summed.itemsMinor != null
    ? summed.itemsMinor
    : Math.max(0, (summed.totalMinor || 0) - shipCost);
  const printingMinor = Math.ceil((itemsCost * safeMarkup(markup)) / 100) * 100;
  const shippingMinor = Math.ceil(shipCost / 100) * 100;
  return { printingMinor, shippingMinor, totalMinor: printingMinor + shippingMinor };
}

// Product-only price, for a "From $X" shown before any destination is known.
export function priceFromQuote(quoteCostMinor, markup) {
  return Math.ceil((quoteCostMinor * safeMarkup(markup)) / 100) * 100;
}

/* Split `total` across `weights` so the parts are proportional AND sum to it
   exactly: floor each share, then hand the leftover minor units to the largest
   remainders. Used wherever a charged figure has to be shown broken down — per
   line, per parcel — so a breakdown on screen can never disagree with what is
   actually billed. Returns null when the weights carry no signal, so the caller
   can choose its own fallback. */
export function splitMinor(weights, total) {
  const n = weights.length;
  if (!n) return [];
  if (n === 1) return [total];
  const w = weights.map((x) => Math.max(0, Number(x) || 0));
  if (w.reduce((a, v) => a + v, 0) <= 0) return null;
  const sum = w.reduce((a, v) => a + v, 0);
  const exact = w.map((x) => (x * total) / sum);
  const out = exact.map((v) => Math.floor(v));
  let left = total - out.reduce((a, v) => a + v, 0);
  exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => { if (left > 0) { out[i] += 1; left -= 1; } });
  return out;
}

// A { amount, currency } money object from a provider, as minor units. Pure —
// unlike the closure inside sumQuoteMinor, it does not adopt the currency it
// sees, so parsing a sub-total can never change the order's currency.
function amountMinor(p) {
  const amount = p?.amount ?? p?.Amount;
  if (amount == null) return 0;
  const n = Math.round(parseFloat(amount) * 100);
  return Number.isFinite(n) ? n : 0;
}

/* Prodigi names a carrier as an object with a name and a service ("UPS" +
   "Ground Shipping"); other shapes send a bare string. The customer should see
   the words that will be on the label, without the name repeated when the
   service already carries it. */
function carrierName(c) {
  if (!c) return null;
  if (typeof c === 'string') return c.trim() || null;
  const name = String(c.name ?? c.Name ?? '').trim();
  const service = String(c.service ?? c.Service ?? '').trim();
  if (!service) return name || null;
  if (!name || service.toLowerCase().startsWith(name.toLowerCase())) return service;
  return `${name} ${service}`;
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

  let currency = 'USD';
  const minor = (p) => {
    if (!p) return 0;
    const amount = p.amount ?? p.Amount;
    if (amount == null) return 0;
    currency = p.currency || p.Currency || currency;
    return Math.round(parseFloat(amount) * 100);
  };
  // Kept apart, not just summed: checkout shows shipping on its own line, and
  // on a small print it is most of the cost — worth the customer seeing.
  const itemsMinor = minor(cs.items);
  const shippingMinor = minor(cs.shipping);

  /* Per-line goods costs, in the order the items were sent. Used only to weight
     a mixed-type group's markup (see cart.groupMarkup). Prodigi's per-item
     `unitCost` does not always sum to costSummary.items, so these are treated as
     relative WEIGHTS, never as authoritative amounts — costSummary stays the
     source of truth for what anything actually costs. */
  const lineItems = Array.isArray(quote.items)
    ? quote.items.map((it) => {
        const amount = it?.unitCost?.amount ?? it?.unitCost?.Amount;
        const copies = Math.max(1, parseInt(it?.copies, 10) || 1);
        const unit = amount == null ? 0 : Math.round(parseFloat(amount) * 100);
        return { sku: it?.sku || null, copies, costMinor: (Number.isFinite(unit) ? unit : 0) * copies };
      })
    : null;

  /* The parcels this order will actually arrive in. Prodigi groups a shipment by
     the LAB that makes the items, so a flat print and a framed print are made in
     different places and travel separately — each with its own carrier and its
     own rate. We were already receiving this array on every quote and throwing
     it away, which is how the cart came to tell a customer "one parcel" while
     two were on the way. Display only: costSummary stays the source of truth for
     what anything costs, and these are treated as weights the same way
     `lineItems` is. */
  const parcels = Array.isArray(quote.shipments) && quote.shipments.length
    ? quote.shipments.map((s) => ({
        carrier: carrierName(s?.carrier),
        labCode: s?.fulfillmentLocation?.labCode ?? s?.fulfillmentLocation?.LabCode ?? null,
        costMinor: amountMinor(s?.cost),
      }))
    : null;

  return { totalMinor: itemsMinor + shippingMinor, itemsMinor, shippingMinor, currency, lineItems, parcels };
}
