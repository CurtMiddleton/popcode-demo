#!/usr/bin/env node
// Read-only Printify catalog probe for FLAT card blueprints.
//
// Finds candidate card products, then for each prints the print providers, the
// variants, and the print-area/placeholder specs we need to fill CARD_PROVIDER in
// lib/print/catalog.mjs. Makes only GET calls — no orders, no charges.
//
//   PRINTIFY_API_TOKEN=xxx node scripts/probe-printify-cards.mjs
//   PRINTIFY_API_TOKEN=xxx node scripts/probe-printify-cards.mjs --blueprint 1234
//
// Same shape as the board-book spike (docs/board-book-printify-plan.md).

const TOKEN = (process.env.PRINTIFY_API_TOKEN || '').trim();
if (!TOKEN) { console.error('Set PRINTIFY_API_TOKEN first.'); process.exit(1); }

const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const BASE = 'https://api.printify.com/v1';

async function get(path) {
  const r = await fetch(`${BASE}${path}`, { headers: H });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${path} :: ${t.slice(0, 300)}`);
  try { return JSON.parse(t); } catch { throw new Error(`Bad JSON from ${path}`); }
}

// A card blueprint is anything whose title reads like flat stationery. Deliberately
// wide — we print the matches and pick by eye rather than guessing a magic id.
const WANTED = /card|postcard|stationer|invitation|greeting|print|poster/i;
const STRONG = /card|postcard|invitation|greeting/i;

const arg = process.argv.indexOf('--blueprint');
const onlyBp = arg > -1 ? process.argv[arg + 1] : null;

async function detail(bp) {
  console.log(`\n${'='.repeat(72)}\nBLUEPRINT ${bp.id} — ${bp.title}  [${bp.brand || '?'}]`);
  const provs = await get(`/catalog/blueprints/${bp.id}/print_providers.json`);
  for (const p of provs) {
    let vs;
    try { vs = await get(`/catalog/blueprints/${bp.id}/print_providers/${p.id}/variants.json`); }
    catch (e) { console.log(`  provider ${p.id} ${p.title}: variants unavailable (${e.message.slice(0,60)})`); continue; }
    const variants = vs.variants || [];
    console.log(`  provider ${p.id} — ${p.title}  (${variants.length} variants)`);
    for (const v of variants.slice(0, 12)) {
      const ph = (v.placeholders || []).map((x) => `${x.position} ${x.width}x${x.height}`).join(', ');
      console.log(`    variant ${v.id}  ${v.title}`);
      if (ph) console.log(`        print areas: ${ph}`);
    }
    if (variants.length > 12) console.log(`    … ${variants.length - 12} more`);
  }
}

(async () => {
  if (onlyBp) {
    await detail(await get(`/catalog/blueprints/${onlyBp}.json`));
    return;
  }
  const all = await get('/catalog/blueprints.json');
  const hits = all.filter((b) => WANTED.test(b.title));
  const strong = hits.filter((b) => STRONG.test(b.title));
  console.log(`${all.length} blueprints total; ${hits.length} loosely match, ${strong.length} strongly.\n`);
  console.log('STRONG MATCHES (card-like):');
  for (const b of strong) console.log(`  ${String(b.id).padStart(5)}  ${b.title}   [${b.brand || '?'}]`);
  console.log('\nOther loose matches:');
  for (const b of hits.filter((b) => !STRONG.test(b.title))) console.log(`  ${String(b.id).padStart(5)}  ${b.title}`);
  console.log('\nDetail for strong matches (re-run with --blueprint <id> for any other):');
  for (const b of strong.slice(0, 6)) { try { await detail(b); } catch (e) { console.log(`  !! ${b.id}: ${e.message.slice(0,120)}`); } }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
