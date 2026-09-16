// Cart → priced, provider-grouped order lines.
//
// One shared place for the rules that used to live inline in create-checkout for
// a single item, so api/cart-quote.js and api/create-checkout.js can never drift:
//   - a line is only valid if its (productType, variantId) is in the catalog
//   - a book line must carry an even page count inside the SKU's range
//   - every asset URL must live under our own public storage prefix
//   - lines are grouped by fulfillment provider, because each provider order is a
//     separate shipment with its own shipping cost
//   - each group is quoted ONCE for all its items (that's the point of a cart:
//     five prints ship together and are charged one shipping fee)
//
// Money: minor units everywhere. Each provider group is priced via
// catalog.priceParts — markup on the goods, shipping at cost, both rounded UP —
// then summed, so the charge is never below the real cost of any group. The
// markup itself is per product type (catalog.markupFor); a group that mixes
// types is priced at a cost-weighted blend, so a cart never changes what any one
// item is worth.

import { findVariant, markupFor, priceParts, providerFor } from './catalog.mjs';

export class CartError extends Error {
  constructor(message, { status = 400, unservable = false } = {}) {
    super(message);
    this.status = status;
    this.unservable = unservable;
  }
}

// Validate + normalize the client's lines against the catalog. `requireAssets`
// is off for pricing (Prodigi prices by SKU) and on for checkout.
export function normalizeLines(rawLines, { requireAssets = false, assetPrefix = null } = {}) {
  if (!Array.isArray(rawLines) || !rawLines.length) {
    throw new CartError('Your cart is empty');
  }
  if (rawLines.length > 50) throw new CartError('Too many items in one order');

  return rawLines.map((raw, i) => {
    const productType = raw?.productType || raw?.product_type;
    const variantId = raw?.variantId || raw?.variant_id;
    const variant = findVariant(productType, variantId);
    if (!variant) throw new CartError(`Unknown product on line ${i + 1}`);

    const copies = Math.max(1, parseInt(raw?.copies, 10) || 1);
    if (copies > 99) throw new CartError(`Too many copies on line ${i + 1}`);

    // Page-priced products (photo books) must declare a valid page count.
    let pageCount = null;
    if (variant.isBook) {
      pageCount = parseInt(raw?.pageCount ?? raw?.page_count, 10);
      if (!Number.isInteger(pageCount) || pageCount % 2 !== 0 ||
          pageCount < (variant.minPages || 2) || pageCount > (variant.maxPages || 1000)) {
        throw new CartError(`Invalid book page count on line ${i + 1}`);
      }
    }

    const assetUrls = Array.isArray(raw?.assetUrls || raw?.asset_urls) ? (raw.assetUrls || raw.asset_urls) : [];
    if (requireAssets) {
      if (!assetUrls.length) throw new CartError(`No print file on line ${i + 1}`);
      for (const a of assetUrls) {
        if (!a?.url || typeof a.url !== 'string' || (assetPrefix && !a.url.startsWith(assetPrefix))) {
          throw new CartError(`Invalid print file on line ${i + 1}`);
        }
      }
    }

    return {
      id: raw?.id || null,
      collectionId: raw?.collectionId || raw?.collection_id || null,
      productType,
      variantId,
      variant,
      copies,
      pageCount,
      // Books: stamp the page count onto the INTERIOR asset only (Prodigi's
      // page-priced default print area). The spine asset must not carry it.
      assetUrls: pageCount
        ? assetUrls.map((a) => ((a.print_area || 'default') === 'spine' ? a : { ...a, page_count: pageCount }))
        : assetUrls,
      title: raw?.title || variant.label || productType,
      provider: providerFor(productType),
    };
  });
}

// Split normalized lines into one bucket per fulfillment provider. Each bucket
// becomes one provider order = one shipment = one shipping charge.
export function groupByProvider(lines) {
  const groups = new Map();
  for (const line of lines) {
    if (!groups.has(line.provider)) groups.set(line.provider, []);
    groups.get(line.provider).push(line);
  }
  return [...groups.entries()].map(([provider, groupLines]) => ({ provider, lines: groupLines }));
}

/* The markup to apply to one provider group's goods.

   Every line in a group is usually the same product type (and always is for
   Printify, which only makes board books), in which case this is exactly that
   type's markup. A mixed group — say a print and a tile, both fulfilled by
   Prodigi and shipped together — is blended by each line's share of the goods
   cost, so each item still carries its own rate and the group's single quoted
   total stays authoritative.

   Falls back to the highest markup in the group if the provider didn't break the
   quote down per line. That can only under-price if it's wrong, never over-cost
   us, and it can't fire at all for a single-type group. */
function groupMarkup(group, summed, fallback) {
  const markups = group.lines.map((l) => markupFor(l.productType, fallback));
  if (markups.every((m) => m === markups[0])) return markups[0];

  const weights = summed.lineItems;
  if (!Array.isArray(weights) || weights.length !== markups.length) return Math.max(...markups);
  const total = weights.reduce((a, w) => a + (w.costMinor || 0), 0);
  if (total <= 0) return Math.max(...markups);
  return weights.reduce((a, w, i) => a + (w.costMinor || 0) * markups[i], 0) / total;
}

// Price every group. Returns { groups:[{provider, lines, costMinor, totalMinor,
// currency}], totalMinor, currency }. Throws CartError(unservable) when a
// provider says it can't make/ship a line — that's a deterministic answer, not
// an outage, so callers surface it instead of retrying.
export async function quoteCart({ lines, address, shippingMethod, markup, getProvider, attempts = 3 }) {
  const groups = groupByProvider(lines);
  let totalMinor = 0;
  let printingMinor = 0;
  let shippingCostMinor = 0;
  let currency = 'USD';
  const priced = [];

  for (const group of groups) {
    const provider = getProvider(group.provider);
    if (!provider.isConfigured()) {
      throw new CartError('Print provider not configured', { status: 500 });
    }

    let summed = null;
    for (let attempt = 0; attempt < attempts && !summed; attempt++) {
      try {
        summed = await provider.quote({
          lines: group.lines,
          // Legacy single-line fields, so an adapter that hasn't been taught
          // about `lines` still prices a one-line group correctly.
          variant: group.lines[0].variant,
          copies: group.lines[0].copies,
          pageCount: group.lines[0].pageCount,
          destinationCountryCode: address?.countryCode,
          address,
          shippingMethod,
        });
      } catch (err) {
        if (err.unservable) {
          throw new CartError(
            "We can't ship one of these items to that country. Try a different size or shipping speed.",
            { status: 502, unservable: true },
          );
        }
        if (attempt === attempts - 1) throw err;
      }
    }
    if (!summed) throw new CartError('Could not price this order', { status: 502 });

    const parts = priceParts(summed, groupMarkup(group, summed, markup));
    currency = summed.currency || currency;
    totalMinor += parts.totalMinor;
    printingMinor += parts.printingMinor;
    shippingCostMinor += parts.shippingMinor;
    priced.push({
      ...group,
      costMinor: summed.totalMinor,
      shippingCostMinor: summed.shippingMinor || 0,
      printingMinor: parts.printingMinor,
      shippingMinor: parts.shippingMinor,
      totalMinor: parts.totalMinor,
      currency,
    });
  }

  /* The two checkout lines are now the real thing, not a presentational split
     of one number: printing is the marked-up goods, shipping is the carrier cost
     passed through, and they add up to exactly what is charged because that is
     how the total was built. A multi-provider cart ships in more than one parcel,
     so its shipping line is the sum of each group's carrier cost. */
  /* The rate actually achieved on the goods across the whole order — a blend
     when the cart spans product types, so it reports what happened rather than
     any one type's setting. */
  const goodsCostMinor = priced.reduce(
    (a, g) => a + Math.max(0, g.costMinor - (g.shippingCostMinor || 0)), 0,
  );

  return {
    groups: priced,
    totalMinor,
    currency,
    shippingMinor: shippingCostMinor,
    printingMinor,
    effectiveMarkup: goodsCostMinor > 0 ? printingMinor / goodsCostMinor : null,
  };
}
