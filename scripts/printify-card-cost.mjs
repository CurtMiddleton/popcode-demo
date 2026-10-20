#!/usr/bin/env node
// What does Printify charge us for each card pack? One held order, read, cancelled.
//
// Printify's catalog API carries ids and print areas but no prices, so a
// product's cost only shows up on an order. This creates ONE order with
// send_to_production:false holding each pack variant in lib/print/catalog.mjs
// (`card`), prints the cost and shipping Printify put on every line, and then
// CANCELS it. Cancelling is not optional: the 2026-08-22 board-book "test" was
// left on hold and the store's Order submission setting sent it to production
// (printed, charged, shipped). Pass --keep only to look at it in the dashboard,
// and cancel it there yourself.
//
//   PRINTIFY_API_TOKEN=... node scripts/printify-card-cost.mjs --to "1 Main St, New Rochelle, NY, 10801"
//
// The token needs orders.read and orders.write. Shipping depends on the
// address, so use a real US one. The artwork is a placeholder image: the
// order is never produced.

import { PRODUCTS } from '../lib/print/catalog.mjs';

const TOKEN = (process.env.PRINTIFY_API_TOKEN || '').trim();
if (!TOKEN) { console.error('Set PRINTIFY_API_TOKEN first.'); process.exit(1); }
const SHOP = (process.env.PRINTIFY_SHOP_ID || '28663478').trim();
const BASE = 'https://api.printify.com/v1';
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const keep = process.argv.includes('--keep');
const to = arg('--to');
const parts = (to || '').split(',').map((s) => s.trim());
if (parts.length !== 4) {
  console.error('Give a US address: --to "street, city, ST, zip"');
  process.exit(1);
}
const [address1, city, region, zip] = parts;

async function call(path, method = 'GET', body) {
  const r = await fetch(`${BASE}${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (_) {}
  if (!r.ok) throw new Error(`${r.status} ${method} ${path} :: ${text.slice(0, 400)}`);
  return json;
}

const ART = 'https://popcode.app/assets/og_image.png';
const packs = PRODUCTS.card;
const order = {
  external_id: `card-cost-check-${Date.now()}`,
  label: 'Popcode cards COST CHECK - not for production',
  send_to_production: false,
  shipping_method: 1,
  address_to: { first_name: 'Cost', last_name: 'Check', email: 'hello@popcodeapp.com',
    country: 'US', region, address1, city, zip },
  line_items: packs.map((v) => ({
    print_provider_id: v.printify.printProviderId,
    blueprint_id: v.printify.blueprintId,
    variant_id: v.printify.variantId,
    quantity: 1,
    print_areas: { front: [{ src: ART, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
                   back:  [{ src: ART, x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
  })),
};

const money = (minor) => (typeof minor === 'number' ? '$' + (minor / 100).toFixed(2) : '?');

let id = null;
try {
  const created = await call(`/shops/${SHOP}/orders.json`, 'POST', order);
  id = created.id;
  console.log(`Created held order ${id}. Reading it back…`);
  // Costs are filled in asynchronously; give Printify a moment.
  let o = null;
  for (let i = 0; i < 10; i++) {
    o = await call(`/shops/${SHOP}/orders/${id}.json`);
    if ((o.line_items || []).every((li) => typeof li.cost === 'number')) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log(`\nstatus: ${o.status}\n`);
  console.log('pack   catalog id      variant   qty   cost     shipping   per card');
  for (const li of o.line_items || []) {
    const v = packs.find((p) => p.printify.variantId === li.variant_id);
    const cards = v ? v.cards : NaN;
    console.log(
      String(cards).padEnd(6), (v ? v.id : '?').padEnd(15), String(li.variant_id).padEnd(9),
      String(li.quantity).padEnd(5), money(li.cost).padEnd(8), money(li.shipping_cost).padEnd(10),
      typeof li.cost === 'number' ? money(Math.round(li.cost / cards)) : '?',
      li.metadata && li.metadata.variant_label ? `  (${li.metadata.variant_label})` : '');
  }
  console.log(`\norder total ${money(o.total_price)}, shipping ${money(o.total_shipping)}, tax ${money(o.total_tax)}`);
  console.log('Shipping is for all four packs in one parcel; a real order ships one pack.');
} catch (e) {
  console.error('\n' + e.message);
  process.exitCode = 1;
} finally {
  if (id && !keep) {
    try {
      const c = await call(`/shops/${SHOP}/orders/${id}/cancel.json`, 'POST');
      console.log(`\nCancelled order ${id} (status: ${c && c.status}).`);
    } catch (e) {
      console.error(`\nCOULD NOT CANCEL order ${id}: ${e.message}`);
      console.error('Cancel it now in the Printify dashboard (Orders), or it may be produced and charged.');
      process.exitCode = 1;
    }
  } else if (id) {
    console.log(`\n--keep: order ${id} is ON HOLD. Cancel it in the Printify dashboard when you're done.`);
  }
}
