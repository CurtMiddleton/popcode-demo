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
// Money: minor units everywhere. The markup is applied per provider group via
// catalog.priceFromQuote (which rounds UP to a whole unit), then summed — so the
// charge is never below the marked-up cost of any group.

import { findVariant, priceFromQuote, providerFor } from './catalog.mjs';

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

// Price every group. Returns { groups:[{provider, lines, costMinor, totalMinor,
// currency}], totalMinor, currency }. Throws CartError(unservable) when a
// provider says it can't make/ship a line — that's a deterministic answer, not
// an outage, so callers surface it instead of retrying.
export async function quoteCart({ lines, address, shippingMethod, markup, getProvider, attempts = 3 }) {
  const groups = groupByProvider(lines);
  let totalMinor = 0;
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

    const groupTotal = priceFromQuote(summed.totalMinor, markup);
    currency = summed.currency || currency;
    totalMinor += groupTotal;
    priced.push({ ...group, costMinor: summed.totalMinor, totalMinor: groupTotal, currency });
  }

  return { groups: priced, totalMinor, currency };
}
