#!/usr/bin/env node
//
// Verify Prodigi SKUs against the live product catalogue before adding them to
// lib/print/catalog.mjs.
//
// This repo has been bitten more than once by SKUs that looked plausible and
// returned SkuNotFound at quote time, and by the MissingRequiredAssets error
// that follows a SKU declaring MORE print areas than we supply assets for. Both
// are answerable up front from GET /v4.0/products/{sku}, which is what this does.
//
//   PRODIGI_API_KEY=... PRODIGI_BASE_URL=https://api.sandbox.prodigi.com \
//     node scripts/verify-prodigi-sku.mjs GLOBAL-POST-MOH-6X4-BLA GLOBAL-POST-GLOS-6X4
//
// Sandbox and live have DIFFERENT keys; a key only works against its matching
// base URL (a mismatch is a 401, not a 404). Defaults to sandbox — verification
// costs nothing there and places no orders.
//
// Exit code is non-zero if any SKU failed to resolve, so this is CI-usable.

const BASE = (process.env.PRODIGI_BASE_URL || 'https://api.sandbox.prodigi.com')
  .trim().replace(/\/+$/, '');
const KEY = (process.env.PRODIGI_API_KEY || '').trim();

const skus = process.argv.slice(2);
if (!KEY || !skus.length) {
  console.error('usage: PRODIGI_API_KEY=... node scripts/verify-prodigi-sku.mjs <SKU> [SKU...]');
  console.error('       optional: PRODIGI_BASE_URL (default https://api.sandbox.prodigi.com)');
  process.exit(2);
}

const dim = (d) => (d && d.width != null ? `${d.width}×${d.height} ${d.units || ''}`.trim() : '—');

// Sandbox keys are prefixed test_; live keys are not. Pointing one at the other
// base URL returns 401 on every SKU, which reads like "the SKU is wrong" unless
// you already know the trap. Say so up front rather than after three failures.
const isSandboxUrl = /sandbox/.test(BASE);
const looksSandboxKey = KEY.startsWith('test_');
if (isSandboxUrl !== looksSandboxKey) {
  const other = isSandboxUrl ? 'https://api.prodigi.com' : 'https://api.sandbox.prodigi.com';
  console.error(
    `\n! Key/URL mismatch: this looks like a ${looksSandboxKey ? 'SANDBOX' : 'LIVE'} key `
    + `but the base URL is ${BASE}.\n`
    + `  Expect 401 on everything. Either use the matching key, or re-run with:\n`
    + `      PRODIGI_BASE_URL=${other} node scripts/verify-prodigi-sku.mjs <SKU>...\n`
    + `  Reading the catalogue is a pure lookup either way — it places no orders.\n`);
}

let failed = 0;

for (const sku of skus) {
  const url = `${BASE}/v4.0/products/${encodeURIComponent(sku)}`;
  let resp;
  try {
    resp = await fetch(url, { headers: { 'X-API-Key': KEY } });
  } catch (e) {
    console.log(`\n✗ ${sku}\n  network error: ${e.message}`);
    failed++;
    continue;
  }

  const text = await resp.text();
  if (!resp.ok) {
    // 401 here almost always means key/base-URL mismatch rather than a bad SKU.
    const hint = resp.status === 401
      ? `  (401 — this key is not valid for ${BASE}. Sandbox and live keys differ;`
        + ` a ${looksSandboxKey ? 'sandbox' : 'live'} key only works against the`
        + ` ${looksSandboxKey ? 'sandbox' : 'live'} base URL.)`
      : '';
    console.log(`\n✗ ${sku}\n  HTTP ${resp.status} ${text.slice(0, 200)}${hint ? '\n' + hint : ''}`);
    failed++;
    continue;
  }

  let product;
  try { product = JSON.parse(text).product; } catch { product = null; }
  if (!product) {
    console.log(`\n✗ ${sku}\n  unexpected response: ${text.slice(0, 200)}`);
    failed++;
    continue;
  }

  const areas = product.printAreas || {};
  const areaNames = Object.keys(areas);

  console.log(`\n✓ ${sku}`);
  console.log(`  description   ${product.description || '—'}`);
  console.log(`  print areas   ${areaNames.length}${areaNames.length ? ' — ' + areaNames.join(', ') : ''}`);
  for (const [n, a] of Object.entries(areas)) {
    const req = a.required === false ? 'optional' : 'REQUIRED';
    console.log(`    · ${n.padEnd(12)} ${req}  ${dim(a.productDimensions)}`
      + (a.defaultSizing ? `  default sizing: ${a.defaultSizing}` : ''));
  }
  console.log(`  dimensions    ${dim(product.productDimensions)}`);
  const attrs = product.attributes || {};
  if (Object.keys(attrs).length) {
    for (const [k, v] of Object.entries(attrs)) {
      console.log(`  attribute     ${k}: ${Array.isArray(v) ? v.join(' | ') : v}`);
    }
  } else {
    console.log('  attributes    none');
  }

  // The thing we actually came to find out.
  const required = Object.entries(areas).filter(([, a]) => a.required !== false);
  if (required.length > 1) {
    console.log(`  ⚠ supplies needed for ${required.length} print areas — a front-only asset`);
    console.log('    will fail with MissingRequiredAssets. See docs/postcard-brief.md.');
  }
}

console.log('');
if (failed) {
  console.log(`${failed} of ${skus.length} SKU(s) did not resolve against ${BASE}`);
  process.exit(1);
}
console.log(`all ${skus.length} SKU(s) resolved against ${BASE}`);
