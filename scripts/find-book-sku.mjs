#!/usr/bin/env node
//
// Find the real SKU for a Prodigi photo book size by probing candidates against
// GET /v4.0/products/{sku}.
//
// Why this exists: BOOK-FE-21X21-SQ-LF-G was a guess and it is WRONG — the live
// API refuses to quote it, so picking "8x8 Square" in the book maker builds a
// whole book and then fails at checkout. Prodigi's own portfolio PDF and product
// pages confirm the 8.3x8.3" (210x210mm) layflat exists but publish no SKU
// string anywhere, and the catalogue endpoint is exact-match only, so there is
// nothing to do but try the plausible spellings.
//
//   PRODIGI_API_KEY=... PRODIGI_BASE_URL=https://api.prodigi.com \
//     node scripts/find-book-sku.mjs
//
// Pass extra candidates as arguments to try them too. Sandbox and live use
// DIFFERENT keys and a mismatch is a 401 on everything (which reads exactly like
// "not found"), so the known-good A4 landscape SKU is probed FIRST as a control:
// if that fails, the key or base URL is wrong, not the candidates.
//
// Reading the catalogue places no orders and costs nothing.

const BASE = (process.env.PRODIGI_BASE_URL || 'https://api.prodigi.com').trim().replace(/\/+$/, '');
const KEY = (process.env.PRODIGI_API_KEY || '').trim();
if (!KEY) {
  console.error('usage: PRODIGI_API_KEY=... node scripts/find-book-sku.mjs [EXTRA-SKU...]');
  process.exit(2);
}

const CONTROL = 'BOOK-FE-A4-L-LF-G';

// The known-good SKU reads BOOK-FE-{size}-{orientation}-{binding}-{finish}
// (BOOK-FE-A4-L-LF-G). For the 8.3×8.3" square, the size AND orientation tokens
// are both unknown — Prodigi publishes only the "BOOK-FE" prefix (verified: the
// marketing PDFs for layflat/hardcover/softcover all stop there), and the
// catalogue endpoint is exact-match, so the only option is to try the plausible
// spellings. This grid is deliberately broad because a read costs nothing.
const SIZES = [
  '21X21', '21x21', '210X210', '210', '21', '8X8', '8x8', '8',
  '21SQ', 'SQ21', 'S21', '21S', 'SQ', 'S', 'SM', 'SML', 'SMALL',
];
const ORIENTATIONS = ['SQ', 'S', '', 'SQR', 'P', 'L'];
// LF (layflat) is the product line itself, so it's fixed; only size/orient/finish
// are really in doubt. (Pass any other spelling Prodigi gives you as an argument.)
const BINDINGS = ['LF'];
const FINISHES = ['G', 'M', 'GL', 'MT', ''];

const candidates = [];
for (const size of SIZES) {
  for (const o of ORIENTATIONS) {
    for (const bind of BINDINGS) {
      for (const f of FINISHES) {
        const sku = ['BOOK-FE', size, o, bind, f].filter(Boolean).join('-');
        if (!candidates.includes(sku)) candidates.push(sku);
      }
    }
  }
}
// The 11.7" square, in case that one is wanted too.
for (const size of ['29X29', '297X297', '11X11', '30SQ', 'L', 'LG', 'LGE'])
  candidates.push(`BOOK-FE-${size}-SQ-LF-G`);
candidates.push(...process.argv.slice(2));

const get = async (sku) => {
  const r = await fetch(`${BASE}/v4.0/products/${encodeURIComponent(sku)}`, { headers: { 'X-API-Key': KEY } });
  let body = null;
  try { body = await r.json(); } catch (_) {}
  return { status: r.status, body };
};

const describe = (p) => {
  const d = p?.productDimensions;
  const dims = d ? `${d.width}x${d.height} ${d.units || ''}`.trim() : '?';
  const areas = p?.printAreas ? Object.keys(p.printAreas).join('/') : '?';
  return `${dims}  printAreas: ${areas}  ${p?.description || ''}`.trim();
};

console.log(`\nProbing ${BASE} with ${candidates.length} candidates\n`);

const control = await get(CONTROL);
if (control.status !== 200) {
  console.error(`! Control SKU ${CONTROL} returned ${control.status}. That one is known to work, so`);
  console.error(`  the key or base URL is wrong (sandbox and live keys are not interchangeable).`);
  console.error(`  Nothing below would be meaningful — fix that first.\n`);
  process.exit(1);
}
console.log(`control ${CONTROL} → 200  ${describe(control.body?.product)}\n`);

const found = [];
for (const sku of candidates) {
  const { status, body } = await get(sku);
  if (status === 200) {
    found.push(sku);
    console.log(`  ✓ ${sku.padEnd(30)} ${describe(body?.product)}`);
  } else {
    process.stdout.write(`  · ${sku} (${status})\r`);
  }
  await new Promise((r) => setTimeout(r, 120));
}
process.stdout.write(' '.repeat(70) + '\r');

if (!found.length) {
  console.log('\nNo candidate resolved. Next steps, in order of effort:');
  console.log('  1. Prodigi dashboard → product catalogue → search "layflat" and read the SKU off the square.');
  console.log('  2. Ask Prodigi support for the 8.3x8.3" layflat SKU — they answer this quickly.');
  console.log('  3. Re-run with the spellings they give: node scripts/find-book-sku.mjs SKU-ONE SKU-TWO');
  console.log('\nUntil then the 8x8 size stays hidden in the book maker, so nobody can start one.');
  process.exit(1);
}

console.log(`\nFound ${found.length}. The 8.3×8.3" one is the row whose dims read "210×210 mm" (or 8.3×8.3 in).`);
console.log('To turn the 8×8 book back on, paste that exact SKU into TWO places:');
console.log('  1. lib/print/catalog.mjs → the `book-21sq-layflat` entry:');
console.log('       set  sku: \'<THE VERIFIED SKU>\'   and DELETE the  hidden: true  flag');
console.log('  2. public/book.html → BOOK_SIZES[\'square-8x8\']: DELETE the  unavailable: true  flag');
console.log('Then sanity-check the price:  node scripts/price-list.mjs --type=book\n');
console.log('(If you\'d rather not touch code, just paste the SKU back to Claude and it will wire + verify it.)\n');
