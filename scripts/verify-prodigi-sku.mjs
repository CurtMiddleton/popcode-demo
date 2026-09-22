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

/* What to say on a 401.

   The old message blamed the base URL outright — and on 2026-09-22 it said that
   sixteen times to a key that was perfectly valid and merely had the thirteen
   characters of a copy-paste placeholder stuck to the front of it. Twenty
   minutes went on the wrong question because the tool sounded certain.

   So describe the key's SHAPE first. Length and the first and last few
   characters give away a mangled paste instantly, and reveal nothing worth
   protecting. Only then mention the host, and as a possibility rather than a
   verdict. */
function keyHint() {
  const shape = `length ${KEY.length}, starts "${KEY.slice(0, 4)}", ends "${KEY.slice(-4)}"`;
  const lines = [`  (401 — the key was rejected by ${BASE}. The key you passed is ${shape}.`];
  // A Prodigi key is a 36-character GUID, or test_ + a GUID on sandbox.
  const plausible = /^(test_)?[0-9a-f-]{30,40}$/i.test(KEY);
  if (!plausible) {
    lines.push('   That does NOT look like a Prodigi key, which is a 36-character GUID');
    lines.push('   (sandbox keys add a test_ prefix). Check for placeholder text left in');
    lines.push('   front of it, a missing character, or a stray space — that is far more');
    lines.push('   often the cause than the wrong host.');
  } else {
    lines.push(`   The shape looks right, so this is most likely the wrong environment:`);
    lines.push(`   sandbox and live keys differ, and a ${looksSandboxKey ? 'sandbox' : 'live'} key only works`);
    lines.push(`   against the ${looksSandboxKey ? 'sandbox' : 'live'} base URL.`);
  }
  return lines.join('\n') + ')';
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
    const hint = resp.status === 401 ? keyHint() : '';
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
