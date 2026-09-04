// Card products: formats, merchandising taxonomy, and the text-zone model.
//
// THE THREE LAYERS (this is the whole idea — keep them separate):
//
//   1. FORMAT  — the physical thing we buy from a provider. There are ~3 of these,
//                ever. A format binds to exactly one provider SKU/variant.
//   2. TEMPLATE— a design: photo slots + text zones + palette, laid out on a format.
//                There can be hundreds. Adding one is data, not code.
//   3. CATEGORY— a merchandising query over template tags. "Pet Christmas Cards" is
//                NOT a product; it is `tags ⊇ {christmas, pet}`. Adding a category
//                costs one entry in OCCASIONS and zero engineering.
//
// Shutterfly's ~40 nav links resolve to a handful of physical cards. We mirror that:
// one flat 5x7 SKU can serve Christmas, Thanksgiving, New Year, birth announcements,
// graduation and save-the-dates — the difference is entirely template + copy.
//
// Loaded via dynamic import() from the CJS API routes (same ERR_REQUIRE_ESM rule as
// catalog.mjs). Pure data + pure functions: no network, no DOM, so both the browser
// builder and the server price/validate path can share it.

// ─────────────────────────────────────────────────────────────────────────────
// 1. FORMATS — flat only. US photo-card buyers do not buy folded cards.
// ─────────────────────────────────────────────────────────────────────────────
// `aspect` is width/height of the TRIMMED card. `bleedIn` is added on every edge
// for the print asset; the editor shows the trim box and keeps text inside `safeIn`.
export const CARD_FORMATS = {
  'flat-5x7': {
    id: 'flat-5x7', label: 'Flat Card 5×7"', wIn: 5, hIn: 7, aspect: 5 / 7,
    orientations: ['portrait', 'landscape'], bleedIn: 0.125, safeIn: 0.25,
    duplex: true,   // back is printable — this is where the Popcode panel goes
    dpi: 300,
  },
  'flat-5.5sq': {
    id: 'flat-5.5sq', label: 'Flat Card 5.5×5.5"', wIn: 5.5, hIn: 5.5, aspect: 1,
    orientations: ['square'], bleedIn: 0.125, safeIn: 0.25, duplex: true, dpi: 300,
  },
};

// TRIM vs BLEED — two different rectangles, and they do NOT share an aspect ratio.
//   TRIM  = the finished, cut card. ALL template geometry is fractions of THIS.
//   BLEED = trim + bleedIn on every edge; this is the file the provider wants.
// A 5x7 trims at 0.714 but bleeds at 1575x2175 = 0.724. Hand a renderer bleed
// pixels while it lays out against trim fractions and every line of type lands
// slightly wrong — so the two sizes get two clearly-named functions, and
// renderCard() only ever draws TRIM. The print bake draws the trim card, then
// outsets full-bleed art by bleedFrac onto the larger canvas.
function inches(formatId, orientation) {
  const f = CARD_FORMATS[formatId];
  if (!f) return null;
  const land = orientation === 'landscape';
  return { f, wIn: land ? f.hIn : f.wIn, hIn: land ? f.wIn : f.hIn };
}

export function cardTrimSize(formatId, orientation = 'portrait') {
  const d = inches(formatId, orientation);
  if (!d) return null;
  return { w: Math.round(d.wIn * d.f.dpi), h: Math.round(d.hIn * d.f.dpi), dpi: d.f.dpi };
}

export function cardBleedSize(formatId, orientation = 'portrait') {
  const d = inches(formatId, orientation);
  if (!d) return null;
  const b = d.f.bleedIn;
  return {
    w: Math.round((d.wIn + b * 2) * d.f.dpi),
    h: Math.round((d.hIn + b * 2) * d.f.dpi),
    dpi: d.f.dpi,
    // Where the trim box sits inside the bleed canvas, and how far full-bleed
    // art must be outset (as a fraction of trim) to reach the bleed edge.
    offsetX: Math.round(b * d.f.dpi),
    offsetY: Math.round(b * d.f.dpi),
    bleedFracX: b / d.wIn,
    bleedFracY: b / d.hIn,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TAXONOMY — the storefront nav. Groups mirror Shutterfly's card menu.
// ─────────────────────────────────────────────────────────────────────────────
// Each occasion is a NAMED QUERY: `tags` are ANDed against a template's tags.
// `group` is only the nav column it renders under. Adding "Newlywed Christmas
// Cards" = one line here + tagging a few templates `newlywed`.
export const OCCASIONS = [
  // — Christmas & Holiday —
  { id: 'christmas',      label: 'Christmas Cards',        group: 'Christmas & Holiday Cards', tags: ['christmas'] },
  { id: 'holiday',        label: 'Holiday Cards',          group: 'Christmas & Holiday Cards', tags: ['holiday'] },
  { id: 'religious-xmas', label: 'Religious Christmas',    group: 'Christmas & Holiday Cards', tags: ['christmas', 'religious'] },
  { id: 'new-year',       label: "New Year's Cards",       group: 'Christmas & Holiday Cards', tags: ['newyear'] },
  { id: 'thanksgiving',   label: 'Thanksgiving Cards',     group: 'Christmas & Holiday Cards', tags: ['thanksgiving'] },
  { id: 'holiday-party',  label: 'Holiday Party Invites',  group: 'Christmas & Holiday Cards', tags: ['holiday', 'invitation'] },

  // — By theme (same SKU, different design) —
  { id: 'baby-first-xmas',label: "Baby's First Christmas", group: 'Christmas Cards By Theme',  tags: ['christmas', 'baby'] },
  { id: 'newlywed-xmas',  label: 'Newlywed Christmas',     group: 'Christmas Cards By Theme',  tags: ['christmas', 'newlywed'] },
  { id: 'pet-xmas',       label: 'Pet Christmas Cards',    group: 'Christmas Cards By Theme',  tags: ['christmas', 'pet'] },
  { id: 'year-in-review', label: 'Year in Review',         group: 'Christmas Cards By Theme',  tags: ['christmas', 'multiphoto'] },
  { id: 'xmas-moving',    label: 'Christmas Moving',       group: 'Christmas Cards By Theme',  tags: ['christmas', 'moving'] },

  // — Announcements —
  { id: 'birth',          label: 'Birth Announcements',    group: 'Announcements',             tags: ['birth'] },
  { id: 'graduation-ann', label: 'Graduation Announcements',group: 'Announcements',            tags: ['graduation'] },
  { id: 'moving',         label: 'Moving Announcements',   group: 'Announcements',             tags: ['moving'] },
  { id: 'save-the-date',  label: 'Save The Date Cards',    group: 'Announcements',             tags: ['savethedate'] },

  // — Invitations —
  { id: 'birthday-inv',   label: 'Birthday Invitations',   group: 'Invitations',               tags: ['birthday', 'invitation'] },
  { id: 'baby-shower',    label: 'Baby Shower Invitations',group: 'Invitations',               tags: ['babyshower', 'invitation'] },
  { id: 'graduation-inv', label: 'Graduation Invitations', group: 'Invitations',               tags: ['graduation', 'invitation'] },

  // — Everyday —
  { id: 'thank-you',      label: 'Thank You Cards',        group: 'Shop by Occasion',          tags: ['thankyou'] },
  { id: 'birthday',       label: 'Birthday Cards',         group: 'Shop by Occasion',          tags: ['birthday'] },
];

export const OCCASION_GROUPS = [...new Set(OCCASIONS.map((o) => o.group))];
export function occasionById(id) { return OCCASIONS.find((o) => o.id === id) || null; }

// ─────────────────────────────────────────────────────────────────────────────
// 3. TEXT ZONES — "Happy Holidays" / "Love, the Middletons"
// ─────────────────────────────────────────────────────────────────────────────
// A template declares named zones. The buyer edits the STRING; the template owns
// the typography. That is the whole trick — it is why 200 designs don't become 200
// text-layout bugs, and why a buyer can't make an ugly card.
//
// Geometry is expressed as a FRACTION OF THE TRIMMED CARD, never pixels:
//   x/y     — anchor point (y is the text baseline block's top)
//   size    — cap height as a fraction of card HEIGHT
//   maxW    — wrap width as a fraction of card WIDTH
// One set of numbers therefore drives BOTH the on-screen editor and the 300 DPI
// print bake, so what they type is exactly what prints. Same discipline as
// book.html's cqw-based cover, which is why that one survives proof + print.
//
// `role` gives the editor its label and sane limits; `default` is the copy the
// template ships with, so an untouched card still reads correctly.
// `maxLines` is the layout contract: a zone may wrap up to this many lines and no
// further. The renderer shrinks the type to honour it rather than letting a long
// greeting overflow into the signature below — the one failure mode that would
// otherwise reach print. Char limits alone can't prevent this ("Wishing You a
// Merry Christmas" is 29 chars but far wider than "2026").
export const TEXT_ROLES = {
  headline:  { label: 'Greeting',   maxChars: 34,  maxLines: 2, hint: 'Happy Holidays' },
  subhead:   { label: 'Second line',maxChars: 48,  maxLines: 2, hint: 'Wishing you joy' },
  signature: { label: 'Signature',  maxChars: 44,  maxLines: 1, hint: 'Love, the Middletons' },
  year:      { label: 'Year',       maxChars: 9,   maxLines: 1, hint: '2026' },
  message:   { label: 'Message',    maxChars: 240, maxLines: 6, hint: 'A note on the back' },
};

const zone = (id, role, dflt, geom) => ({
  id, role, default: dflt,
  font: 'cormorant', weight: 400, color: '#1A1814', align: 'center',
  ...geom,
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. TEMPLATES — the design library. Pure data: add designs without touching code.
// ─────────────────────────────────────────────────────────────────────────────
// `photos` are slots on the FRONT, same fractional geometry. `tags` are what the
// OCCASIONS queries match on. `popcodeSlot` names which photo slot becomes the AR
// trigger — the card is scannable, which is the entire reason Popcode sells cards
// and Shutterfly can't.
export const CARD_TEMPLATES = [
  {
    id: 'xmas-classic-full',
    name: 'Classic Full Bleed',
    formatId: 'flat-5x7', orientation: 'portrait',
    tags: ['christmas', 'holiday', 'baby', 'pet', 'newlywed'],
    palette: { ink: '#FFFFFF', scrim: 0.34 },
    photos: [{ id: 'main', x: 0, y: 0, w: 1, h: 1, fit: 'cover' }],
    popcodeSlot: 'main',
    text: [
      zone('headline',  'headline',  'Happy Holidays',        { x: 0.5, y: 0.760, size: 0.072, maxW: 0.84, color: '#FFFFFF' }),
      zone('signature', 'signature', 'Love, the Middletons',  { x: 0.5, y: 0.862, size: 0.034, maxW: 0.80, color: '#FFFFFF', font: 'inter' }),
    ],
  },
  {
    id: 'xmas-band-bottom',
    name: 'Photo with Type Band',
    formatId: 'flat-5x7', orientation: 'portrait',
    tags: ['christmas', 'holiday', 'newyear', 'baby', 'pet'],
    palette: { ink: '#1A1814', band: '#F7F6F2' },
    photos: [{ id: 'main', x: 0, y: 0, w: 1, h: 0.74, fit: 'cover' }],
    popcodeSlot: 'main',
    text: [
      zone('headline',  'headline',  'Merry Christmas',       { x: 0.5, y: 0.792, size: 0.062, maxW: 0.86 }),
      zone('signature', 'signature', 'The Middletons',        { x: 0.5, y: 0.884, size: 0.030, maxW: 0.80, font: 'inter', color: '#5C574E' }),
    ],
  },
  {
    id: 'yir-four-up',
    name: 'Year in Review — Four Photos',
    formatId: 'flat-5x7', orientation: 'portrait',
    tags: ['christmas', 'holiday', 'multiphoto', 'newyear'],
    palette: { ink: '#1A1814', band: '#FFFFFF' },
    photos: [
      { id: 'p1', x: 0.06, y: 0.06,  w: 0.42, h: 0.30, fit: 'cover' },
      { id: 'p2', x: 0.52, y: 0.06,  w: 0.42, h: 0.30, fit: 'cover' },
      { id: 'p3', x: 0.06, y: 0.38,  w: 0.42, h: 0.30, fit: 'cover' },
      { id: 'p4', x: 0.52, y: 0.38,  w: 0.42, h: 0.30, fit: 'cover' },
    ],
    popcodeSlot: 'p1',
    text: [
      zone('headline',  'headline',  '2026',                  { x: 0.5, y: 0.740, size: 0.085, maxW: 0.86 }),
      zone('subhead',   'subhead',   'What a year it has been',{ x: 0.5, y: 0.842, size: 0.030, maxW: 0.82, font: 'inter', color: '#5C574E' }),
      zone('signature', 'signature', 'Love, the Middletons',  { x: 0.5, y: 0.896, size: 0.030, maxW: 0.82, font: 'inter', color: '#5C574E' }),
    ],
  },
  {
    id: 'birth-simple',
    name: 'Introducing',
    formatId: 'flat-5x7', orientation: 'portrait',
    tags: ['birth', 'baby'],
    palette: { ink: '#1A1814', band: '#F7F6F2' },
    photos: [{ id: 'main', x: 0, y: 0, w: 1, h: 0.70, fit: 'cover' }],
    popcodeSlot: 'main',
    text: [
      zone('subhead',   'subhead',   'Introducing',           { x: 0.5, y: 0.744, size: 0.028, maxW: 0.80, font: 'inter', color: '#5C574E' }),
      zone('headline',  'headline',  'Adelaide Rose',         { x: 0.5, y: 0.790, size: 0.066, maxW: 0.86 }),
      zone('signature', 'signature', 'March 4, 2026 · 7lb 2oz',{ x: 0.5, y: 0.888, size: 0.028, maxW: 0.82, font: 'inter', color: '#5C574E' }),
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 5. QUERIES — how a category page gets its designs.
// ─────────────────────────────────────────────────────────────────────────────
export function templatesForOccasion(occasionId) {
  const occ = occasionById(occasionId);
  if (!occ) return [];
  return CARD_TEMPLATES.filter((t) => occ.tags.every((tag) => t.tags.includes(tag)));
}
export function templateById(id) { return CARD_TEMPLATES.find((t) => t.id === id) || null; }

// Occasions that actually have designs — the storefront should never render a
// category that leads to an empty grid.
export function occasionsWithCounts() {
  return OCCASIONS
    .map((o) => ({ ...o, count: templatesForOccasion(o.id).length }))
    .filter((o) => o.count > 0);
}

// Merge buyer-entered strings over a template's defaults, clamped to the role's
// limit. Server-safe: the print bake calls this too, so a client can't smuggle a
// 10,000-character "signature" into a 300 DPI render.
export function resolveText(template, values = {}) {
  return (template.text || []).map((z) => {
    const raw = Object.prototype.hasOwnProperty.call(values, z.id) ? values[z.id] : z.default;
    const max = (TEXT_ROLES[z.role] || {}).maxChars || 120;
    return { ...z, value: String(raw == null ? '' : raw).slice(0, max) };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PACKS — US card buyers buy 25/50/75/100, and expect the unit price to fall.
// ─────────────────────────────────────────────────────────────────────────────
// `discount` is a MERCHANDISING cut off the marked-up retail price, not off cost.
// Provider cost still scales with quantity, so cardPackPrice() floors the result
// just above cost: a tier discount eats margin, never principal. Same posture as
// the shipping-inclusive markup — we can be cheap, we can't be underwater.
export const CARD_PACKS = [
  { qty: 25,  discount: 0    },
  { qty: 50,  discount: 0.10 },
  { qty: 75,  discount: 0.15 },
  { qty: 100, discount: 0.20 },
];
export const DEFAULT_PACK = 50;
export function isValidPack(qty) { return CARD_PACKS.some((p) => p.qty === Number(qty)); }

// quoteCostMinor = provider cost for the WHOLE pack (product + shipping).
// Returns the whole-dollar retail total, matching priceFromQuote's rounding so
// the displayed price and the charged amount can never disagree.
export function cardPackPrice(quoteCostMinor, qty, markup) {
  const tier = CARD_PACKS.find((p) => p.qty === Number(qty));
  if (!tier) return null;
  const m = Number(markup);
  const safeMarkup = Number.isFinite(m) && m > 0 ? m : 1.4;
  const discounted = quoteCostMinor * safeMarkup * (1 - tier.discount);
  const floored = Math.max(discounted, quoteCostMinor * 1.05);
  return Math.ceil(floored / 100) * 100;
}
export function perCardMinor(totalMinor, qty) {
  return qty > 0 ? Math.round(totalMinor / qty) : null;
}
