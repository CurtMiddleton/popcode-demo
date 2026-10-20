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
    // District Photo's print area (Printify 10717), which is the full 1/8in
    // bleed top and bottom but only ~1/16in at the sides. toBleed() crops to it.
    printPx: { w: 1538, h: 2175 },
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
  headline:  { label: 'Greeting',   maxChars: 44,  maxLines: 2, hint: 'Happy Holidays' },
  subhead:   { label: 'Second line',maxChars: 48,  maxLines: 2, hint: 'Wishing you joy' },
  signature: { label: 'Signature',  maxChars: 44,  maxLines: 1, hint: 'Love, the Middletons' },
  year:      { label: 'Year',       maxChars: 9,   maxLines: 1, hint: '2026' },
  message:   { label: 'Message',    maxChars: 240, maxLines: 6, hint: 'A note on the back' },
};

// `color` is a COLOURWAY ROLE ('ink' | 'accent' | 'onPhoto'), not a hex — that's
// what lets one swatch click recolour every zone coherently. `track` is letter
// spacing as a fraction of font size; `upper` uppercases for display settings.
const zone = (id, role, dflt, geom) => ({
  id, role, default: dflt,
  font: 'cormorant', weight: 400, color: 'ink', align: 'center',
  track: 0, upper: false,
  // Leading and finish are per-zone: display lines want tight leading, and a
  // foil finish applies to one line (a whole card in foil looks like a novelty).
  lead: null, finish: 'flat',
  // `lines` overrides the role's maxLines for this zone. Big display type is
  // single-line by intent — letting "Happy Holidays" wrap to two lines at
  // size 0.098 pushes it straight through the signature underneath it.
  lines: null,
  // `sample`: the default is an example a buyer must replace (a family name,
  // a baby's name and birth date). card.html won't save while one is unchanged.
  sample: false,
  italic: false,
  ...geom,
});

// ─────────────────────────────────────────────────────────────────────────────
// 3b. TYPE + COLOUR + ORNAMENT — the "sticker" layer laid over the photo
// ─────────────────────────────────────────────────────────────────────────────
// LICENSING (see docs/cards-plan.md — this constrains what we may ship):
// A card builder is a print-on-demand product configurator, and the big stock
// marketplaces specifically PROHIBIT that use. Envato Elements bars items in
// "a print-on-demand service, a custom product configurator, or any similar
// build-your-own or made-to-order workflow"; Creative Market's Extended
// Commercial licence bars letting "anyone other than the Licensee (such as an
// End User) customize a digital or physical End Product". So neither can supply
// our decorative art, however convenient they look.
//
// What IS safe, and what everything below is built from:
//   1. SIL OFL / Apache fonts (Google Fonts, Fontshare). The OFL restricts
//      selling the FONT, not products typeset with it, and has no POD carve-out.
//   2. Ornament we DRAW OURSELVES as code (below). Zero licence surface.
//   3. Public-domain / CC0 art, and commissioned work-for-hire, when we want
//      illustration beyond what code can draw.
// Great Vibes was the tell. It is the most-used free script on the internet --
// every Etsy wedding template, every canva invite -- so it reads as a stock
// template no matter how good the photo is. Ballet is the same register with far
// less mileage. Bodoni Moda is the high-contrast didone that does most of the
// work in premium stationery (Vogue, Minted); Fraunces is the modern editorial
// serif. All SIL OFL, so all safe for a POD configurator (see the licence note).
export const FONTS = {
  hand:      { label: 'Handwritten', css: "'Mrs Saint Delafield', 'Snell Roundhand', cursive", google: 'Mrs+Saint+Delafield' },
  script:    { label: 'Script',    css: "'Ballet', 'Snell Roundhand', cursive",       google: 'Ballet' },
  didone:    { label: 'Didone',    css: "'Bodoni Moda', 'Didot', serif",              google: 'Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,600;1,6..96,400' },
  editorial: { label: 'Editorial', css: "'Fraunces', Georgia, serif",                 google: 'Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;1,9..144,300' },
  serif:     { label: 'Serif',     css: "'Playfair Display', Georgia, serif",         google: 'Playfair+Display:ital,wght@0,400;0,600;1,400' },
  cormorant: { label: 'Garamond',  css: "'Cormorant Garamond', Garamond, serif",      google: 'Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400' },
  cinzel:    { label: 'Engraved',  css: "'Cinzel', 'Trajan Pro', serif",              google: 'Cinzel:wght@400;600' },
  grotesk:   { label: 'Grotesk',   css: "'Jost', 'Futura', sans-serif",               google: 'Jost:wght@300;400;500' },
  sans:      { label: 'Sans',      css: "'Inter', sans-serif",                        google: null },
};

// ── The measurements that separate a $1 card from a $4 one ─────────────────
// Arbitrary y-values were the second tell. Premium stationery sits on a system:
// one optical margin, a modular size scale, and leading that TIGHTENS as type
// grows. The old code used lead 1.15 for everything, which makes a 13% display
// line look loose and slack -- display wants ~1.02, small text wants ~1.4.
export const TYPE = {
  margin: 0.075,                              // fraction of card WIDTH, all sides
  measure: 0.85,                              // default content width (1 - 2*margin)
  display: { xl: 0.150, lg: 0.118, md: 0.092, sm: 0.072 },
  body:    { lg: 0.034, md: 0.028, sm: 0.023 },
  lead:    { display: 1.02, mid: 1.18, body: 1.40 },
  // Tracking: display lowercase wants slightly NEGATIVE (it sets loose at size);
  // caps always want generous positive or they clot together.
  track:   { display: -0.015, caps: 0.16, capsWide: 0.28 },
};

// Foil is the single biggest perceived-value lever available in pure CSS, and
// it is exactly what Shutterfly upcharges for ("AVAILABLE IN FOIL"). A metallic
// is a GRADIENT, never a flat gold -- the bands are what read as reflection.
export const FINISHES = {
  flat:   { label: 'Flat' },
  gold:   { label: 'Gold Foil',   gradient: 'linear-gradient(100deg,#8a6a2f 0%,#d9b45e 17%,#f7e9b0 33%,#c99b3f 50%,#f2dc98 67%,#b98c33 84%,#7d5f28 100%)' },
  rose:   { label: 'Rose Foil',   gradient: 'linear-gradient(100deg,#8c5245 0%,#d69b88 17%,#f6ddd2 33%,#c07f6b 50%,#efd0c2 67%,#b0705c 84%,#7d4739 100%)' },
  silver: { label: 'Silver Foil', gradient: 'linear-gradient(100deg,#6e727a 0%,#b8bec7 17%,#eef1f5 33%,#9aa1ab 50%,#e2e6ec 67%,#8b929c 84%,#63676e 100%)' },
};

// Colourways are the swatch row on a storefront card. A template lists the ones
// it supports; the buyer picks one and every zone that references a palette role
// recolours together, so a family can't assemble an ugly combination.
export const COLORWAYS = {
  cream:    { label: 'Cream',    ground: '#F4F1EA', ink: '#2C2A26', accent: '#8A7F6B', onPhoto: '#FFFFFF' },
  sage:     { label: 'Sage',     ground: '#E4E9E0', ink: '#33402F', accent: '#6F8466', onPhoto: '#FFFFFF' },
  midnight: { label: 'Midnight', ground: '#1E2A38', ink: '#F2F0EA', accent: '#9DB2C4', onPhoto: '#FFFFFF' },
  burgundy: { label: 'Burgundy', ground: '#5C1F26', ink: '#F6EDE6', accent: '#C89B78', onPhoto: '#FFFFFF' },
  blush:    { label: 'Blush',    ground: '#F3E3DE', ink: '#4A3239', accent: '#B98A83', onPhoto: '#FFFFFF' },
};
// The minimal set (2026-10-20), after Minted's "simple & minimalist" holiday
// cards. Roles beyond the originals:
//   panel  the card's own colour. Plain designs are this colour all over; a
//          `frame` design shows `ground` as a border round a `panel` inset.
//   mat    the border drawn round a photo that has `mat` set.
// So 'cranberry' on a plain design is a cream card with red type; on a frame
// design it's a red card with a cream panel.
Object.assign(COLORWAYS, {
  snow:      { label: 'White',     ground: '#FFFFFF', panel: '#FFFFFF', ink: '#1F1F1F', accent: '#6F6B64', mat: '#1F1F1F', onPhoto: '#FFFFFF' },
  ivory:     { label: 'Ivory',     ground: '#F4EFE4', panel: '#F4EFE4', ink: '#2B2A27', accent: '#857F73', mat: '#2B2A27', onPhoto: '#FFFFFF' },
  cranberry: { label: 'Red',       ground: '#A8232B', panel: '#F7F3EA', ink: '#A8232B', accent: '#A8232B', mat: '#A8232B', onPhoto: '#FFFFFF' },
  evergreen: { label: 'Green',     ground: '#2E4A3A', panel: '#F4F1E8', ink: '#2E4A3A', accent: '#5E7566', mat: '#2E4A3A', onPhoto: '#FFFFFF' },
  navy:      { label: 'Navy',      ground: '#1F2B44', panel: '#F4F2EC', ink: '#1F2B44', accent: '#5B6478', mat: '#1F2B44', onPhoto: '#FFFFFF' },
  sage:      { label: 'Sage',      ground: '#9DAA8F', panel: '#FFFFFF', ink: '#2F3A2A', accent: '#6E7B62', mat: '#9DAA8F', onPhoto: '#FFFFFF' },
  ink:       { label: 'Black',     ground: '#1E1E1F', panel: '#1E1E1F', ink: '#F4F2EC', accent: '#A9A49B', mat: '#F4F2EC', onPhoto: '#FFFFFF' },
});
export const DEFAULT_COLORWAY = 'snow';

// Ornaments are DRAWN IN CODE (SVG paths generated by card.html), never licensed
// art — so they recolour with the colourway for free and carry no licence risk.
export const ORNAMENTS = ['none', 'arch', 'branches', 'snow', 'frame', 'confetti'];

// ─────────────────────────────────────────────────────────────────────────────
// 4. TEMPLATES — the design library. Pure data: add designs without touching code.
// ─────────────────────────────────────────────────────────────────────────────
// `photos` are slots on the FRONT, same fractional geometry. `tags` are what the
// OCCASIONS queries match on. `popcodeSlot` names which photo slot becomes the AR
// trigger — the card is scannable, which is the entire reason Popcode sells cards
// and Shutterfly can't.
export const CARD_TEMPLATES = [
  // ── The minimal set (2026-10-20) ─────────────────────────────────────────
  // After the user's Minted "simple & minimalist" references: tiny, widely
  // tracked capitals (often ABOVE the photo), a handwritten name, square
  // photos with a thin rule or a coloured mat, red / green / navy frames round
  // a cream panel. No drawn ornament, no foil. Replaced the first eight
  // designs (snow, laurels, gold), which read as too busy.
  //
  // A fraction of WIDTH is 5in and of HEIGHT 7in on a 5x7, so equal margins
  // are x 0.05 / y 0.036 (both 1/4in), and a square photo of w 0.66 has h 0.471.
  // Photo `mat` is the border width as a fraction of card width.
  {
    id: 'm-typewriter',
    name: 'Typewriter',
    formatId: 'flat-5x7', orientation: 'portrait',
    tags: ['christmas', 'holiday', 'newyear', 'baby', 'pet', 'newlywed'],
    ground: 'inset', ornament: 'none', photoEdge: 'square',
    colorways: ['ivory', 'snow', 'cranberry', 'evergreen', 'navy', 'ink'],
    photos: [{ id: 'main', x: 0.10, y: 0.095, w: 0.80, h: 0.775, fit: 'cover', mat: 0.003 }],
    popcodeSlot: 'main',
    text: [
      zone('headline',  'headline',  'happy holidays',   { x: 0.5, y: 0.040, size: 0.022, maxW: 0.80, color: 'ink', font: 'cormorant', weight: 500, track: 0.22, lead: 1.30, lines: 1 }),
      zone('signature', 'signature', 'the millers 2026', { sample: true, x: 0.5, y: 0.905, size: 0.019, maxW: 0.80, color: 'accent', font: 'cormorant', weight: 500, track: 0.22, lead: 1.30 }),
    ],
  },
  {
    id: 'm-minimal',
    name: 'Minimal Border',
    formatId: 'flat-5x7', orientation: 'portrait',
    tags: ['christmas', 'holiday', 'newyear', 'newlywed', 'pet'],
    ground: 'inset', ornament: 'none', photoEdge: 'square',
    colorways: ['sage', 'snow', 'cranberry', 'evergreen', 'navy', 'ivory'],
    photos: [{ id: 'main', x: 0.19, y: 0.175, w: 0.62, h: 0.56, fit: 'cover', mat: 0.026 }],
    popcodeSlot: 'main',
    text: [
      zone('headline',  'headline',  'WISHING YOU THE VERY HAPPIEST HOLIDAYS', { x: 0.5, y: 0.072, size: 0.0145, maxW: 0.50, color: 'ink', font: 'cormorant', weight: 600, track: 0.36, upper: true, lead: 1.70, lines: 2 }),
      zone('signature', 'signature', 'THE MARTINS — 2026', { sample: true, x: 0.5, y: 0.862, size: 0.0135, maxW: 0.70, color: 'ink', font: 'grotesk', weight: 500, track: 0.34, upper: true, lead: 1.40 }),
    ],
  },
  {
    id: 'm-frame',
    name: 'Colour Frame',
    formatId: 'flat-5x7', orientation: 'portrait',
    tags: ['christmas', 'holiday', 'newlywed', 'baby', 'pet'],
    ground: 'inset', ornament: 'none', photoEdge: 'square',
    frame: { x: 0.055, y: 0.039, w: 0.89, h: 0.922 },
    colorways: ['cranberry', 'evergreen', 'navy', 'sage'],
    photos: [{ id: 'main', x: 0.16, y: 0.135, w: 0.68, h: 0.64, fit: 'cover' }],
    popcodeSlot: 'main',
    text: [
      zone('headline',  'headline',  'HAPPIEST HOLIDAYS', { x: 0.5, y: 0.082, size: 0.0155, maxW: 0.72, color: 'ink', font: 'grotesk', weight: 500, track: 0.36, upper: true, lead: 1.40, lines: 1 }),
      zone('signature', 'signature', 'JACK + COOPER · 2026', { sample: true, x: 0.5, y: 0.818, size: 0.0145, maxW: 0.72, color: 'ink', font: 'grotesk', weight: 500, track: 0.34, upper: true, lead: 1.40 }),
    ],
  },
  {
    id: 'm-modern',
    name: 'Modern Frame',
    formatId: 'flat-5x7', orientation: 'portrait',
    tags: ['christmas', 'holiday', 'newyear', 'newlywed', 'pet'],
    ground: 'inset', ornament: 'none', photoEdge: 'square',
    colorways: ['snow', 'ivory', 'cranberry', 'evergreen', 'navy', 'sage'],
    photos: [{ id: 'main', x: 0.18, y: 0.165, w: 0.64, h: 0.60, fit: 'cover', mat: 0.03 }],
    popcodeSlot: 'main',
    text: [
      zone('headline',  'headline',  'HAPPIEST',      { x: 0.15, y: 0.085, size: 0.0135, maxW: 0.34, color: 'ink', font: 'grotesk', weight: 500, track: 0.34, upper: true, align: 'left', lead: 1.40, lines: 1 }),
      zone('subhead',   'subhead',   'HOLIDAYS',      { x: 0.85, y: 0.085, size: 0.0135, maxW: 0.34, color: 'ink', font: 'grotesk', weight: 500, track: 0.34, upper: true, align: 'right', lead: 1.40, lines: 1 }),
      zone('signature', 'signature', 'THE ROBINSONS', { sample: true, x: 0.15, y: 0.845, size: 0.0135, maxW: 0.46, color: 'ink', font: 'grotesk', weight: 500, track: 0.34, upper: true, align: 'left', lead: 1.40, lines: 1 }),
      zone('year',      'year',      '2026',          { x: 0.85, y: 0.845, size: 0.0135, maxW: 0.24, color: 'ink', font: 'grotesk', weight: 500, track: 0.34, upper: true, align: 'right', lead: 1.40, lines: 1 }),
    ],
  },
  {
    id: 'm-quartet',
    name: 'Quartet',
    formatId: 'flat-5x7', orientation: 'portrait',
    tags: ['christmas', 'holiday', 'newyear', 'multiphoto'],
    ground: 'inset', ornament: 'none', photoEdge: 'square', fill: 'ground',
    colorways: ['evergreen', 'cranberry', 'navy', 'ink'],
    photos: [
      { id: 'p1', x: 0.14,  y: 0.095, w: 0.355, h: 0.40,  fit: 'cover' },
      { id: 'p2', x: 0.505, y: 0.095, w: 0.355, h: 0.195, fit: 'cover' },
      { id: 'p3', x: 0.505, y: 0.30,  w: 0.355, h: 0.195, fit: 'cover' },
      { id: 'p4', x: 0.14,  y: 0.505, w: 0.72,  h: 0.30,  fit: 'cover' },
    ],
    popcodeSlot: 'p1',
    text: [
      zone('headline',  'headline',  'HAPPY HOLIDAYS',        { x: 0.5, y: 0.048, size: 0.0135, maxW: 0.72, color: 'panel', font: 'cormorant', weight: 600, track: 0.42, upper: true, lead: 1.40, lines: 1 }),
      zone('signature', 'signature', 'the bradfords — 2026', { sample: true, x: 0.5, y: 0.845, size: 0.021, maxW: 0.72, color: 'panel', font: 'cormorant', weight: 500, italic: true, track: 0.12, lead: 1.30 }),
    ],
  },
  {
    id: 'm-pacifique',
    name: 'Pacifique',
    formatId: 'flat-5x7', orientation: 'portrait',
    tags: ['christmas', 'holiday', 'newyear', 'pet', 'newlywed', 'baby'],
    ground: 'bleed', ornament: 'none', scrim: 0.14,
    colorways: ['snow'],
    photos: [{ id: 'main', x: 0, y: 0, w: 1, h: 1, fit: 'cover' }],
    popcodeSlot: 'main',
    text: [
      zone('headline',  'headline',  'HAPPY HOLIDAYS',    { x: 0.5, y: 0.792, size: 0.030, maxW: 0.84, color: 'onPhoto', font: 'cormorant', weight: 500, track: 0.24, upper: true, lead: 1.20, lines: 1 }),
      zone('signature', 'signature', 'THE LOWELL FAMILY', { sample: true, x: 0.5, y: 0.862, size: 0.012, maxW: 0.70, color: 'onPhoto', font: 'grotesk', weight: 500, track: 0.36, upper: true, lead: 1.40 }),
    ],
  },
  {
    id: 'm-everything',
    name: 'Merry Everything',
    formatId: 'flat-5x7', orientation: 'portrait',
    tags: ['christmas', 'holiday', 'baby', 'pet'],
    ground: 'bleed', ornament: 'none', scrim: 0.16,
    colorways: ['snow'],
    photos: [{ id: 'main', x: 0, y: 0, w: 1, h: 1, fit: 'cover' }],
    popcodeSlot: 'main',
    text: [
      zone('headline',  'headline',  'MERRY EVERYTHING', { x: 0.5, y: 0.760, size: 0.021, maxW: 0.60, color: 'onPhoto', font: 'grotesk', weight: 500, track: 0.40, upper: true, lead: 1.55, lines: 2 }),
      zone('signature', 'signature', 'The Parkers',      { sample: true, x: 0.5, y: 0.845, size: 0.052, maxW: 0.70, color: 'onPhoto', font: 'hand', weight: 400, lead: 1.10, lines: 1 }),
    ],
  },
  {
    id: 'm-handwritten',
    name: 'Handwritten Name',
    formatId: 'flat-5x7', orientation: 'portrait',
    tags: ['christmas', 'holiday', 'newyear', 'multiphoto', 'newlywed'],
    ground: 'inset', ornament: 'none', photoEdge: 'square',
    colorways: ['cranberry', 'snow', 'evergreen', 'navy'],
    photos: [
      { id: 'p1', x: 0.08,  y: 0.07, w: 0.415, h: 0.66, fit: 'cover' },
      { id: 'p2', x: 0.505, y: 0.07, w: 0.415, h: 0.66, fit: 'cover' },
    ],
    popcodeSlot: 'p1',
    text: [
      zone('headline',  'headline',  'HAPPY HOLIDAYS',  { x: 0.08, y: 0.800, size: 0.0155, maxW: 0.40, color: 'ink', font: 'grotesk', weight: 500, track: 0.40, upper: true, align: 'left', lead: 1.40, lines: 1 }),
      zone('signature', 'signature', 'Love, The Parks', { sample: true, x: 0.92, y: 0.772, size: 0.058, maxW: 0.42, color: 'ink', font: 'hand', weight: 400, align: 'right', lead: 1.10, lines: 1 }),
    ],
  },
  {
    id: 'm-band',
    name: 'Bottom Band',
    formatId: 'flat-5x7', orientation: 'portrait',
    tags: ['christmas', 'holiday', 'newyear', 'pet', 'baby', 'newlywed'],
    ground: 'inset', ornament: 'none', photoEdge: 'square',
    colorways: ['snow', 'ivory', 'cranberry', 'evergreen', 'ink'],
    photos: [{ id: 'main', x: 0, y: 0, w: 1, h: 0.82, fit: 'cover' }],
    popcodeSlot: 'main',
    text: [
      zone('headline',  'headline',  'Merry Christmas', { x: 0.075, y: 0.860, size: 0.040, maxW: 0.50, color: 'ink', font: 'cormorant', weight: 400, align: 'left', lead: 1.05, lines: 1 }),
      zone('signature', 'signature', 'THE MIDDLETONS',  { sample: true, x: 0.925, y: 0.877, size: 0.0135, maxW: 0.34, color: 'accent', font: 'grotesk', weight: 500, track: 0.30, upper: true, align: 'right', lead: 1.40 }),
    ],
  },

  // ── Landscape ──
  // Laid out on a 7 x 5 card: a fraction of WIDTH is 7in, of HEIGHT 5in, so
  // equal 1/4in margins are x 0.036 / y 0.05, and a square photo of w a has
  // h a * 7 / 5. Printify's print area is portrait, so card.html turns these
  // a quarter turn when it uploads them.
  {
    id: 'l-pacifique',
    name: 'Pacifique',
    formatId: 'flat-5x7', orientation: 'landscape',
    tags: ['christmas', 'holiday', 'newyear', 'pet', 'newlywed', 'baby'],
    ground: 'bleed', ornament: 'none', scrim: 0.14,
    colorways: ['snow'],
    photos: [{ id: 'main', x: 0, y: 0, w: 1, h: 1, fit: 'cover' }],
    popcodeSlot: 'main',
    text: [
      zone('headline',  'headline',  'HAPPY HOLIDAYS',    { x: 0.93, y: 0.790, size: 0.040, maxW: 0.56, color: 'onPhoto', font: 'cormorant', weight: 500, track: 0.24, upper: true, align: 'right', lead: 1.20, lines: 1 }),
      zone('signature', 'signature', 'THE LOWELL FAMILY', { sample: true, x: 0.93, y: 0.868, size: 0.016, maxW: 0.50, color: 'onPhoto', font: 'grotesk', weight: 500, track: 0.36, upper: true, align: 'right', lead: 1.40 }),
    ],
  },
  {
    id: 'l-typewriter',
    name: 'Typewriter',
    formatId: 'flat-5x7', orientation: 'landscape',
    tags: ['christmas', 'holiday', 'newyear', 'baby', 'pet', 'newlywed'],
    ground: 'inset', ornament: 'none', photoEdge: 'square',
    colorways: ['ivory', 'snow', 'cranberry', 'evergreen', 'navy', 'ink'],
    photos: [{ id: 'main', x: 0.13, y: 0.13, w: 0.74, h: 0.72, fit: 'cover', mat: 0.002 }],
    popcodeSlot: 'main',
    text: [
      zone('headline',  'headline',  'happy holidays',   { x: 0.5, y: 0.052, size: 0.030, maxW: 0.70, color: 'ink', font: 'cormorant', weight: 500, track: 0.22, lead: 1.30, lines: 1 }),
      zone('signature', 'signature', 'the millers 2026', { sample: true, x: 0.5, y: 0.885, size: 0.026, maxW: 0.70, color: 'accent', font: 'cormorant', weight: 500, track: 0.22, lead: 1.30 }),
    ],
  },
  {
    id: 'l-frame',
    name: 'Colour Frame',
    formatId: 'flat-5x7', orientation: 'landscape',
    tags: ['christmas', 'holiday', 'newlywed', 'baby', 'pet'],
    ground: 'inset', ornament: 'none', photoEdge: 'square',
    frame: { x: 0.039, y: 0.055, w: 0.922, h: 0.89 },
    colorways: ['cranberry', 'evergreen', 'navy', 'sage'],
    photos: [{ id: 'main', x: 0.20, y: 0.20, w: 0.60, h: 0.59, fit: 'cover' }],
    popcodeSlot: 'main',
    text: [
      zone('headline',  'headline',  'MERRY CHRISTMAS', { x: 0.5, y: 0.118, size: 0.021, maxW: 0.60, color: 'ink', font: 'grotesk', weight: 500, track: 0.36, upper: true, lead: 1.40, lines: 1 }),
      zone('signature', 'signature', 'THE BURCHETTES',  { sample: true, x: 0.5, y: 0.830, size: 0.020, maxW: 0.60, color: 'ink', font: 'grotesk', weight: 500, track: 0.34, upper: true, lead: 1.40 }),
    ],
  },
  {
    id: 'l-side',
    name: 'Side Note',
    formatId: 'flat-5x7', orientation: 'landscape',
    tags: ['christmas', 'holiday', 'newyear', 'pet', 'baby', 'newlywed'],
    ground: 'inset', ornament: 'none', photoEdge: 'square',
    colorways: ['snow', 'ivory', 'cranberry', 'evergreen', 'ink'],
    photos: [{ id: 'main', x: 0, y: 0, w: 0.66, h: 1, fit: 'cover' }],
    popcodeSlot: 'main',
    text: [
      zone('headline',  'headline',  'HAPPY HOLIDAYS', { x: 0.83, y: 0.400, size: 0.022, maxW: 0.22, color: 'ink', font: 'grotesk', weight: 500, track: 0.36, upper: true, lead: 1.90, lines: 2 }),
      zone('signature', 'signature', 'The Parkers',    { sample: true, x: 0.83, y: 0.530, size: 0.075, maxW: 0.28, color: 'accent', font: 'hand', weight: 400, lead: 1.10, lines: 1 }),
    ],
  },
  {
    id: 'l-strip',
    name: 'Photo Booth',
    formatId: 'flat-5x7', orientation: 'landscape',
    tags: ['christmas', 'holiday', 'newyear', 'multiphoto', 'newlywed'],
    ground: 'inset', ornament: 'none', photoEdge: 'square',
    colorways: ['cranberry', 'snow', 'evergreen', 'navy'],
    photos: [
      { id: 'p1', x: 0.07,  y: 0.10, w: 0.283, h: 0.62, fit: 'cover' },
      { id: 'p2', x: 0.3585, y: 0.10, w: 0.283, h: 0.62, fit: 'cover' },
      { id: 'p3', x: 0.647, y: 0.10, w: 0.283, h: 0.62, fit: 'cover' },
    ],
    popcodeSlot: 'p1',
    text: [
      zone('headline',  'headline',  'HAPPY HOLIDAYS',  { x: 0.07, y: 0.815, size: 0.021, maxW: 0.40, color: 'ink', font: 'grotesk', weight: 500, track: 0.42, upper: true, align: 'left', lead: 1.40, lines: 1 }),
      zone('signature', 'signature', 'Love, The Parks', { sample: true, x: 0.93, y: 0.770, size: 0.080, maxW: 0.40, color: 'ink', font: 'hand', weight: 400, align: 'right', lead: 1.10, lines: 1 }),
    ],
  },
  {
    id: 'l-gallery',
    name: 'Gallery',
    formatId: 'flat-5x7', orientation: 'landscape',
    tags: ['christmas', 'holiday', 'newyear', 'multiphoto'],
    ground: 'inset', ornament: 'none', photoEdge: 'square',
    colorways: ['ivory', 'snow', 'sage', 'ink'],
    photos: [
      { id: 'p1', x: 0.27,  y: 0.08,  w: 0.46,  h: 0.68,  fit: 'cover' },
      { id: 'p2', x: 0.06,  y: 0.08,  w: 0.20,  h: 0.335, fit: 'cover' },
      { id: 'p3', x: 0.06,  y: 0.425, w: 0.20,  h: 0.335, fit: 'cover' },
      { id: 'p4', x: 0.74,  y: 0.08,  w: 0.20,  h: 0.335, fit: 'cover' },
      { id: 'p5', x: 0.74,  y: 0.425, w: 0.20,  h: 0.335, fit: 'cover' },
    ],
    popcodeSlot: 'p1',
    text: [
      zone('headline',  'headline',  'HAPPY HOLIDAYS',       { x: 0.5, y: 0.815, size: 0.019, maxW: 0.60, color: 'ink', font: 'cormorant', weight: 600, track: 0.42, upper: true, lead: 1.40, lines: 1 }),
      zone('signature', 'signature', 'the parkers — 2026', { sample: true, x: 0.5, y: 0.868, size: 0.030, maxW: 0.60, color: 'accent', font: 'cormorant', weight: 500, italic: true, track: 0.10, lead: 1.30 }),
    ],
  },

  // ── Announcements ──
  {
    id: 'm-hello',
    name: 'Hello World',
    formatId: 'flat-5x7', orientation: 'portrait',
    tags: ['birth', 'baby'],
    ground: 'inset', ornament: 'none', photoEdge: 'square',
    colorways: ['snow', 'ivory', 'sage', 'navy'],
    photos: [{ id: 'main', x: 0.10, y: 0.07, w: 0.80, h: 0.68, fit: 'cover', mat: 0.003 }],
    popcodeSlot: 'main',
    text: [
      zone('subhead',   'subhead',   'hello, world',  { x: 0.5, y: 0.775, size: 0.044, maxW: 0.80, color: 'ink', font: 'cormorant', weight: 400, italic: true, lead: 1.05, lines: 1 }),
      zone('headline',  'headline',  'ADELAIDE ROSE', { sample: true, x: 0.5, y: 0.848, size: 0.0165, maxW: 0.84, color: 'ink', font: 'grotesk', weight: 500, track: 0.34, upper: true, lead: 1.30, lines: 1 }),
      zone('signature', 'signature', 'March 4, 2026 · 7 lbs 2 oz', { sample: true, x: 0.5, y: 0.888, size: 0.0135, maxW: 0.84, color: 'accent', font: 'grotesk', track: 0.18, lead: 1.40 }),
    ],
  },
  {
    id: 'm-date',
    name: 'Save the Date',
    formatId: 'flat-5x7', orientation: 'portrait',
    tags: ['savethedate'],
    ground: 'inset', ornament: 'none', photoEdge: 'square',
    frame: { x: 0.055, y: 0.039, w: 0.89, h: 0.922 },
    colorways: ['evergreen', 'cranberry', 'navy', 'sage'],
    photos: [{ id: 'main', x: 0.14, y: 0.12, w: 0.72, h: 0.60, fit: 'cover' }],
    popcodeSlot: 'main',
    text: [
      zone('subhead',   'subhead',   'save the date', { x: 0.5, y: 0.745, size: 0.040, maxW: 0.72, color: 'ink', font: 'cormorant', weight: 400, italic: true, lead: 1.05, lines: 1 }),
      zone('headline',  'headline',  'ANA & JAMES',   { sample: true, x: 0.5, y: 0.815, size: 0.0165, maxW: 0.72, color: 'ink', font: 'grotesk', weight: 500, track: 0.34, upper: true, lead: 1.30, lines: 1 }),
      zone('signature', 'signature', 'June 12, 2027 · Hudson, New York', { sample: true, x: 0.5, y: 0.855, size: 0.0135, maxW: 0.72, color: 'accent', font: 'grotesk', track: 0.16, lead: 1.40 }),
    ],
  },
  {
    id: 'm-grad',
    name: 'Class Of',
    formatId: 'flat-5x7', orientation: 'portrait',
    tags: ['graduation'],
    ground: 'inset', ornament: 'none', photoEdge: 'square',
    colorways: ['snow', 'navy', 'evergreen', 'cranberry', 'ink'],
    photos: [{ id: 'main', x: 0.18, y: 0.12, w: 0.64, h: 0.58, fit: 'cover', mat: 0.026 }],
    popcodeSlot: 'main',
    text: [
      zone('subhead',   'subhead',   'CLASS OF 2026',         { x: 0.5, y: 0.055, size: 0.0145, maxW: 0.72, color: 'ink', font: 'grotesk', weight: 500, track: 0.42, upper: true, lead: 1.30, lines: 1 }),
      zone('headline',  'headline',  'Jordan Middleton',      { sample: true, x: 0.5, y: 0.765, size: 0.046, maxW: 0.84, color: 'ink', font: 'cormorant', weight: 400, lead: 1.05, lines: 1 }),
      zone('signature', 'signature', 'WESTFIELD HIGH SCHOOL', { sample: true, x: 0.5, y: 0.838, size: 0.0125, maxW: 0.84, color: 'accent', font: 'grotesk', weight: 500, track: 0.34, upper: true, lead: 1.40 }),
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
//
// The packs are Printify's own: each is a separate variant of the product
// (catalog.mjs, `card`, variant `card-5x7-{qty}`), so a pack is one cart line of
// one copy. The discounts are not applied to the price yet: they go in with the
// retail price, once the Printify cost is known.
export const CARD_PACKS = [
  { qty: 10,  discount: 0    },
  { qty: 30,  discount: 0.10 },
  { qty: 50,  discount: 0.15 },
  { qty: 100, discount: 0.20 },
];
export const DEFAULT_PACK = 30;
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
