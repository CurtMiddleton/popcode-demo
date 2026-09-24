#!/usr/bin/env node
//
// Inspect Printify ornament (or any) blueprints before adding one to
// lib/print/catalog.mjs as a new product.
//
// The blueprint LIST (GET /v1/catalog/blueprints.json) is public, but print
// providers, variants, print areas and shipping all require a token. This dumps
// them for the given blueprint ids so we get the exact ids + print-area names we
// need to wire an order (front photo + back URL panel), plus live shipping cost.
//
//   PRINTIFY_API_TOKEN=... node scripts/printify-catalog.mjs 1623 1625
//
// Defaults to the two ornament blueprints whose descriptions promise DIFFERENT
// designs on front and back (the only kind that can carry a photo on one side and
// a popcode.app URL on the other). Others labelled "2-Side Print" print the SAME
// design both sides and are useless for a back-panel URL.
//
// NOTE: per-unit PRODUCTION cost is NOT in the catalog API. It shows in the
// dashboard (Catalog -> the blueprint -> a provider) or on a created product's
// variant.cost. Shipping cost IS here. The board book's unit cost was pinned from
// a send_to_production:false test order (see lib/print/catalog.mjs).

const BASE = 'https://api.printify.com/v1';
const TOKEN = (process.env.PRINTIFY_API_TOKEN || '').trim();
const ids = process.argv.slice(2).map(Number).filter(Boolean);
const BLUEPRINTS = ids.length ? ids : [1623, 1625];
const SHIP_TO = (process.env.SHIP_TO || 'US').trim().toUpperCase();

if (!TOKEN) {
  console.error('usage: PRINTIFY_API_TOKEN=... node scripts/printify-catalog.mjs [blueprintId...]');
  console.error('       optional: SHIP_TO (default US)');
  console.error('       token: Printify dashboard -> Settings -> Connections -> API / Personal access token');
  process.exit(2);
}

// A just-created token can take a moment to propagate, and the catalog API
// throttles rapid back-to-back calls — both surface as an intermittent 401/429
// (an identical call can succeed on retry). So retry transient statuses with
// backoff and space the calls out a little.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path, tries = 5) {
  let last = '';
  for (let i = 0; i < tries; i++) {
    const r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const text = await r.text();
    if (r.ok) { try { return JSON.parse(text); } catch (_) { return null; } }
    last = `${r.status} on ${path}: ${text.slice(0, 160)}`;
    if (![401, 403, 429, 500, 502, 503, 504].includes(r.status)) break;
    await sleep(900 * (i + 1));
  }
  throw new Error(last);
}

// US-fulfilled providers keep shipping domestic (like the board book's District
// Photo). Flag the country a provider ships from when we can tell.
function providerCountry(v) {
  return (v && (v.location?.country || v.country)) || '';
}

let failed = false;
for (const bp of BLUEPRINTS) {
  console.log(`\n================ blueprint ${bp} ================`);
  let providers;
  try { providers = await get(`/catalog/blueprints/${bp}/print_providers.json`); }
  catch (e) { console.error('  provider list failed:', e.message); failed = true; continue; }
  console.log(`  ${providers.length} print provider(s):`);

  for (const pv of providers) {
    console.log(`\n  -- provider ${pv.id}: ${pv.title} ${providerCountry(pv) ? '(' + providerCountry(pv) + ')' : ''}`);
    let data;
    try { data = await get(`/catalog/blueprints/${bp}/print_providers/${pv.id}/variants.json`); }
    catch (e) { console.error('     variants failed:', e.message); failed = true; continue; }
    const variants = data.variants || [];

    // Print areas ("placeholders") are the whole point: a blueprint with two
    // positions (e.g. front/back) can take different artwork per side.
    const areasOf = (v) => (v.placeholders || []).map(p => `${p.position} ${p.width}x${p.height}`);
    const allAreas = new Set();
    variants.forEach(v => areasOf(v).forEach(a => allAreas.add(a.split(' ')[0])));
    console.log(`     ${variants.length} variant(s); print areas seen: ${[...allAreas].join(', ') || '(none)'}`);
    console.log(`     ${allAreas.has('back') || allAreas.size > 1 ? '>> has a separate back print area (photo front / URL back is possible)' : '>> single print area only (no separate back)'}`);

    // A few sample variants with their shapes/sizes + per-variant print areas.
    for (const v of variants.slice(0, 8)) {
      const opts = Object.values(v.options || {}).join(' / ');
      console.log(`       variant ${v.id}: ${v.title}${opts ? '  [' + opts + ']' : ''}  areas: ${areasOf(v).join(', ')}`);
    }
    if (variants.length > 8) console.log(`       … ${variants.length - 8} more variants`);

    // Shipping cost for SHIP_TO (first item + additional). Cost is in minor units.
    try {
      const ship = await get(`/catalog/blueprints/${bp}/print_providers/${pv.id}/shipping.json`);
      const profs = ship.profiles || [];
      const hit = profs.find(p => (p.countries || []).includes(SHIP_TO)) || profs.find(p => (p.countries || []).includes('REST_OF_THE_WORLD'));
      if (hit) {
        // Printify's shipping profiles give the price as `cost` (minor units),
        // not `amount` — reading `amount` printed "—" for every provider.
        const money = (m) => { const c = m && (m.cost ?? m.amount); return c != null ? `$${(c / 100).toFixed(2)} ${m.currency || ''}`.trim() : '—'; };
        console.log(`     ship ${SHIP_TO}: first ${money(hit.first_item)}, +item ${money(hit.additional_items)}  (handling ${ship.handling_time?.value ?? '?'} ${ship.handling_time?.unit || 'days'})`);
        // If the price still can't be read, show the raw profile rather than a
        // dash — a guessed field name is what hid this number the first time.
        if (money(hit.first_item) === '—') console.log('     raw shipping profile:', JSON.stringify(hit).slice(0, 400));
      } else {
        console.log(`     ship ${SHIP_TO}: no matching profile (ships to: ${[...new Set(profs.flatMap(p => p.countries || []))].slice(0, 12).join(',')}…)`);
      }
    } catch (e) { console.error('     shipping failed:', e.message); }
  }
}

console.log('\nNote: per-unit PRODUCTION cost is not in the catalog API — read it in the');
console.log('dashboard (Catalog -> blueprint -> provider) or from a draft product\'s variant.cost.');
process.exit(failed ? 1 : 0);
