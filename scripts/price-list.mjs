#!/usr/bin/env node
//
// Print the whole shop price list: for every catalog variant, what the print
// provider charges (product + shipping), what we add on top, and what the
// customer actually pays. The point is to be able to eyeball the numbers behind
// every "From $X" and every checkout total in one place.
//
//   PRODIGI_API_KEY=... PRODIGI_BASE_URL=https://api.sandbox.prodigi.com \
//   PRINTIFY_API_TOKEN=... PRINT_MARKUP_MULTIPLIER=1.4 \
//     node scripts/price-list.mjs
//
//   --copies=3          how many of each item in the order (default 1)
//   --inserts=3.75      fixed per-ORDER cost of branded inserts (default 3.75:
//                       the $2.50 companion postcard plus the $1.25 sticker).
//                       Subtracted once per order, which is why it is the thing
//                       that decides whether a cheap item can be sold singly.
//                       Pass --inserts=0 to see the picture without them.
//   --country=GB        destination (default US)
//   --shipping=Budget   Budget | Standard | Express (default Standard)
//   --pages=40          page count for photo books (default: each book's minPages)
//   --type=print,book   only these product types (default: all)
//   --csv               machine-readable output instead of the table
//
// Sandbox and live have DIFFERENT Prodigi keys and prices may differ between
// them — quote against whichever environment you are about to sell from. This
// only reads quotes; it places no orders.
//
// Two things the table cannot show, worth remembering when reading it:
//  - Markup applies to the PRODUCT only; shipping is passed through at cost (see
//    priceParts). "customer price" is the two added together, each rounded UP to
//    a whole unit, so effective markup on the goods runs a little above the
//    multiplier and the blended markup on the whole order runs below it.
//  - These are BUY-ONE-NOW prices: one item, one shipping charge. In the cart a
//    group of items from the same provider is quoted as ONE shipment, so two
//    prints together cost less than twice one print.

import { PRODUCTS, markupFor, priceParts, providerFor } from '../lib/print/catalog.mjs';
import { getProvider } from '../lib/print/providers/index.mjs';

const arg = (name, dflt) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const flag = (name) => process.argv.slice(2).includes(`--${name}`);

const COUNTRY = arg('country', 'US').toUpperCase();
const SHIPPING = arg('shipping', 'Standard');
const PAGES = arg('pages', null);
const COPIES = Math.max(1, parseInt(arg('copies', '1'), 10) || 1);
// Branded inserts are billed per ORDER, not per item, and are NOT in any quote —
// so they come straight off margin, and a single cheap item can easily fail to
// cover them. That is the whole reason this column exists.
const INSERT_MINOR = Math.round(parseFloat(arg('inserts', '3.75')) * 100) || 0;
const CSV = flag('csv');
const MARKUP = Number(process.env.PRINT_MARKUP_MULTIPLIER || 1.4);
const ONLY = (arg('type', '') || '').split(',').filter(Boolean);

const money = (minor, cur = 'USD') =>
  minor == null ? '—' : `${cur === 'USD' ? '$' : cur + ' '}${(minor / 100).toFixed(2)}`;
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

// Sandbox and live take DIFFERENT Prodigi keys, and pointing one at the other's
// base URL returns 401 on every single row — which, until the classification was
// fixed on 2026-09-20, printed as "not servable to US" on all of them and read
// like a catalogue problem. Say it up front instead.
{
  const base = (process.env.PRODIGI_BASE_URL || 'https://api.sandbox.prodigi.com').trim();
  const key = (process.env.PRODIGI_API_KEY || '').trim();
  if (key) {
    const sandboxUrl = /sandbox/.test(base);
    if (sandboxUrl !== key.startsWith('test_')) {
      console.error(`\n⚠ Key/URL mismatch: a ${key.startsWith('test_') ? 'sandbox (test_)' : 'live'} key against ${base}.`);
      console.error(`  Use ${sandboxUrl ? 'https://api.prodigi.com with the live key' : 'https://api.sandbox.prodigi.com with the test_ key'}, or swap the key.`);
      console.error('  Every row will fail to authenticate until these agree.\n');
    }
  }
}

const types = Object.keys(PRODUCTS).filter((t) => !ONLY.length || ONLY.includes(t));
const rows = [];

for (const type of types) {
  const provider = getProvider(providerFor(type));
  if (!provider.isConfigured()) {
    rows.push({ type, id: '(all)', error: `${providerFor(type)} not configured — set its API key` });
    continue;
  }
  for (const variant of PRODUCTS[type]) {
    const pages = variant.isBook ? (PAGES ? parseInt(PAGES, 10) : variant.minPages || null) : null;
    const row = { type, id: variant.id, label: variant.label, sku: variant.sku, pages };
    try {
      const q = await provider.quote({
        variant, copies: COPIES, pageCount: pages,
        destinationCountryCode: COUNTRY, shippingMethod: SHIPPING,
      });
      if (!q) throw new Error('empty quote');
      row.currency = q.currency || 'USD';
      row.shipMinor = q.shippingMinor ?? null;
      row.itemMinor = q.itemsMinor ?? (row.shipMinor == null ? null : q.totalMinor - row.shipMinor);
      row.costMinor = q.totalMinor;
      const parts = priceParts(q, markupFor(type, MARKUP));
      row.printingMinor = parts.printingMinor;
      row.priceMinor = parts.totalMinor;
      row.marginMinor = row.priceMinor - q.totalMinor;
      // What is actually left after the box is packed.
      row.netMinor = row.marginMinor - INSERT_MINOR;
      // Copies needed for this item to cover the inserts on its own. Margin is
      // roughly linear in copies (shipping is passed at cost and barely moves),
      // so scale the per-order goods margin by whatever COPIES produced.
      const perCopy = row.marginMinor / COPIES;
      row.breakEven = perCopy > 0 ? Math.ceil(INSERT_MINOR / perCopy) : null;
      // Printify prices shipping from a full address, so a country-only quote is
      // product-only. Say so rather than letting it read as a total.
      row.partial = row.shipMinor === 0 && providerFor(type) === 'printify';
    } catch (e) {
      row.error = e.unservable ? `not servable to ${COUNTRY} via ${SHIPPING}` : e.message;
    }
    rows.push(row);
    await new Promise((r) => setTimeout(r, 120)); // be gentle on the provider
  }
}

if (CSV) {
  console.log('type,variant_id,sku,pages,copies,currency,product_cost,shipping_cost,total_cost,customer_printing,customer_shipping,customer_price,margin,net_after_inserts,copies_to_break_even,markup_effective,note');
  for (const r of rows) {
    const eff = r.costMinor ? (r.priceMinor / r.costMinor).toFixed(3) : '';
    console.log([
      r.type, r.id, r.sku || '', r.pages ?? '', r.currency || '',
      r.itemMinor != null ? (r.itemMinor / 100).toFixed(2) : '',
      r.shipMinor != null ? (r.shipMinor / 100).toFixed(2) : '',
      r.costMinor != null ? (r.costMinor / 100).toFixed(2) : '',
      r.printingMinor != null ? (r.printingMinor / 100).toFixed(2) : '',
      r.shipMinor != null ? (r.shipMinor / 100).toFixed(2) : '',
      r.priceMinor != null ? (r.priceMinor / 100).toFixed(2) : '',
      r.marginMinor != null ? (r.marginMinor / 100).toFixed(2) : '',
      r.netMinor != null ? (r.netMinor / 100).toFixed(2) : '',
      r.breakEven != null ? r.breakEven : '',
      eff,
      r.error ? `ERROR: ${r.error}` : (r.partial ? 'product only — shipping quoted at checkout' : ''),
    ].map((v) => (/[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(','));
  }
} else {
  console.log(`\nShop price list — to ${COUNTRY}, ${SHIPPING} shipping, ${COPIES} ${COPIES === 1 ? 'copy' : 'copies'}`);
  console.log(`Markup per type: ${types.map((t) => `${t} ×${markupFor(t, MARKUP)}`).join(', ')}`);
  console.log(`Prodigi: ${(process.env.PRODIGI_BASE_URL || 'https://api.sandbox.prodigi.com').trim()}\n`);
  let lastType = null;
  for (const r of rows) {
    if (r.type !== lastType) {
      lastType = r.type;
      console.log(`\n${r.type.toUpperCase()}`);
      console.log(`  ${pad('variant', 22)}${padL('product', 10)}${padL('shipping', 10)}${padL('cost', 10)}${padL('price', 10)}${padL('margin', 10)}${padL('net', 10)}${padL('min qty', 9)}  note`);
      console.log('  ' + '─'.repeat(103));
    }
    if (r.error) { console.log(`  ${pad(r.id, 22)}${padL('—', 10).repeat(5)}${padL('—', 10)}${padL('—', 9)}  ⚠ ${r.error}`); continue; }
    const eff = (r.priceMinor / r.costMinor).toFixed(2);
    const note = [
      r.pages ? `${r.pages}pp` : '',
      r.partial ? 'product only, + shipping at checkout' : '',
      `×${eff} effective`,
    ].filter(Boolean).join(' · ');
    // A net loss is the headline of this table, so mark it rather than leaving
    // it to be spotted in a column of similar-looking numbers.
    const net = r.netMinor != null && r.netMinor < 0 ? `(${money(-r.netMinor, r.currency)})` : money(r.netMinor, r.currency);
    const minQty = r.netMinor == null ? '—' : (r.netMinor >= 0 ? '✓ 1' : (r.breakEven || '—'));
    console.log(`  ${pad(r.id, 22)}${padL(money(r.itemMinor, r.currency), 10)}${padL(money(r.shipMinor, r.currency), 10)}${padL(money(r.costMinor, r.currency), 10)}${padL(money(r.priceMinor, r.currency), 10)}${padL(money(r.marginMinor, r.currency), 10)}${padL(net, 10)}${padL(minQty, 9)}  ${note}`);
  }
  const ok = rows.filter((r) => !r.error);
  const bad = rows.filter((r) => r.error);
  console.log(`\n${ok.length} priced, ${bad.length} failed.`);
  if (bad.length) console.log('Failures are usually a wrong SKU or an unservable destination — check with scripts/verify-prodigi-sku.mjs.');
  console.log('Cart orders share one shipping charge per provider, so multi-item totals are lower than the sum of these rows.');
  if (INSERT_MINOR) {
    console.log(`"net" is margin less ${money(INSERT_MINOR)} of branded inserts, charged ONCE PER ORDER and not present in any quote.`);
    console.log('"min qty" is how many of that item an order needs before it carries its own inserts — the number a per-product minimum should be set to.');
  }
  console.log('');
}

process.exit(rows.some((r) => r.error) ? 1 : 0);
