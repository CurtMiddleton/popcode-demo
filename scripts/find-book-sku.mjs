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

// The known-good SKU reads BOOK-FE-{size}-{orientation}-{binding}-{finish}.
// Only the size and orientation tokens are in doubt for the square, so vary
// those and keep LF (layflat). Finish is varied too since it may not be 'G'.
const SIZES = ['21X21', '21x21', '210X210', '8X8', '8x8', 'SQ', 'S'];
const ORIENTATIONS = ['SQ', 'S', '', 'P', 'L'];
const FINISHES = ['G', 'M', ''];

const candidates = [];
for (const size of SIZES) {
  for (const o of ORIENTATIONS) {
    for (const f of FINISHES) {
      const sku = ['BOOK-FE', size, o, 'LF', f].filter(Boolean).join('-');
      if (!candidates.includes(sku)) candidates.push(sku);
    }
  }
}
// The 11.7" square, in case that one is wanted too.
for (const size of ['29X29', '297X297', '11X11']) candidates.push(`BOOK-FE-${size}-SQ-LF-G`);
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

console.log(`\nFound ${found.length}. Put the square one in lib/print/catalog.mjs as book-21sq-layflat's`);
console.log('sku, drop its `hidden` flag, then re-run: node scripts/price-list.mjs --type=book\n');
