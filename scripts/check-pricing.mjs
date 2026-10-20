// node scripts/check-pricing.mjs — offline checks on catalog.priceGroup, the one
// function that prices the shop, the cart and checkout. No provider is called:
// quotes are stubbed with the lab costs Prodigi returned on 2026-10-20.
import assert from 'node:assert/strict';
import { PRODUCTS, findVariant, priceGroup, retailMinorFor, MIN_MARKUP } from '../lib/print/catalog.mjs';
import { normalizeLines, quoteCart } from '../lib/print/cart.mjs';

const one = (type, id, goods, ship, copies = 1, pageCount = null) => priceGroup(
  [{ productType: type, variant: findVariant(type, id), copies, pageCount }],
  { itemsMinor: goods, shippingMinor: ship, totalMinor: goods + ship }, 1.4);

// Retail prices, shipping passed through and rounded up.
assert.equal(one('calendar', 'cal-a4-undated', 1000, 540).printingMinor, 2900);
assert.equal(one('calendar', 'cal-a4-undated', 1000, 540).shippingMinor, 600);
assert.equal(one('framed', 'cfp-8x10-natural', 3500, 2480).printingMinor, 7500); // colours share a price
assert.equal(one('print', 'fap-5x7', 600, 1075, 3).printingMinor, 4500);         // per copy

// Books: base buys minPages, each page past it adds perPage.
assert.equal(one('book', 'book-21sq-layflat', 2850, 760, 1, 18).printingMinor, 5900);
assert.equal(one('book', 'book-21sq-layflat', 2850 + 22 * 53, 760, 1, 40).printingMinor, 5900 + 22 * 150);

// The floor beats a retail price a lab cost rise has overtaken.
assert.equal(one('calendar', 'cal-a4-undated', 2000, 540).printingMinor, 4000);

// No retail price (held-back stickers): type markup on the goods.
assert.equal(one('sticker', 'sti-5_5', 1005, 3335, 3).printingMinor, Math.ceil((1005 * 2.9) / 100) * 100);

// Printify reports no itemsMinor: goods = total - shipping.
assert.equal(priceGroup([{ productType: 'ornament', variant: findVariant('ornament', 'orn-ceramic'), copies: 2 }],
  { totalMinor: 1602 + 500, shippingMinor: 500 }, 1.4).printingMinor, 3800);

// A cart: each line keeps its own price and the column adds up.
const lines = normalizeLines([
  { productType: 'calendar', variantId: 'cal-a4-undated', copies: 1 },
  { productType: 'print', variantId: 'fap-8x10', copies: 2 },
]);
const priced = await quoteCart({
  lines, address: { countryCode: 'US' }, shippingMethod: 'Standard', markup: 1.4,
  getProvider: () => ({ isConfigured: () => true, quote: async () => ({
    itemsMinor: 2800, shippingMinor: 1300, totalMinor: 4100, currency: 'USD',
    lineItems: [{ costMinor: 1000 }, { costMinor: 1800 }],
  }) }),
});
assert.deepEqual(priced.groups[0].linePrices, [2900, 4400]);
assert.equal(priced.totalMinor, 2900 + 4400 + 1300);

// Every variant we sell has a retail price, except the held-back UK-only ones.
const unpriced = Object.entries(PRODUCTS).flatMap(([t, vs]) =>
  vs.filter((v) => retailMinorFor(t, v, v.minPages) == null).map((v) => `${t}:${v.id}`));
assert.deepEqual(unpriced.filter((k) => !/^(sticker|magnet):/.test(k)), []);

console.log(`pricing OK — retail prices resolve for every sold variant, floor ${MIN_MARKUP}x goods`);
