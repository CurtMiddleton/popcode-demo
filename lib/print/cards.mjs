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
// Four sections, like Minted's top menu but only where people mail many of
// the same card (decided 2026-10-20): Holiday, Wedding, Baby, Invitations.
// No business holiday cards, no one-off birthday or thank-you cards. An
// occasion with no designs is hidden (occasionsWithCounts), so the menu fills
// in as designs are added; `greeting` preselects a holiday greeting.
export const SECTIONS = ['Holiday', 'Wedding', 'Baby', 'Invitations'];
export const OCCASIONS = [
  // — Holiday —
  { id: 'holiday',        label: 'Holiday Photo Cards',      section: 'Holiday', group: 'Holiday Cards', tags: ['holiday'] },
  { id: 'christmas',      label: 'Christmas Cards',          section: 'Holiday', group: 'Holiday Cards', tags: ['christmas'], greeting: 'christmas' },
  { id: 'religious-xmas', label: 'Religious Christmas',      section: 'Holiday', group: 'Holiday Cards', tags: ['christmas', 'religious'], greeting: 'religious' },
  { id: 'new-year',       label: "New Year's Cards",         section: 'Holiday', group: 'Holiday Cards', tags: ['newyear'], greeting: 'newyear' },
  { id: 'hanukkah',       label: 'Hanukkah Cards',           section: 'Holiday', group: 'Holiday Cards', tags: ['hanukkah'] },
  { id: 'thanksgiving',   label: 'Thanksgiving Cards',       section: 'Holiday', group: 'Holiday Cards', tags: ['thanksgiving'] },
  { id: 'baby-first-xmas',label: "Baby's First Christmas",   section: 'Holiday', group: 'By Theme', tags: ['christmas', 'baby'], greeting: 'christmas' },
  { id: 'newlywed-xmas',  label: 'Newlywed Holiday Cards',   section: 'Holiday', group: 'By Theme', tags: ['holiday', 'newlywed'] },
  { id: 'pet-xmas',       label: 'Pet Holiday Cards',        section: 'Holiday', group: 'By Theme', tags: ['holiday', 'pet'] },
  { id: 'year-in-review', label: 'Year in Review',           section: 'Holiday', group: 'By Theme', tags: ['holiday', 'multiphoto'] },
  { id: 'xmas-moving',    label: 'Holiday Moving Announcements', section: 'Holiday', group: 'By Theme', tags: ['holiday', 'moving'] },
  { id: 'holiday-party',  label: 'Holiday Party Invitations', section: 'Holiday', group: 'Party', tags: ['holiday', 'invitation'] },

  // — Wedding —
  { id: 'save-the-date',  label: 'Save the Dates',           section: 'Wedding', group: 'Wedding', tags: ['savethedate'] },
  { id: 'wedding-inv',    label: 'Wedding Invitations',      section: 'Wedding', group: 'Wedding', tags: ['wedding', 'invitation'] },
  { id: 'wedding-thanks', label: 'Wedding Thank You Cards',  section: 'Wedding', group: 'Wedding', tags: ['wedding', 'thankyou'] },
  { id: 'just-married',   label: 'Just Married Announcements', section: 'Wedding', group: 'Wedding', tags: ['justmarried'] },
  { id: 'engagement',     label: 'Engagement Party',         section: 'Wedding', group: 'Parties', tags: ['engagement', 'invitation'] },
  { id: 'rehearsal',      label: 'Rehearsal Dinner',         section: 'Wedding', group: 'Parties', tags: ['rehearsal', 'invitation'] },

  // — Baby —
  { id: 'birth',          label: 'Birth Announcements',      section: 'Baby', group: 'Announcements', tags: ['birth'] },
  { id: 'birth-holiday',  label: 'Holiday Birth Announcements', section: 'Baby', group: 'Announcements', tags: ['birth', 'holiday'] },
  { id: 'pregnancy',      label: 'Pregnancy Announcements',  section: 'Baby', group: 'Announcements', tags: ['pregnancy'] },
  { id: 'baby-shower',    label: 'Baby Shower Invitations',  section: 'Baby', group: 'Invitations & Thank Yous', tags: ['babyshower', 'invitation'] },
  { id: 'baby-thanks',    label: 'Baby Thank You Cards',     section: 'Baby', group: 'Invitations & Thank Yous', tags: ['baby', 'thankyou'] },
  { id: 'baptism',        label: 'Baptism & Christening',    section: 'Baby', group: 'Invitations & Thank Yous', tags: ['baptism', 'invitation'] },
  { id: 'first-birthday', label: 'First Birthday',           section: 'Baby', group: 'Invitations & Thank Yous', tags: ['firstbirthday', 'invitation'] },

  // — Invitations —
  { id: 'kids-birthday',  label: 'Kids Birthday',            section: 'Invitations', group: 'Birthdays', tags: ['birthday', 'kids', 'invitation'] },
  { id: 'adult-birthday', label: 'Adult & Milestone Birthday', section: 'Invitations', group: 'Birthdays', tags: ['birthday', 'adult', 'invitation'] },
  { id: 'sweet-sixteen',  label: 'Sweet Sixteen & Quincea\u00f1era', section: 'Invitations', group: 'Birthdays', tags: ['sweetsixteen', 'invitation'] },
  { id: 'mitzvah',        label: 'Bar & Bat Mitzvah',        section: 'Invitations', group: 'Milestones', tags: ['mitzvah', 'invitation'] },
  { id: 'communion',      label: 'First Communion & Confirmation', section: 'Invitations', group: 'Milestones', tags: ['communion', 'invitation'] },
  { id: 'graduation',     label: 'Graduation',               section: 'Invitations', group: 'Milestones', tags: ['graduation'] },
  { id: 'anniversary',    label: 'Anniversary Party',        section: 'Invitations', group: 'Parties', tags: ['anniversary', 'invitation'] },
  { id: 'bridal-shower',  label: 'Bridal Shower',            section: 'Invitations', group: 'Parties', tags: ['bridalshower', 'invitation'] },
  { id: 'dinner-party',   label: 'Dinner Party',             section: 'Invitations', group: 'Parties', tags: ['dinnerparty', 'invitation'] },
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
  signature: { label: 'Your names', maxChars: 44,  maxLines: 1, hint: 'Love, the Middletons' },
  year:      { label: 'Year',       maxChars: 24,   maxLines: 1, hint: '2026' },
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
  // The three scripts the user chose (2026-10-20), offered as one Script
  // option on every design with a script line. All SIL OFL.
  parisienne:{ label: 'Classic',  css: "'Parisienne', 'Snell Roundhand', cursive",            google: 'Parisienne' },
  doulaise:  { label: 'Formal',   css: "'Monsieur La Doulaise', 'Snell Roundhand', cursive",  google: 'Monsieur+La+Doulaise' },
  meaculpa:  { label: 'Calligraphy', css: "'Mea Culpa', 'Snell Roundhand', cursive", google: 'Mea+Culpa' },
  sacramento:{ label: 'Pen',      css: "'Sacramento', 'Snell Roundhand', cursive",            google: 'Sacramento' },
  windsong:  { label: 'Sweeping', css: "'WindSong', 'Snell Roundhand', cursive",              google: 'WindSong' },
  pinyon:    { label: 'Formal Script', css: "'Pinyon Script', 'Snell Roundhand', cursive", google: 'Pinyon+Script' },
  condensed: { label: 'Bold Condensed', css: "'Oswald', 'Arial Narrow', sans-serif", google: 'Oswald:wght@500;600' },
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
  cocoa:     { label: 'Cocoa',     ground: '#4A2C2A', panel: '#F4EEE6', ink: '#4A2C2A', accent: '#7A5A52', mat: '#4A2C2A', onPhoto: '#FFFFFF' },
  // White cards with coloured type (Harbor).
  wred:      { label: 'Red',       ground: '#B3262D', panel: '#FFFFFF', ink: '#B3262D', accent: '#B3262D', mat: '#B3262D', onPhoto: '#FFFFFF' },
  wgreen:    { label: 'Green',     ground: '#2E4A3A', panel: '#FFFFFF', ink: '#2E4A3A', accent: '#2E4A3A', mat: '#2E4A3A', onPhoto: '#FFFFFF' },
  wnavy:     { label: 'Navy',      ground: '#1F2B44', panel: '#FFFFFF', ink: '#1F2B44', accent: '#1F2B44', mat: '#1F2B44', onPhoto: '#FFFFFF' },
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
// ── Greetings ───────────────────────────────────────────────────────────────
// A holiday design offers four greetings, like Minted. A zone with `greet`
// takes its default from the chosen one (resolveText's greetingId); the buyer
// can still type their own. Each design words them in its own voice, so the
// sets live on the zones rather than in one table.
export const GREETINGS = [
  { id: 'holiday',   label: 'Holiday' },
  { id: 'christmas', label: 'Christmas' },
  { id: 'newyear',   label: 'New Year' },
  { id: 'religious', label: 'Religious Christmas' },
];
const g = (holiday, christmas, newyear, religious) => ({ holiday, christmas, newyear, religious });
const CAPS  = g('HAPPY HOLIDAYS', 'MERRY CHRISTMAS', 'HAPPY NEW YEAR', 'JOY TO THE WORLD');
const LOWER = g('happy holidays', 'merry christmas', 'happy new year', 'joy to the world');
const TITLE = g('Happy Holidays', 'Merry Christmas', 'Happy New Year', 'Joy to the World');
const gz = (id, role, set, geom) => zone(id, role, set.holiday, { greet: set, ...geom });

// One design = a family: the same name, colours and greeting in a portrait
// and a landscape layout (template ids p-{family} and l-{family}). The buyer
// switches between them in the editor.
//
// Geometry is fractions of the trimmed card. Portrait is 5in wide x 7in tall,
// landscape 7 x 5, so the same printed type size is 1.4x the `size` on a
// landscape card, and a 1/4in margin is x 0.05 / y 0.036 portrait, x 0.036 /
// y 0.05 landscape. Type was raised about 40% on 2026-10-20 (too small to
// read): small capitals now print at roughly 9-10pt.
const HOL = ['christmas', 'holiday', 'newyear', 'religious'];
const fam = (family, name, tags, common, portrait, landscape) => [
  { id: 'p-' + family, family, name, formatId: 'flat-5x7', orientation: 'portrait', tags, ornament: 'none', ...common, ...portrait },
  { id: 'l-' + family, family, name, formatId: 'flat-5x7', orientation: 'landscape', tags, ornament: 'none', ...common, ...landscape },
];
const sans = (geom) => ({ font: 'grotesk', weight: 500, upper: true, track: 0.30, lead: 1.40, ...geom });

export const CARD_TEMPLATES = [
  // ── Full bleed ──
  ...fam('pacifique', 'Pacifique', [...HOL, 'baby', 'pet', 'newlywed'],
    { ground: 'bleed', scrim: 0.16, colorways: ['snow'], popcodeSlot: 'main', photos: [{ id: 'main', x: 0, y: 0, w: 1, h: 1, fit: 'cover' }] },
    { text: [
      gz('headline', 'headline', CAPS, { x: 0.5, y: 0.785, size: 0.042, maxW: 0.92, color: 'onPhoto', font: 'cormorant', weight: 500, track: 0.20, upper: true, lead: 1.15, lines: 1 }),
      zone('signature', 'signature', 'THE LOWELL FAMILY', sans({ sample: true, x: 0.5, y: 0.858, size: 0.018, maxW: 0.80, color: 'onPhoto', track: 0.32 })),
    ] },
    { text: [
      gz('headline', 'headline', CAPS, { x: 0.94, y: 0.765, size: 0.058, maxW: 0.66, color: 'onPhoto', font: 'cormorant', weight: 500, track: 0.20, upper: true, align: 'right', lead: 1.15, lines: 1 }),
      zone('signature', 'signature', 'THE LOWELL FAMILY', sans({ sample: true, x: 0.94, y: 0.872, size: 0.025, maxW: 0.55, color: 'onPhoto', track: 0.32, align: 'right' })),
    ] }),
  ...fam('brighton', 'Brighton', [...HOL, 'newlywed', 'pet'],
    { ground: 'bleed', scrim: 0.16, scrimTop: 0.16, colorways: ['snow'], popcodeSlot: 'main', photos: [{ id: 'main', x: 0, y: 0, w: 1, h: 1, fit: 'cover' }] },
    { text: [
      gz('headline', 'headline', g('MERRY &', 'MERRY', 'HAPPY', 'JOY TO'), { label: 'Greeting, top', x: 0.5, y: 0.030, size: 0.072, maxW: 0.94, color: 'onPhoto', font: 'cormorant', weight: 500, track: 0.42, upper: true, lead: 1.05, lines: 1 }),
      gz('subhead', 'subhead', g('BRIGHT', 'CHRISTMAS', 'NEW YEAR', 'THE WORLD'), { label: 'Greeting, bottom', x: 0.5, y: 0.868, size: 0.072, maxW: 0.94, color: 'onPhoto', font: 'cormorant', weight: 500, track: 0.42, upper: true, lead: 1.05, lines: 1 }),
      zone('signature', 'signature', 'the Bennetts', { sample: true, x: 0.5, y: 0.770, size: 0.062, maxW: 0.70, color: 'onPhoto', font: 'hand', lead: 1.10, lines: 1 }),
    ] },
    { text: [
      gz('headline', 'headline', g('MERRY &', 'MERRY', 'HAPPY', 'JOY TO'), { label: 'Greeting, top', x: 0.5, y: 0.035, size: 0.100, maxW: 0.94, color: 'onPhoto', font: 'cormorant', weight: 500, track: 0.42, upper: true, lead: 1.05, lines: 1 }),
      gz('subhead', 'subhead', g('BRIGHT', 'CHRISTMAS', 'NEW YEAR', 'THE WORLD'), { label: 'Greeting, bottom', x: 0.5, y: 0.820, size: 0.100, maxW: 0.94, color: 'onPhoto', font: 'cormorant', weight: 500, track: 0.42, upper: true, lead: 1.05, lines: 1 }),
      zone('signature', 'signature', 'the Bennetts', { sample: true, x: 0.5, y: 0.690, size: 0.085, maxW: 0.60, color: 'onPhoto', font: 'hand', lead: 1.10, lines: 1 }),
    ] }),
  ...fam('boldserif', 'Bold Serif', [...HOL, 'baby', 'pet', 'newlywed'],
    { ground: 'bleed', scrim: 0.22, colorways: ['snow'], popcodeSlot: 'main', photos: [{ id: 'main', x: 0, y: 0, w: 1, h: 1, fit: 'cover' }] },
    { text: [
      gz('headline', 'headline', TITLE, { x: 0.5, y: 0.655, size: 0.078, maxW: 0.80, color: 'onPhoto', font: 'serif', weight: 600, lead: 1.00, lines: 2 }),
      zone('signature', 'signature', 'THE MIDDLETONS', sans({ sample: true, x: 0.5, y: 0.880, size: 0.018, maxW: 0.80, color: 'onPhoto', track: 0.32 })),
    ] },
    { text: [
      gz('headline', 'headline', TITLE, { x: 0.06, y: 0.520, size: 0.110, maxW: 0.55, color: 'onPhoto', font: 'serif', weight: 600, align: 'left', lead: 1.00, lines: 2 }),
      zone('signature', 'signature', 'THE MIDDLETONS', sans({ sample: true, x: 0.06, y: 0.870, size: 0.025, maxW: 0.55, color: 'onPhoto', track: 0.32, align: 'left' })),
    ] }),
  ...fam('joyeux', 'Joyeux', [...HOL, 'baby', 'newlywed', 'pet'],
    { ground: 'bleed', scrim: 0.18, colorways: ['snow'], popcodeSlot: 'main', photos: [{ id: 'main', x: 0, y: 0, w: 1, h: 1, fit: 'cover' }] },
    { text: [
      gz('headline', 'headline', g('Happy Holidays', 'Merry Christmas', 'Happy New Year', 'O Holy Night'), { x: 0.5, y: 0.720, size: 0.088, maxW: 0.92, color: 'onPhoto', font: 'pinyon', lead: 1.10, lines: 1 }),
      zone('signature', 'signature', 'THE MIDDLETONS', sans({ sample: true, x: 0.5, y: 0.868, size: 0.018, maxW: 0.80, color: 'onPhoto', track: 0.32 })),
    ] },
    { text: [
      gz('headline', 'headline', g('Happy Holidays', 'Merry Christmas', 'Happy New Year', 'O Holy Night'), { x: 0.5, y: 0.640, size: 0.125, maxW: 0.85, color: 'onPhoto', font: 'pinyon', lead: 1.10, lines: 1 }),
      zone('signature', 'signature', 'THE MIDDLETONS', sans({ sample: true, x: 0.5, y: 0.868, size: 0.025, maxW: 0.70, color: 'onPhoto', track: 0.32 })),
    ] }),
  ...fam('corner', 'Corner Title', [...HOL, 'baby', 'pet', 'newlywed'],
    { ground: 'bleed', scrim: 0.12, scrimTop: 0.20, colorways: ['snow'], popcodeSlot: 'main', photos: [{ id: 'main', x: 0, y: 0, w: 1, h: 1, fit: 'cover' }] },
    { text: [
      gz('headline', 'headline', CAPS, { x: 0.07, y: 0.050, size: 0.058, maxW: 0.55, color: 'onPhoto', font: 'cormorant', weight: 500, upper: true, track: 0.06, align: 'left', lead: 1.00, lines: 2 }),
      zone('signature', 'signature', 'The Alphersons ’26', { sample: true, x: 0.93, y: 0.880, size: 0.058, maxW: 0.70, color: 'onPhoto', font: 'hand', align: 'right', lead: 1.10, lines: 1 }),
    ] },
    { text: [
      gz('headline', 'headline', CAPS, { x: 0.05, y: 0.070, size: 0.080, maxW: 0.42, color: 'onPhoto', font: 'cormorant', weight: 500, upper: true, track: 0.06, align: 'left', lead: 1.00, lines: 2 }),
      zone('signature', 'signature', 'The Alphersons ’26', { sample: true, x: 0.95, y: 0.830, size: 0.080, maxW: 0.55, color: 'onPhoto', font: 'hand', align: 'right', lead: 1.10, lines: 1 }),
    ] }),
  ...fam('condensed', 'Bold Condensed', [...HOL, 'baby', 'pet'],
    { ground: 'bleed', scrim: 0.24, colorways: ['snow'], popcodeSlot: 'main', photos: [{ id: 'main', x: 0, y: 0, w: 1, h: 1, fit: 'cover' }] },
    { text: [
      gz('headline', 'headline', CAPS, { x: 0.5, y: 0.640, size: 0.088, maxW: 0.66, color: 'onPhoto', font: 'condensed', weight: 600, upper: true, track: 0.02, lead: 0.98, lines: 2 }),
      zone('signature', 'signature', 'Catherine, Christian and Bella', { sample: true, x: 0.5, y: 0.850, size: 0.050, maxW: 0.85, color: 'onPhoto', font: 'hand', lead: 1.10, lines: 1 }),
    ] },
    { text: [
      gz('headline', 'headline', CAPS, { x: 0.5, y: 0.500, size: 0.120, maxW: 0.50, color: 'onPhoto', font: 'condensed', weight: 600, upper: true, track: 0.02, lead: 0.98, lines: 2 }),
      zone('signature', 'signature', 'Catherine, Christian and Bella', { sample: true, x: 0.5, y: 0.820, size: 0.070, maxW: 0.75, color: 'onPhoto', font: 'hand', lead: 1.10, lines: 1 }),
    ] }),
  ...fam('everything', 'Merry Everything', [...HOL, 'baby', 'pet'],
    { ground: 'bleed', scrim: 0.18, colorways: ['snow'], popcodeSlot: 'main', photos: [{ id: 'main', x: 0, y: 0, w: 1, h: 1, fit: 'cover' }] },
    { text: [
      gz('headline', 'headline', g('MERRY EVERYTHING', 'MERRY CHRISTMAS', 'CHEERS TO THE NEW YEAR', 'JOY TO THE WORLD'), sans({ x: 0.5, y: 0.730, size: 0.028, maxW: 0.70, color: 'onPhoto', track: 0.36, lead: 1.50, lines: 2 })),
      zone('signature', 'signature', 'The Parkers', { sample: true, x: 0.5, y: 0.835, size: 0.075, maxW: 0.80, color: 'onPhoto', font: 'hand', lead: 1.10, lines: 1 }),
    ] },
    { text: [
      gz('headline', 'headline', g('MERRY EVERYTHING', 'MERRY CHRISTMAS', 'CHEERS TO THE NEW YEAR', 'JOY TO THE WORLD'), sans({ x: 0.5, y: 0.640, size: 0.039, maxW: 0.50, color: 'onPhoto', track: 0.36, lead: 1.50, lines: 2 })),
      zone('signature', 'signature', 'The Parkers', { sample: true, x: 0.5, y: 0.790, size: 0.100, maxW: 0.60, color: 'onPhoto', font: 'hand', lead: 1.10, lines: 1 }),
    ] }),

  // ── On the card colour ──
  ...fam('typewriter', 'Typewriter', [...HOL, 'baby', 'pet', 'newlywed'],
    { ground: 'inset', photoEdge: 'square', colorways: ['ivory', 'snow', 'cranberry', 'evergreen', 'navy', 'ink'], popcodeSlot: 'main' },
    { photos: [{ id: 'main', x: 0.10, y: 0.095, w: 0.80, h: 0.76, fit: 'cover', mat: 0.003 }], text: [
      gz('headline', 'headline', LOWER, { x: 0.5, y: 0.030, size: 0.031, maxW: 0.80, color: 'ink', font: 'cormorant', weight: 500, track: 0.18, lead: 1.30, lines: 1 }),
      zone('signature', 'signature', 'the millers 2026', { sample: true, x: 0.5, y: 0.885, size: 0.027, maxW: 0.80, color: 'accent', font: 'cormorant', weight: 500, track: 0.16, lead: 1.30 }),
    ] },
    { photos: [{ id: 'main', x: 0.14, y: 0.14, w: 0.72, h: 0.70, fit: 'cover', mat: 0.002 }], text: [
      gz('headline', 'headline', LOWER, { x: 0.5, y: 0.035, size: 0.043, maxW: 0.70, color: 'ink', font: 'cormorant', weight: 500, track: 0.18, lead: 1.30, lines: 1 }),
      zone('signature', 'signature', 'the millers 2026', { sample: true, x: 0.5, y: 0.870, size: 0.038, maxW: 0.70, color: 'accent', font: 'cormorant', weight: 500, track: 0.16, lead: 1.30 }),
    ] }),
  ...fam('minimal', 'Minimal Border', [...HOL, 'newlywed', 'pet'],
    { ground: 'inset', photoEdge: 'square', colorways: ['sage', 'snow', 'cranberry', 'evergreen', 'navy', 'ivory'], popcodeSlot: 'main' },
    { photos: [{ id: 'main', x: 0.19, y: 0.20, w: 0.62, h: 0.53, fit: 'cover', mat: 0.026 }], text: [
      gz('headline', 'headline', g('WISHING YOU THE VERY HAPPIEST HOLIDAYS', 'WISHING YOU A VERY MERRY CHRISTMAS', 'WISHING YOU A BRIGHT NEW YEAR', 'PEACE ON EARTH AND GOODWILL TO ALL'), { x: 0.5, y: 0.050, size: 0.020, maxW: 0.66, color: 'ink', font: 'cormorant', weight: 600, track: 0.28, upper: true, lead: 1.60, lines: 2 }),
      zone('signature', 'signature', 'THE MARTINS — 2026', sans({ sample: true, x: 0.5, y: 0.855, size: 0.019, maxW: 0.80, color: 'ink', track: 0.28 })),
    ] },
    { photos: [{ id: 'main', x: 0.25, y: 0.25, w: 0.50, h: 0.51, fit: 'cover', mat: 0.018 }], text: [
      gz('headline', 'headline', g('WISHING YOU THE VERY HAPPIEST HOLIDAYS', 'WISHING YOU A VERY MERRY CHRISTMAS', 'WISHING YOU A BRIGHT NEW YEAR', 'PEACE ON EARTH AND GOODWILL TO ALL'), { x: 0.5, y: 0.055, size: 0.028, maxW: 0.52, color: 'ink', font: 'cormorant', weight: 600, track: 0.28, upper: true, lead: 1.60, lines: 2 }),
      zone('signature', 'signature', 'THE MARTINS — 2026', sans({ sample: true, x: 0.5, y: 0.865, size: 0.026, maxW: 0.60, color: 'ink', track: 0.28 })),
    ] }),
  ...fam('frame', 'Colour Frame', [...HOL, 'newlywed', 'baby', 'pet'],
    { ground: 'inset', photoEdge: 'square', colorways: ['cranberry', 'evergreen', 'navy', 'sage'], popcodeSlot: 'main' },
    { frame: { x: 0.055, y: 0.039, w: 0.89, h: 0.922 }, photos: [{ id: 'main', x: 0.16, y: 0.14, w: 0.68, h: 0.62, fit: 'cover' }], text: [
      gz('headline', 'headline', g('HAPPIEST HOLIDAYS', 'MERRY CHRISTMAS', 'HAPPY NEW YEAR', 'JOY TO THE WORLD'), sans({ x: 0.5, y: 0.076, size: 0.021, maxW: 0.76, color: 'ink', track: 0.32, lines: 1 })),
      zone('signature', 'signature', 'JACK + COOPER · 2026', sans({ sample: true, x: 0.5, y: 0.805, size: 0.019, maxW: 0.76, color: 'ink', track: 0.30 })),
    ] },
    { frame: { x: 0.039, y: 0.055, w: 0.922, h: 0.89 }, photos: [{ id: 'main', x: 0.21, y: 0.22, w: 0.58, h: 0.55, fit: 'cover' }], text: [
      gz('headline', 'headline', g('HAPPIEST HOLIDAYS', 'MERRY CHRISTMAS', 'HAPPY NEW YEAR', 'JOY TO THE WORLD'), sans({ x: 0.5, y: 0.100, size: 0.029, maxW: 0.66, color: 'ink', track: 0.32, lines: 1 })),
      zone('signature', 'signature', 'JACK + COOPER · 2026', sans({ sample: true, x: 0.5, y: 0.810, size: 0.026, maxW: 0.66, color: 'ink', track: 0.30 })),
    ] }),
  ...fam('modern', 'Modern Frame', [...HOL, 'newlywed', 'pet'],
    { ground: 'inset', photoEdge: 'square', colorways: ['snow', 'ivory', 'cranberry', 'evergreen', 'navy', 'sage'], popcodeSlot: 'main' },
    { photos: [{ id: 'main', x: 0.18, y: 0.17, w: 0.64, h: 0.58, fit: 'cover', mat: 0.03 }], text: [
      gz('headline', 'headline', g('HAPPIEST', 'MERRY', 'HAPPY', 'JOY TO'), sans({ label: 'Greeting, left', x: 0.15, y: 0.075, size: 0.019, maxW: 0.34, color: 'ink', align: 'left', lines: 1 })),
      gz('subhead', 'subhead', g('HOLIDAYS', 'CHRISTMAS', 'NEW YEAR', 'THE WORLD'), sans({ label: 'Greeting, right', x: 0.85, y: 0.075, size: 0.019, maxW: 0.34, color: 'ink', align: 'right', lines: 1 })),
      zone('signature', 'signature', 'THE ROBINSONS', sans({ sample: true, x: 0.15, y: 0.840, size: 0.019, maxW: 0.46, color: 'ink', align: 'left', lines: 1 })),
      zone('year', 'year', '2026', sans({ x: 0.85, y: 0.840, size: 0.019, maxW: 0.22, color: 'ink', align: 'right', lines: 1 })),
    ] },
    { photos: [{ id: 'main', x: 0.25, y: 0.19, w: 0.50, h: 0.58, fit: 'cover', mat: 0.022 }], text: [
      gz('headline', 'headline', g('HAPPIEST', 'MERRY', 'HAPPY', 'JOY TO'), sans({ label: 'Greeting, left', x: 0.25, y: 0.065, size: 0.026, maxW: 0.24, color: 'ink', align: 'left', lines: 1 })),
      gz('subhead', 'subhead', g('HOLIDAYS', 'CHRISTMAS', 'NEW YEAR', 'THE WORLD'), sans({ label: 'Greeting, right', x: 0.75, y: 0.065, size: 0.026, maxW: 0.24, color: 'ink', align: 'right', lines: 1 })),
      zone('signature', 'signature', 'THE ROBINSONS', sans({ sample: true, x: 0.25, y: 0.870, size: 0.026, maxW: 0.34, color: 'ink', align: 'left', lines: 1 })),
      zone('year', 'year', '2026', sans({ x: 0.75, y: 0.870, size: 0.026, maxW: 0.16, color: 'ink', align: 'right', lines: 1 })),
    ] }),
  ...fam('band', 'Bottom Band', [...HOL, 'pet', 'baby', 'newlywed'],
    { ground: 'inset', photoEdge: 'square', colorways: ['snow', 'ivory', 'cranberry', 'evergreen', 'ink'], popcodeSlot: 'main' },
    { photos: [{ id: 'main', x: 0, y: 0, w: 1, h: 0.80, fit: 'cover' }], text: [
      gz('headline', 'headline', TITLE, { x: 0.07, y: 0.842, size: 0.052, maxW: 0.52, color: 'ink', font: 'cormorant', weight: 500, align: 'left', lead: 1.05, lines: 1 }),
      zone('signature', 'signature', 'THE MIDDLETONS', sans({ sample: true, x: 0.93, y: 0.868, size: 0.018, maxW: 0.32, color: 'accent', align: 'right', track: 0.26 })),
    ] },
    { photos: [{ id: 'main', x: 0, y: 0, w: 1, h: 0.76, fit: 'cover' }], text: [
      gz('headline', 'headline', TITLE, { x: 0.05, y: 0.810, size: 0.072, maxW: 0.52, color: 'ink', font: 'cormorant', weight: 500, align: 'left', lead: 1.05, lines: 1 }),
      zone('signature', 'signature', 'THE MIDDLETONS', sans({ sample: true, x: 0.95, y: 0.848, size: 0.025, maxW: 0.32, color: 'accent', align: 'right', track: 0.26 })),
    ] }),
  ...fam('side', 'Side Note', [...HOL, 'pet', 'baby', 'newlywed'],
    { ground: 'inset', photoEdge: 'square', colorways: ['snow', 'ivory', 'cranberry', 'evergreen', 'ink'], popcodeSlot: 'main' },
    { photos: [{ id: 'main', x: 0, y: 0, w: 1, h: 0.70, fit: 'cover' }], text: [
      gz('headline', 'headline', CAPS, sans({ x: 0.5, y: 0.755, size: 0.022, maxW: 0.84, color: 'ink', track: 0.34, lines: 1 })),
      zone('signature', 'signature', 'The Parkers', { sample: true, x: 0.5, y: 0.800, size: 0.075, maxW: 0.80, color: 'accent', font: 'hand', lead: 1.10, lines: 1 }),
    ] },
    { photos: [{ id: 'main', x: 0, y: 0, w: 0.62, h: 1, fit: 'cover' }], text: [
      gz('headline', 'headline', CAPS, sans({ x: 0.81, y: 0.370, size: 0.030, maxW: 0.30, color: 'ink', track: 0.32, lead: 1.80, lines: 2 })),
      zone('signature', 'signature', 'The Parkers', { sample: true, x: 0.81, y: 0.545, size: 0.100, maxW: 0.33, color: 'accent', font: 'hand', lead: 1.10, lines: 1 }),
    ] }),

  // ── Handwritten calligraphy (the user's Minted references, 2026-10-20) ──
  ...fam('pen', 'Pen & Ink', [...HOL, 'baby', 'pet', 'newlywed'],
    { ground: 'inset', photoEdge: 'square', fill: 'ground', colorways: ['cocoa', 'evergreen', 'navy', 'ink'], popcodeSlot: 'main' },
    { photos: [{ id: 'main', x: 0.063, y: 0.045, w: 0.874, h: 0.91, fit: 'cover' }], text: [
      gz('headline', 'headline', TITLE, { x: 0.5, y: 0.700, size: 0.085, maxW: 0.82, color: 'onPhoto', font: 'sacramento', scriptable: true, lead: 1.10, lines: 1 }),
      zone('signature', 'signature', 'With Love, The Anderson Family', { sample: true, x: 0.5, y: 0.815, size: 0.034, maxW: 0.80, color: 'onPhoto', font: 'sacramento', scriptable: true, lead: 1.20, lines: 1 }),
    ] },
    { photos: [{ id: 'main', x: 0.045, y: 0.063, w: 0.91, h: 0.874, fit: 'cover' }], text: [
      gz('headline', 'headline', TITLE, { x: 0.5, y: 0.640, size: 0.120, maxW: 0.80, color: 'onPhoto', font: 'sacramento', scriptable: true, lead: 1.10, lines: 1 }),
      zone('signature', 'signature', 'With Love, The Anderson Family', { sample: true, x: 0.5, y: 0.800, size: 0.046, maxW: 0.70, color: 'onPhoto', font: 'sacramento', scriptable: true, lead: 1.20, lines: 1 }),
    ] }),
  ...fam('harbor', 'Harbor', [...HOL, 'newlywed', 'pet'],
    { ground: 'inset', photoEdge: 'square', colorways: ['wred', 'wgreen', 'wnavy', 'snow'], popcodeSlot: 'main' },
    { photos: [{ id: 'main', x: 0.05, y: 0.036, w: 0.90, h: 0.928, fit: 'cover' }], text: [
      gz('headline', 'headline', g('Happy', 'Merry', 'Happy', 'Joy to'), { label: 'Greeting, first word', x: 0.34, y: 0.110, size: 0.110, maxW: 0.52, rotate: -7, color: 'ink', font: 'windsong', scriptable: true, lead: 0.90, lines: 1 }),
      gz('subhead', 'subhead', g('Holidays', 'Christmas', 'New Year', 'the World'), { label: 'Greeting, second word', x: 0.56, y: 0.230, size: 0.110, maxW: 0.68, rotate: -7, color: 'ink', font: 'windsong', scriptable: true, lead: 0.90, lines: 1 }),
      zone('message', 'message', 'from', { label: 'Small line', x: 0.86, y: 0.860, size: 0.026, maxW: 0.30, color: 'ink', font: 'cormorant', weight: 500, italic: true, align: 'right', lead: 1.10, lines: 1 }),
      zone('signature', 'signature', 'THE HARRISONS \u201926', sans({ sample: true, x: 0.86, y: 0.895, size: 0.018, maxW: 0.46, color: 'ink', font: 'cormorant', weight: 600, track: 0.10, align: 'right', lines: 1 })),
    ] },
    { photos: [{ id: 'main', x: 0.036, y: 0.05, w: 0.928, h: 0.90, fit: 'cover' }], text: [
      gz('headline', 'headline', g('Happy', 'Merry', 'Happy', 'Joy to'), { label: 'Greeting, first word', x: 0.23, y: 0.165, size: 0.160, maxW: 0.36, rotate: -7, color: 'ink', font: 'windsong', scriptable: true, lead: 0.90, lines: 1 }),
      gz('subhead', 'subhead', g('Holidays', 'Christmas', 'New Year', 'the World'), { label: 'Greeting, second word', x: 0.46, y: 0.390, size: 0.160, maxW: 0.50, rotate: -7, color: 'ink', font: 'windsong', scriptable: true, lead: 0.90, lines: 1 }),
      zone('message', 'message', 'from', { label: 'Small line', x: 0.92, y: 0.100, size: 0.036, maxW: 0.24, color: 'ink', font: 'cormorant', weight: 500, italic: true, align: 'right', lead: 1.10, lines: 1 }),
      zone('signature', 'signature', 'THE HARRISONS \u201926', sans({ sample: true, x: 0.92, y: 0.150, size: 0.025, maxW: 0.30, color: 'ink', font: 'cormorant', weight: 600, track: 0.10, align: 'right', lines: 1 })),
    ] }),
  ...fam('lettered', 'Hand Lettered', [...HOL, 'baby', 'pet'],
    { ground: 'inset', photoEdge: 'square', colorways: ['cranberry', 'evergreen', 'navy', 'snow'], popcodeSlot: 'main' },
    { photos: [{ id: 'main', x: 0.14, y: 0.12, w: 0.76, h: 0.78, fit: 'cover' }], text: [
      gz('headline', 'headline', g('Happy', 'Merry', 'Happy', 'Joy to'), { label: 'Greeting, first word', x: 0.33, y: 0.112, size: 0.118, maxW: 0.56, rotate: -5, color: 'ink', font: 'meaculpa', scriptable: true, lead: 0.90, lines: 1 }),
      gz('subhead', 'subhead', g('Holidays', 'Christmas', 'New Year', 'the World'), { label: 'Greeting, second word', x: 0.47, y: 0.222, size: 0.118, maxW: 0.70, rotate: -5, color: 'ink', font: 'meaculpa', scriptable: true, lead: 0.90, lines: 1 }),
      zone('message', 'message', 'from the', { label: 'Small line', x: 0.80, y: 0.775, size: 0.034, maxW: 0.34, color: 'ink', font: 'meaculpa', scriptable: true, lead: 1.00, lines: 1 }),
      zone('signature', 'signature', 'FRANKLINS', { sample: true, x: 0.78, y: 0.815, size: 0.048, maxW: 0.40, color: 'ink', font: 'meaculpa', scriptable: true, lead: 1.00, lines: 1 }),
      zone('year', 'year', '2026', sans({ x: 0.80, y: 0.885, size: 0.018, maxW: 0.30, color: 'ink', track: 0.34, lines: 1 })),
    ] },
    { photos: [{ id: 'main', x: 0.16, y: 0.14, w: 0.68, h: 0.74, fit: 'cover' }], text: [
      gz('headline', 'headline', g('Happy', 'Merry', 'Happy', 'Joy to'), { label: 'Greeting, first word', x: 0.24, y: 0.160, size: 0.140, maxW: 0.40, rotate: -5, color: 'ink', font: 'meaculpa', scriptable: true, lead: 0.90, lines: 1 }),
      gz('subhead', 'subhead', g('Holidays', 'Christmas', 'New Year', 'the World'), { label: 'Greeting, second word', x: 0.36, y: 0.305, size: 0.140, maxW: 0.50, rotate: -5, color: 'ink', font: 'meaculpa', scriptable: true, lead: 0.90, lines: 1 }),
      zone('message', 'message', 'from the', { label: 'Small line', x: 0.80, y: 0.690, size: 0.048, maxW: 0.26, color: 'ink', font: 'meaculpa', scriptable: true, lead: 1.00, lines: 1 }),
      zone('signature', 'signature', 'FRANKLINS', { sample: true, x: 0.79, y: 0.750, size: 0.066, maxW: 0.28, color: 'ink', font: 'meaculpa', scriptable: true, lead: 1.00, lines: 1 }),
      zone('year', 'year', '2026', sans({ x: 0.80, y: 0.850, size: 0.025, maxW: 0.24, color: 'ink', track: 0.34, lines: 1 })),
    ] }),
  ...fam('abovebelow', 'Above & Below', [...HOL, 'newlywed', 'baby'],
    { ground: 'inset', photoEdge: 'square', colorways: ['cranberry', 'ivory', 'evergreen', 'navy'], popcodeSlot: 'main' },
    { photos: [{ id: 'main', x: 0.32, y: 0.30, w: 0.36, h: 0.37, fit: 'cover' }], text: [
      zone('year', 'year', 'TWENTY TWENTY-SIX', sans({ label: 'Year', x: 0.08, y: 0.050, size: 0.014, maxW: 0.30, color: 'ink', align: 'left', track: 0.30, lead: 1.50, lines: 2 })),
      gz('headline', 'headline', g('Happy', 'Merry', 'Happy', 'Joy to'), { label: 'Greeting, above', x: 0.5, y: 0.300, size: 0.120, maxW: 0.80, center: true, color: 'ink', font: 'doulaise', scriptable: true, lead: 0.90, lines: 1 }),
      gz('subhead', 'subhead', g('Holidays', 'Christmas', 'New Year', 'the World'), { label: 'Greeting, below', x: 0.5, y: 0.675, size: 0.120, maxW: 0.86, center: true, color: 'ink', font: 'doulaise', scriptable: true, lead: 0.90, lines: 1 }),
      zone('message', 'message', 'with love', { label: 'Small line', x: 0.92, y: 0.865, size: 0.026, maxW: 0.30, color: 'ink', font: 'doulaise', scriptable: true, align: 'right', lead: 1.00, lines: 1 }),
      zone('signature', 'signature', 'THE SAMUELS', sans({ sample: true, x: 0.92, y: 0.905, size: 0.015, maxW: 0.40, color: 'ink', align: 'right', track: 0.30, lines: 1 })),
    ] },
    { photos: [{ id: 'main', x: 0.36, y: 0.20, w: 0.28, h: 0.60, fit: 'cover' }], text: [
      zone('year', 'year', 'TWENTY TWENTY-SIX', sans({ label: 'Year', x: 0.05, y: 0.070, size: 0.020, maxW: 0.24, color: 'ink', align: 'left', track: 0.30, lead: 1.50, lines: 2 })),
      gz('headline', 'headline', g('Happy', 'Merry', 'Happy', 'Joy to'), { label: 'Greeting, left', x: 0.30, y: 0.300, size: 0.170, maxW: 0.50, center: true, color: 'ink', font: 'doulaise', scriptable: true, lead: 0.90, lines: 1 }),
      gz('subhead', 'subhead', g('Holidays', 'Christmas', 'New Year', 'the World'), { label: 'Greeting, right', x: 0.68, y: 0.700, size: 0.170, maxW: 0.60, center: true, color: 'ink', font: 'doulaise', scriptable: true, lead: 0.90, lines: 1 }),
      zone('message', 'message', 'with love', { label: 'Small line', x: 0.05, y: 0.860, size: 0.036, maxW: 0.30, color: 'ink', font: 'doulaise', scriptable: true, align: 'left', lead: 1.00, lines: 1 }),
      zone('signature', 'signature', 'THE SAMUELS', sans({ sample: true, x: 0.05, y: 0.915, size: 0.021, maxW: 0.30, color: 'ink', align: 'left', track: 0.30, lines: 1 })),
    ] }),

  // ── More than one photo ──
  // A tall script greeting running up the left edge beside a collage (the
  // user's Minted reference, 2026-10-20). `rotate` turns a zone about its
  // centre at (x, y) (`center: true` places it there unturned); its maxW is still a fraction of card WIDTH, so a line
  // running the height of a portrait card is wider than 1.
  ...fam('vertical', 'Vertical Script', [...HOL, 'multiphoto', 'newlywed'],
    { ground: 'inset', photoEdge: 'square', colorways: ['ivory', 'snow', 'sage', 'ink'], popcodeSlot: 'p2' },
    { photos: [
      { id: 'p1', x: 0.27, y: 0.045, w: 0.665, h: 0.24, fit: 'cover' },
      { id: 'p2', x: 0.27, y: 0.295, w: 0.665, h: 0.40, fit: 'cover' },
      { id: 'p3', x: 0.27, y: 0.705, w: 0.3275, h: 0.19, fit: 'cover' },
      { id: 'p4', x: 0.6075, y: 0.705, w: 0.3275, h: 0.19, fit: 'cover' },
    ], text: [
      gz('headline', 'headline', TITLE, { x: 0.14, y: 0.50, size: 0.150, maxW: 1.22, rotate: -90, color: 'ink', font: 'doulaise', scriptable: true, lead: 1.10, lines: 1 }),
      zone('signature', 'signature', 'love, the parkers', { sample: true, x: 0.6025, y: 0.918, size: 0.024, maxW: 0.66, color: 'accent', font: 'cormorant', weight: 500, italic: true, track: 0.08, lead: 1.30 }),
    ] },
    { photos: [
      { id: 'p1', x: 0.20, y: 0.07, w: 0.36, h: 0.78, fit: 'cover' },
      { id: 'p2', x: 0.57, y: 0.07, w: 0.365, h: 0.385, fit: 'cover' },
      { id: 'p3', x: 0.57, y: 0.465, w: 0.365, h: 0.385, fit: 'cover' },
    ], text: [
      gz('headline', 'headline', TITLE, { x: 0.10, y: 0.50, size: 0.205, maxW: 0.68, rotate: -90, color: 'ink', font: 'doulaise', scriptable: true, lead: 1.10, lines: 1 }),
      zone('signature', 'signature', 'love, the parkers', { sample: true, x: 0.5675, y: 0.885, size: 0.034, maxW: 0.70, color: 'accent', font: 'cormorant', weight: 500, italic: true, track: 0.08, lead: 1.30 }),
    ] }),
  ...fam('quartet', 'Quartet', [...HOL, 'multiphoto'],
    { ground: 'inset', photoEdge: 'square', fill: 'ground', colorways: ['evergreen', 'cranberry', 'navy', 'ink'], popcodeSlot: 'p1' },
    { photos: [
      { id: 'p1', x: 0.14, y: 0.10, w: 0.355, h: 0.39, fit: 'cover' },
      { id: 'p2', x: 0.505, y: 0.10, w: 0.355, h: 0.19, fit: 'cover' },
      { id: 'p3', x: 0.505, y: 0.30, w: 0.355, h: 0.19, fit: 'cover' },
      { id: 'p4', x: 0.14, y: 0.50, w: 0.72, h: 0.29, fit: 'cover' },
    ], text: [
      gz('headline', 'headline', CAPS, { x: 0.5, y: 0.042, size: 0.020, maxW: 0.76, color: 'panel', font: 'cormorant', weight: 600, track: 0.36, upper: true, lead: 1.40, lines: 1 }),
      zone('signature', 'signature', 'the bradfords — 2026', { sample: true, x: 0.5, y: 0.830, size: 0.030, maxW: 0.76, color: 'panel', font: 'cormorant', weight: 500, italic: true, track: 0.10, lead: 1.30 }),
    ] },
    { photos: [
      { id: 'p1', x: 0.10, y: 0.14, w: 0.40, h: 0.68, fit: 'cover' },
      { id: 'p2', x: 0.51, y: 0.14, w: 0.19, h: 0.335, fit: 'cover' },
      { id: 'p3', x: 0.71, y: 0.14, w: 0.19, h: 0.335, fit: 'cover' },
      { id: 'p4', x: 0.51, y: 0.485, w: 0.39, h: 0.335, fit: 'cover' },
    ], text: [
      gz('headline', 'headline', CAPS, { x: 0.5, y: 0.050, size: 0.028, maxW: 0.70, color: 'panel', font: 'cormorant', weight: 600, track: 0.36, upper: true, lead: 1.40, lines: 1 }),
      zone('signature', 'signature', 'the bradfords — 2026', { sample: true, x: 0.5, y: 0.850, size: 0.042, maxW: 0.70, color: 'panel', font: 'cormorant', weight: 500, italic: true, track: 0.10, lead: 1.30 }),
    ] }),
  ...fam('handwritten', 'Handwritten Name', [...HOL, 'multiphoto', 'newlywed'],
    { ground: 'inset', photoEdge: 'square', colorways: ['cranberry', 'snow', 'evergreen', 'navy'], popcodeSlot: 'p1' },
    { photos: [
      { id: 'p1', x: 0.08, y: 0.07, w: 0.415, h: 0.64, fit: 'cover' },
      { id: 'p2', x: 0.505, y: 0.07, w: 0.415, h: 0.64, fit: 'cover' },
    ], text: [
      gz('headline', 'headline', CAPS, sans({ x: 0.08, y: 0.790, size: 0.021, maxW: 0.40, color: 'ink', align: 'left', track: 0.34, lines: 1 })),
      zone('signature', 'signature', 'Love, The Parks', { sample: true, x: 0.92, y: 0.760, size: 0.075, maxW: 0.40, color: 'ink', font: 'hand', align: 'right', lead: 1.10, lines: 1 }),
    ] },
    { photos: [
      { id: 'p1', x: 0.07, y: 0.10, w: 0.283, h: 0.60, fit: 'cover' },
      { id: 'p2', x: 0.3585, y: 0.10, w: 0.283, h: 0.60, fit: 'cover' },
      { id: 'p3', x: 0.647, y: 0.10, w: 0.283, h: 0.60, fit: 'cover' },
    ], text: [
      gz('headline', 'headline', CAPS, sans({ x: 0.07, y: 0.800, size: 0.029, maxW: 0.40, color: 'ink', align: 'left', track: 0.36, lines: 1 })),
      zone('signature', 'signature', 'Love, The Parks', { sample: true, x: 0.93, y: 0.745, size: 0.100, maxW: 0.40, color: 'ink', font: 'hand', align: 'right', lead: 1.10, lines: 1 }),
    ] }),
  ...fam('gallery', 'Gallery', [...HOL, 'multiphoto'],
    { ground: 'inset', photoEdge: 'square', colorways: ['ivory', 'snow', 'sage', 'ink'], popcodeSlot: 'p1' },
    { photos: [
      { id: 'p1', x: 0.08, y: 0.055, w: 0.84, h: 0.45, fit: 'cover' },
      { id: 'p2', x: 0.08, y: 0.515, w: 0.205, h: 0.21, fit: 'cover' },
      { id: 'p3', x: 0.2985, y: 0.515, w: 0.205, h: 0.21, fit: 'cover' },
      { id: 'p4', x: 0.517, y: 0.515, w: 0.205, h: 0.21, fit: 'cover' },
      { id: 'p5', x: 0.7355, y: 0.515, w: 0.205, h: 0.21, fit: 'cover' },
    ], text: [
      gz('headline', 'headline', CAPS, { x: 0.5, y: 0.770, size: 0.020, maxW: 0.80, color: 'ink', font: 'cormorant', weight: 600, track: 0.36, upper: true, lead: 1.40, lines: 1 }),
      zone('signature', 'signature', 'the parkers — 2026', { sample: true, x: 0.5, y: 0.815, size: 0.031, maxW: 0.80, color: 'accent', font: 'cormorant', weight: 500, italic: true, track: 0.10, lead: 1.30 }),
    ] },
    { photos: [
      { id: 'p1', x: 0.27, y: 0.08, w: 0.46, h: 0.68, fit: 'cover' },
      { id: 'p2', x: 0.06, y: 0.08, w: 0.20, h: 0.335, fit: 'cover' },
      { id: 'p3', x: 0.06, y: 0.425, w: 0.20, h: 0.335, fit: 'cover' },
      { id: 'p4', x: 0.74, y: 0.08, w: 0.20, h: 0.335, fit: 'cover' },
      { id: 'p5', x: 0.74, y: 0.425, w: 0.20, h: 0.335, fit: 'cover' },
    ], text: [
      gz('headline', 'headline', CAPS, { x: 0.5, y: 0.805, size: 0.028, maxW: 0.70, color: 'ink', font: 'cormorant', weight: 600, track: 0.36, upper: true, lead: 1.40, lines: 1 }),
      zone('signature', 'signature', 'the parkers — 2026', { sample: true, x: 0.5, y: 0.862, size: 0.042, maxW: 0.70, color: 'accent', font: 'cormorant', weight: 500, italic: true, track: 0.10, lead: 1.30 }),
    ] }),

  // ── Announcements ──
  ...fam('hello', 'Hello World', ['birth', 'baby'],
    { ground: 'inset', photoEdge: 'square', colorways: ['snow', 'ivory', 'sage', 'navy'], popcodeSlot: 'main' },
    { photos: [{ id: 'main', x: 0.10, y: 0.07, w: 0.80, h: 0.66, fit: 'cover', mat: 0.003 }], text: [
      zone('subhead', 'subhead', 'hello, world', { label: 'Opening line', x: 0.5, y: 0.750, size: 0.058, maxW: 0.80, color: 'ink', font: 'cormorant', weight: 400, italic: true, lead: 1.05, lines: 1 }),
      zone('headline', 'headline', 'ADELAIDE ROSE', sans({ label: 'Baby’s name', sample: true, x: 0.5, y: 0.840, size: 0.022, maxW: 0.84, color: 'ink', track: 0.30, lines: 1 })),
      zone('signature', 'signature', 'March 4, 2026 · 7 lbs 2 oz', { label: 'Date and details', sample: true, x: 0.5, y: 0.885, size: 0.019, maxW: 0.84, color: 'accent', font: 'grotesk', track: 0.12, lead: 1.40 }),
    ] },
    { photos: [{ id: 'main', x: 0.05, y: 0.07, w: 0.56, h: 0.86, fit: 'cover', mat: 0.002 }], text: [
      zone('subhead', 'subhead', 'hello, world', { label: 'Opening line', x: 0.805, y: 0.330, size: 0.080, maxW: 0.34, color: 'ink', font: 'cormorant', weight: 400, italic: true, lead: 1.05, lines: 1 }),
      zone('headline', 'headline', 'ADELAIDE ROSE', sans({ label: 'Baby’s name', sample: true, x: 0.805, y: 0.470, size: 0.030, maxW: 0.34, color: 'ink', track: 0.30, lines: 1 })),
      zone('signature', 'signature', 'March 4, 2026 · 7 lbs 2 oz', { label: 'Date and details', sample: true, x: 0.805, y: 0.540, size: 0.026, maxW: 0.34, color: 'accent', font: 'grotesk', track: 0.12, lead: 1.40, lines: 2 }),
    ] }),
  ...fam('date', 'Save the Date', ['savethedate'],
    { ground: 'inset', photoEdge: 'square', colorways: ['evergreen', 'cranberry', 'navy', 'sage'], popcodeSlot: 'main' },
    { frame: { x: 0.055, y: 0.039, w: 0.89, h: 0.922 }, photos: [{ id: 'main', x: 0.14, y: 0.11, w: 0.72, h: 0.58, fit: 'cover' }], text: [
      zone('subhead', 'subhead', 'save the date', { label: 'Opening line', x: 0.5, y: 0.710, size: 0.056, maxW: 0.76, color: 'ink', font: 'cormorant', weight: 400, italic: true, lead: 1.05, lines: 1 }),
      zone('headline', 'headline', 'ANA & JAMES', sans({ label: 'Your names', sample: true, x: 0.5, y: 0.795, size: 0.022, maxW: 0.76, color: 'ink', track: 0.30, lines: 1 })),
      zone('signature', 'signature', 'June 12, 2027 · Hudson, New York', { label: 'Date and place', sample: true, x: 0.5, y: 0.840, size: 0.019, maxW: 0.76, color: 'accent', font: 'grotesk', track: 0.10, lead: 1.40, lines: 2 }),
    ] },
    { frame: { x: 0.039, y: 0.055, w: 0.922, h: 0.89 }, photos: [{ id: 'main', x: 0.09, y: 0.15, w: 0.52, h: 0.70, fit: 'cover' }], text: [
      zone('subhead', 'subhead', 'save the date', { label: 'Opening line', x: 0.78, y: 0.320, size: 0.075, maxW: 0.30, color: 'ink', font: 'cormorant', weight: 400, italic: true, lead: 1.05, lines: 1 }),
      zone('headline', 'headline', 'ANA & JAMES', sans({ label: 'Your names', sample: true, x: 0.78, y: 0.460, size: 0.030, maxW: 0.30, color: 'ink', track: 0.30, lines: 1 })),
      zone('signature', 'signature', 'June 12, 2027 · Hudson, New York', { label: 'Date and place', sample: true, x: 0.78, y: 0.530, size: 0.025, maxW: 0.30, color: 'accent', font: 'grotesk', track: 0.10, lead: 1.40, lines: 2 }),
    ] }),
  ...fam('grad', 'Class Of', ['graduation'],
    { ground: 'inset', photoEdge: 'square', colorways: ['snow', 'navy', 'evergreen', 'cranberry', 'ink'], popcodeSlot: 'main' },
    { photos: [{ id: 'main', x: 0.18, y: 0.12, w: 0.64, h: 0.56, fit: 'cover', mat: 0.026 }], text: [
      zone('subhead', 'subhead', 'CLASS OF 2026', sans({ label: 'Class line', x: 0.5, y: 0.040, size: 0.021, maxW: 0.76, color: 'ink', track: 0.38, lines: 1 })),
      zone('headline', 'headline', 'Jordan Middleton', { label: 'Graduate’s name', sample: true, x: 0.5, y: 0.735, size: 0.060, maxW: 0.86, color: 'ink', font: 'cormorant', weight: 500, lead: 1.05, lines: 1 }),
      zone('signature', 'signature', 'WESTFIELD HIGH SCHOOL', sans({ label: 'School', sample: true, x: 0.5, y: 0.825, size: 0.018, maxW: 0.86, color: 'accent', track: 0.30 })),
    ] },
    { photos: [{ id: 'main', x: 0.27, y: 0.17, w: 0.46, h: 0.56, fit: 'cover', mat: 0.018 }], text: [
      zone('subhead', 'subhead', 'CLASS OF 2026', sans({ label: 'Class line', x: 0.5, y: 0.055, size: 0.029, maxW: 0.60, color: 'ink', track: 0.38, lines: 1 })),
      zone('headline', 'headline', 'Jordan Middleton', { label: 'Graduate’s name', sample: true, x: 0.5, y: 0.775, size: 0.075, maxW: 0.80, color: 'ink', font: 'cormorant', weight: 500, lead: 1.05, lines: 1 }),
      zone('signature', 'signature', 'WESTFIELD HIGH SCHOOL', sans({ label: 'School', sample: true, x: 0.5, y: 0.895, size: 0.025, maxW: 0.80, color: 'accent', track: 0.30 })),
    ] }),
];

// Text centred in a band: after the type is sized, the zones named in a band
// are moved up or down together so they sit centred between `top` and
// `bottom` (fractions of card height), e.g. between the photo's bottom edge
// and the card's. Measured from the drawn type, so it holds whatever the
// buyer types and whatever size the fitter settles on. Full-bleed designs
// keep their fixed placement.
const B = (zones, top, bottom) => ({ zones, top, bottom });
const BANDS = {
  'p-typewriter': [B(['headline'], 0, 0.091), B(['signature'], 0.859, 1)],
  'l-typewriter': [B(['headline'], 0, 0.137), B(['signature'], 0.843, 1)],
  'p-minimal': [B(['headline'], 0, 0.181), B(['signature'], 0.749, 1)],
  'l-minimal': [B(['headline'], 0, 0.225), B(['signature'], 0.785, 1)],
  'p-frame': [B(['headline'], 0.039, 0.14), B(['signature'], 0.76, 0.961)],
  'l-frame': [B(['headline'], 0.055, 0.22), B(['signature'], 0.77, 0.945)],
  'p-modern': [B(['headline', 'subhead'], 0, 0.149), B(['signature', 'year'], 0.771, 1)],
  'l-modern': [B(['headline', 'subhead'], 0, 0.159), B(['signature', 'year'], 0.801, 1)],
  'p-band': [B(['headline', 'signature'], 0.80, 1)],
  'l-band': [B(['headline', 'signature'], 0.76, 1)],
  'p-side': [B(['headline', 'signature'], 0.70, 1)],
  'l-side': [B(['headline', 'signature'], 0, 1)],
  'p-quartet': [B(['headline'], 0, 0.10), B(['signature'], 0.79, 1)],
  'l-quartet': [B(['headline'], 0, 0.14), B(['signature'], 0.82, 1)],
  'p-handwritten': [B(['headline', 'signature'], 0.71, 1)],
  'l-handwritten': [B(['headline', 'signature'], 0.70, 1)],
  'p-gallery': [B(['headline', 'signature'], 0.725, 1)],
  'l-gallery': [B(['headline', 'signature'], 0.76, 1)],
  'p-vertical': [B(['signature'], 0.895, 1)],
  'l-vertical': [B(['signature'], 0.85, 1)],
  'p-hello': [B(['subhead', 'headline', 'signature'], 0.733, 1)],
  'l-hello': [B(['subhead', 'headline', 'signature'], 0, 1)],
  'p-date': [B(['subhead', 'headline', 'signature'], 0.69, 0.961)],
  'l-date': [B(['subhead', 'headline', 'signature'], 0.055, 0.945)],
  'p-grad': [B(['subhead'], 0, 0.101), B(['headline', 'signature'], 0.699, 1)],
  'l-grad': [B(['subhead'], 0, 0.145), B(['headline', 'signature'], 0.755, 1)],
};
for (const t of CARD_TEMPLATES) if (BANDS[t.id]) t.bands = BANDS[t.id];

// Script lines: every zone set in a script ('hand' or 'pinyon' above) is
// `scriptable` and starts in Parisienne; the editor's Script option swaps all
// of a card's script lines to one of SCRIPTS together.
export const SCRIPTS = [
  { id: 'parisienne', label: 'Classic' },
  { id: 'doulaise',   label: 'Formal' },
  { id: 'windsong',   label: 'Sweeping' },
  // Handwritten calligraphy, added with the four hand-lettered designs.
  { id: 'meaculpa',   label: 'Calligraphy' },
  { id: 'sacramento', label: 'Pen' },
];
for (const t of CARD_TEMPLATES) {
  for (const z of t.text) if (z.font === 'hand' || z.font === 'pinyon') { z.font = 'parisienne'; z.scriptable = true; }
  // A design keeps its own script until the buyer picks one (state.script).
  // Rotated or centred display words (Harbor's staggered MERRY / CHRISTMAS)
  // are placed by hand and may overlap by design, so the fitter's
  // no-overlap pass leaves them alone. They still keep to maxW and lines.
  for (const z of t.text) if (z.rotate || z.center) z.free = true;
}

// ── Design your own ─────────────────────────────────────────────────────────
// A blank card for any occasion (2026-10-20): the buyer picks one of these
// layouts and adds text boxes they style and drag. card.html turns the choice
// into an ordinary template on the fly, so rendering, the print bake and the
// scan target are shared with the designs above. Every layout has a photo:
// a phone recognises the card by its picture, and type alone scans badly.
// Photo slots are p1..p4 in every layout, so photos survive a layout change.
// A box is { text, sample, x (centre), y (top), size, font, color, align,
// bold, upper, italic }; `color` is a colourway role or a hex.
const bx = (text, geom) => ({ text, sample: false, align: 'center', bold: false, upper: false, italic: false, ...geom });
const words = (y, size, color = 'ink', x = 0.5, maxW = 0.84) =>
  bx('Your words here', { sample: true, x, y, size, maxW, color, font: 'cormorant' });
const names = (y, size, color = 'ink', x = 0.5, maxW = 0.84) =>
  bx('YOUR NAMES', { sample: true, x, y, size, maxW, color, font: 'grotesk', upper: true });
export const CARD_LAYOUTS = [
  { id: 'full', label: 'Full photo', ground: 'bleed', scrim: 0.16,
    portrait:  { photos: [{ id: 'p1', x: 0, y: 0, w: 1, h: 1 }], boxes: [words(0.775, 0.046, 'onPhoto'), names(0.865, 0.018, 'onPhoto')] },
    landscape: { photos: [{ id: 'p1', x: 0, y: 0, w: 1, h: 1 }], boxes: [words(0.745, 0.064, 'onPhoto'), names(0.865, 0.025, 'onPhoto')] } },
  { id: 'border', label: 'Photo with a border', ground: 'inset',
    portrait:  { photos: [{ id: 'p1', x: 0.06, y: 0.043, w: 0.88, h: 0.914 }], boxes: [words(0.765, 0.046, 'onPhoto'), names(0.855, 0.018, 'onPhoto')] },
    landscape: { photos: [{ id: 'p1', x: 0.043, y: 0.06, w: 0.914, h: 0.88 }], boxes: [words(0.735, 0.064, 'onPhoto'), names(0.850, 0.025, 'onPhoto')] } },
  { id: 'top', label: 'Photo above the words', ground: 'inset',
    portrait:  { photos: [{ id: 'p1', x: 0, y: 0, w: 1, h: 0.68 }], boxes: [words(0.735, 0.050), names(0.855, 0.018)] },
    landscape: { photos: [{ id: 'p1', x: 0, y: 0, w: 1, h: 0.64 }], boxes: [words(0.700, 0.070), names(0.855, 0.025)] } },
  { id: 'side', label: 'Photo beside the words', ground: 'inset',
    portrait:  { photos: [{ id: 'p1', x: 0, y: 0, w: 0.58, h: 1 }], boxes: [words(0.40, 0.040, 'ink', 0.79, 0.38), names(0.56, 0.016, 'ink', 0.79, 0.38)] },
    landscape: { photos: [{ id: 'p1', x: 0, y: 0, w: 0.60, h: 1 }], boxes: [words(0.38, 0.060, 'ink', 0.80, 0.34), names(0.56, 0.022, 'ink', 0.80, 0.34)] } },
  { id: 'framed', label: 'Photo in the middle', ground: 'inset',
    portrait:  { photos: [{ id: 'p1', x: 0.14, y: 0.18, w: 0.72, h: 0.56 }], boxes: [words(0.060, 0.040), names(0.820, 0.018)] },
    landscape: { photos: [{ id: 'p1', x: 0.27, y: 0.20, w: 0.46, h: 0.60 }], boxes: [words(0.055, 0.056), names(0.850, 0.025)] } },
  { id: 'two', label: 'Two photos', ground: 'inset',
    portrait:  { photos: [{ id: 'p1', x: 0.06, y: 0.05, w: 0.435, h: 0.62 }, { id: 'p2', x: 0.505, y: 0.05, w: 0.435, h: 0.62 }], boxes: [words(0.730, 0.045), names(0.850, 0.018)] },
    landscape: { photos: [{ id: 'p1', x: 0.05, y: 0.07, w: 0.44, h: 0.62 }, { id: 'p2', x: 0.51, y: 0.07, w: 0.44, h: 0.62 }], boxes: [words(0.735, 0.060), names(0.875, 0.022)] } },
  { id: 'four', label: 'Four photos', ground: 'inset',
    portrait:  { photos: [
      { id: 'p1', x: 0.06, y: 0.05, w: 0.435, h: 0.30 }, { id: 'p2', x: 0.505, y: 0.05, w: 0.435, h: 0.30 },
      { id: 'p3', x: 0.06, y: 0.36, w: 0.435, h: 0.30 }, { id: 'p4', x: 0.505, y: 0.36, w: 0.435, h: 0.30 }], boxes: [words(0.720, 0.045), names(0.845, 0.018)] },
    landscape: { photos: [
      { id: 'p1', x: 0.05, y: 0.06, w: 0.44, h: 0.30 }, { id: 'p2', x: 0.51, y: 0.06, w: 0.44, h: 0.30 },
      { id: 'p3', x: 0.05, y: 0.37, w: 0.44, h: 0.30 }, { id: 'p4', x: 0.51, y: 0.37, w: 0.44, h: 0.30 }], boxes: [words(0.735, 0.060), names(0.870, 0.022)] } },
];
// What a box may be set in, and in which colours.
export const CUSTOM_FONTS = ['cormorant', 'didone', 'serif', 'editorial', 'cinzel', 'grotesk', 'condensed', 'sans',
  'parisienne', 'doulaise', 'windsong', 'meaculpa', 'sacramento'];
export const CUSTOM_COLORS = [
  { id: 'ink', label: 'Card colour' }, { id: 'accent', label: 'Card accent' },
  { id: '#FFFFFF', label: 'White' }, { id: '#1F1F1F', label: 'Black' }, { id: '#B3262D', label: 'Red' },
  { id: '#2E4A3A', label: 'Green' }, { id: '#1F2B44', label: 'Navy' }, { id: '#A8834A', label: 'Gold' },
];
export const CUSTOM_COLORWAYS = ['snow', 'ivory', 'cranberry', 'evergreen', 'navy', 'sage', 'ink', 'cocoa'];

// The families, in catalogue order, for the storefront grid.
export const CARD_FAMILIES = [...new Set(CARD_TEMPLATES.map((t) => t.family))];
export function familyTemplates(family) { return CARD_TEMPLATES.filter((t) => t.family === family); }

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
    // Counted in designs, not layouts: a design's portrait and landscape are one.
    .map((o) => ({ ...o, count: new Set(templatesForOccasion(o.id).map((t) => t.family)).size }))
    .filter((o) => o.count > 0);
}

// Merge buyer-entered strings over a template's defaults, clamped to the role's
// limit. Server-safe: the print bake calls this too, so a client can't smuggle a
// 10,000-character "signature" into a 300 DPI render.
export function resolveText(template, values = {}, greetingId = 'holiday') {
  return (template.text || []).map((z) => {
    const dflt = (z.greet && z.greet[greetingId]) || z.default;
    const raw = Object.prototype.hasOwnProperty.call(values, z.id) ? values[z.id] : dflt;
    const max = (TEXT_ROLES[z.role] || {}).maxChars || 120;
    return { ...z, default: dflt, value: String(raw == null ? '' : raw).slice(0, max) };
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
