#!/usr/bin/env node
//
// Find out what Prodigi's wall stickers actually cost, before any of them go
// into lib/print/catalog.mjs.
//
//   PRODIGI_API_KEY=... node scripts/probe-wall-stickers.mjs
//
//   --country=US        destination (default US)
//   --shipping=Standard Budget | Standard | Express (default Standard)
//   --copies=1          how many of the item in the order (default 1)
//   --markup=2.0        what you charge over the goods cost (default 2.0)
//   --royalty=0.25      artist's share of the retail price (default 0.25)
//   --inserts=3.75      branded inserts, charged once per ORDER (default 3.75)
//   --csv               machine-readable output
//   <SKU>...            extra SKUs to probe alongside the built-in guesses
//
// Two jobs in one pass. First it asks the catalogue which SKUs exist at all:
// Prodigi publishes "24 sizes, 21x29.7cm to 100x400cm" but not the list, and the
// naming mixes paper sizes (WALL-STKR-A4) with millimetres (WALL-STKR-600X600),
// so the only honest way to get the list is to ask. Guessed SKUs have bitten
// this repo repeatedly; nothing here is added to the catalogue, it is only
// reported. Then, for whatever resolved, it quotes a real order so the retail
// and royalty columns come from Prodigi's prices rather than an assumption.
//
// Read-only: GET on the catalogue and POST to /quotes. It places no orders.

import { sumQuoteMinor } from '../lib/print/catalog.mjs';

const BASE = (process.env.PRODIGI_BASE_URL || 'https://api.prodigi.com').trim().replace(/\/+$/, '');
const KEY = (process.env.PRODIGI_API_KEY || '').trim();

const arg = (n, d) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};
const COUNTRY = arg('country', 'US');
const SHIPPING = arg('shipping', 'Standard');
const COPIES = parseInt(arg('copies', '1'), 10) || 1;
const MARKUP = parseFloat(arg('markup', '2.0'));
const ROYALTY = parseFloat(arg('royalty', '0.25'));
const INSERTS = parseFloat(arg('inserts', '3.75'));
const CSV = process.argv.includes('--csv');

if (!KEY) {
  console.error('usage: PRODIGI_API_KEY=... node scripts/probe-wall-stickers.mjs [--country=US] [SKU...]');
  console.error('  type  export PRODIGI_API_KEY=   then paste the key, so it stays out of your shell history');
  process.exit(2);
}

// Sandbox and live take different keys; pointing one at the other 401s on every
// row and reads exactly like "none of these SKUs exist".
const sandboxUrl = /sandbox/.test(BASE);
const sandboxKey = KEY.startsWith('test_');
if (sandboxUrl !== sandboxKey) {
  console.error(`\n! Key/URL mismatch: a ${sandboxKey ? 'SANDBOX' : 'LIVE'} key against ${BASE}.`);
  console.error(`  Expect 401 on everything. Use PRODIGI_BASE_URL=${sandboxUrl ? 'https://api.prodigi.com' : 'https://api.sandbox.prodigi.com'}\n`);
}

// Prodigi documents the range but not the list. A-series covers the small end
// (A4 is 210x297mm, which is the documented 21x29.7cm minimum) and millimetre
// pairs cover the rest up to the 1000x4000 they name themselves.
const CANDIDATES = [
  'WALL-STKR-A4', 'WALL-STKR-A3', 'WALL-STKR-A2', 'WALL-STKR-A1', 'WALL-STKR-A0',
  'WALL-STKR-300X300', 'WALL-STKR-400X400', 'WALL-STKR-500X500', 'WALL-STKR-600X600',
  'WALL-STKR-700X700', 'WALL-STKR-800X800', 'WALL-STKR-900X900', 'WALL-STKR-1000X1000',
  'WALL-STKR-400X600', 'WALL-STKR-600X400', 'WALL-STKR-600X900', 'WALL-STKR-900X600',
  'WALL-STKR-500X1000', 'WALL-STKR-600X1200', 'WALL-STKR-800X1200',
  'WALL-STKR-1000X1500', 'WALL-STKR-1000X2000', 'WALL-STKR-1000X3000', 'WALL-STKR-1000X4000',
];
const extra = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const skus = [...new Set([...CANDIDATES, ...extra])];

const money = (m) => (m == null ? '—' : '$' + (m / 100).toFixed(2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lookup(sku) {
  const r = await fetch(`${BASE}/v4.0/products/${encodeURIComponent(sku)}`, { headers: { 'X-API-Key': KEY } });
  if (!r.ok) return { ok: false, status: r.status, body: (await r.text()).slice(0, 120) };
  const p = (await r.json()).product;
  return p ? { ok: true, product: p } : { ok: false, status: 200, body: 'no product in response' };
}

async function quote(sku, printAreas) {
  // Quote items take printArea-only assets and reject `sizing` — the shape the
  // order endpoint wants is different, and mixing them up is a 400.
  const assets = (printAreas.length ? printAreas : ['default']).map((printArea) => ({ printArea }));
  const r = await fetch(`${BASE}/v4.0/quotes`, {
    method: 'POST',
    headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      shippingMethod: SHIPPING,
      destinationCountryCode: COUNTRY,
      items: [{ sku, copies: COPIES, attributes: {}, assets }],
    }),
  });
  const text = await r.text();
  if (!r.ok) return { ok: false, status: r.status, body: text.slice(0, 160) };
  let parsed;
  try { parsed = JSON.parse(text); } catch { return { ok: false, status: 200, body: 'unparseable' }; }
  const sum = sumQuoteMinor(parsed);
  if (!sum) return { ok: false, status: 200, body: 'empty quote' };
  return { ok: true, items: sum.itemsMinor, ship: sum.shippingMinor, currency: sum.currency };
}

const rows = [];
const dead = [];

for (const sku of skus) {
  const l = await lookup(sku);
  if (!l.ok) { dead.push({ sku, why: `HTTP ${l.status} ${l.body}` }); await sleep(120); continue; }
  const areas = Object.keys(l.product.printAreas || {});
  const d = l.product.productDimensions || {};
  const size = d.width != null ? `${d.width}×${d.height}${d.units || ''}` : '—';
  await sleep(120);
  const q = await quote(sku, areas);
  if (!q.ok) { dead.push({ sku, why: `quote HTTP ${q.status} ${q.body}`, size }); await sleep(150); continue; }

  const goods = q.items, ship = q.ship, cost = goods + ship;
  const retail = Math.ceil((goods * MARKUP + ship) / 100) * 100;   // markup the goods, pass shipping at cost
  const royalty = Math.round(retail * ROYALTY);
  const net = retail - cost - royalty - Math.round(INSERTS * 100);
  rows.push({ sku, size, areas: areas.length, goods, ship, cost, retail, royalty, net });
  await sleep(150);
}

if (CSV) {
  console.log('sku,size,print_areas,goods,shipping,cost,retail,artist_royalty,your_net');
  for (const r of rows) console.log([r.sku, r.size, r.areas, r.goods, r.ship, r.cost, r.retail, r.royalty, r.net].join(','));
} else {
  console.log(`\nWALL STICKERS — to ${COUNTRY}, ${SHIPPING} shipping, ${COPIES} cop${COPIES === 1 ? 'y' : 'ies'}`);
  console.log(`Markup ×${MARKUP} on goods (shipping at cost) · artist royalty ${Math.round(ROYALTY * 100)}% of retail · inserts ${money(INSERTS * 100)}/order`);
  console.log(`Prodigi: ${BASE}\n`);
  if (rows.length) {
    console.log('  sku                      size           goods   shipping      cost    retail   royalty     net');
    console.log('  ' + '─'.repeat(97));
    for (const r of rows) {
      console.log('  ' + r.sku.padEnd(24) + r.size.padEnd(14)
        + money(r.goods).padStart(8) + money(r.ship).padStart(11) + money(r.cost).padStart(10)
        + money(r.retail).padStart(10) + money(r.royalty).padStart(10)
        + (r.net < 0 ? `(${money(-r.net)})` : money(r.net)).padStart(8));
    }
  } else {
    console.log('  nothing resolved — see the failures below');
  }
  if (dead.length) {
    console.log(`\n${dead.length} did not resolve (a guessed SKU that does not exist looks exactly like this):`);
    for (const d of dead) console.log(`  ✗ ${d.sku.padEnd(24)} ${d.why}`);
  }
  console.log(`\n${rows.length} priced, ${dead.length} failed.`);
  console.log('Nothing here has been added to the catalogue. "net" is what you keep after Prodigi,');
  console.log('the artist and the inserts — the inserts are per ORDER, so a two-item order keeps more.');
  console.log('If the whole list 401s, the key does not match the base URL rather than the SKUs being wrong.');
}
