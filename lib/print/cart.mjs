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
// catalog.priceGroup — each line at its retail price (or its type markup when
// it has none), shipping at cost rounded UP, the goods never below
// catalog.MIN_MARKUP x what the lab charges — then summed. A line's price is
// the same alone or in a cart.

import { findVariant, normalizeCopies, priceGroup, providerFor, splitMinor } from './catalog.mjs';
import { quoteRetryDelayMs, sleep } from './providers/statuses.mjs';

export class CartError extends Error {
  constructor(message, { status = 400, unservable = false, methodUnavailable = null } = {}) {
    super(message);
    this.status = status;
    this.unservable = unservable;
    this.methodUnavailable = methodUnavailable;
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

    if ((parseInt(raw?.copies, 10) || 1) > 99) throw new CartError(`Too many copies on line ${i + 1}`);
    // Pack-size products (magnets, stickers, ornaments) are raised to their
    // minimum rather than rejected — see catalog.normalizeCopies. The UI cannot
    // produce a smaller number, so anything that gets here is a stale cart row
    // or a hand-made request, and silently selling three is the right answer for
    // both.
    const copies = normalizeCopies(variant, raw?.copies);

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
        if (err.methodUnavailable) {
          throw new CartError(
            `${err.methodUnavailable} shipping isn't available for one of these items. Choose Standard.`,
            { status: 502, unservable: true, methodUnavailable: err.methodUnavailable },
          );
        }
        if (err.unservable) {
          throw new CartError(
            "We can't ship one of these items to that country. Try a different size or shipping speed.",
            { status: 502, unservable: true },
          );
        }
        // A deterministic failure (an unknown SKU) will answer the same way
        // every time; retrying only delays the error.
        if (err.noRetry || attempt === attempts - 1) throw err;
        await sleep(quoteRetryDelayMs(err, attempt));
      }
    }
    if (!summed) throw new CartError('Could not price this order', { status: 502 });

    const parts = priceGroup(group.lines, summed, markup);
    currency = summed.currency || currency;
    totalMinor += parts.totalMinor;
    printingMinor += parts.printingMinor;
    shippingCostMinor += parts.shippingMinor;
    const linePrices = parts.linePrices;

    /* The parcels this group arrives in, with what the customer pays for each.
       A provider reports its own split (Prodigi groups by the lab that makes the
       items, so a framed print and a flat print travel separately); one that
       reports nothing ships its group together, which is one parcel.

       The group's shipping CHARGE is authoritative — it is what priceGroup
       rounded and what Stripe bills — so the per-parcel figures are a split of
       it that adds up exactly, never a second opinion. Rounding each carrier
       rate up on its own would overshoot the charge and the rows would not
       reconcile. */
    const rawParcels = Array.isArray(summed.parcels) && summed.parcels.length
      ? summed.parcels
      : [{ carrier: null, labCode: null, costMinor: summed.shippingMinor || 0 }];
    /* Split in WHOLE DOLLARS, not cents. priceGroup rounds the group's shipping
       up to a dollar, so every other figure in the summary is whole; a
       proportional split in minor units would put $10.98 and $22.02 under a
       $33.00 line and read as precision we do not have. Splitting the dollars
       and scaling back keeps the rows whole AND exact. */
    const weights = rawParcels.map((x) => x.costMinor || 0);
    const whole = parts.shippingMinor % 100 === 0;
    const target = whole ? parts.shippingMinor / 100 : parts.shippingMinor;
    const shares = splitMinor(weights, target)
      || splitMinor(rawParcels.map(() => 1), target)
      || rawParcels.map(() => 0);
    const charges = shares.map((v) => (whole ? v * 100 : v));
    const parcels = rawParcels.map((x, i) => ({
      carrier: x.carrier || null,
      labCode: x.labCode || null,
      costMinor: x.costMinor || 0,
      shippingMinor: charges[i],
    }));

    priced.push({
      ...group,
      linePrices,
      parcels,
      costMinor: summed.totalMinor,
      shippingCostMinor: summed.shippingMinor || 0,
      printingMinor: parts.printingMinor,
      shippingMinor: parts.shippingMinor,
      totalMinor: parts.totalMinor,
      // The rate this group actually achieved on its goods. Stamped onto the
      // print_orders row so an order records what it was priced at, not whatever
      // the global fallback happens to be when someone reads the row later.
      effectiveMarkup: summed.itemsMinor > 0 ? parts.printingMinor / summed.itemsMinor : null,
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

  /* The real number of boxes that turn up. This used to be inferred from the
     number of PROVIDER groups, which is not the same thing: one Prodigi group
     splits into a parcel per lab, so a cart could promise one delivery and send
     two. */
  const parcels = priced.flatMap((g) => g.parcels || []);

  return {
    groups: priced,
    parcels,
    totalMinor,
    currency,
    shippingMinor: shippingCostMinor,
    printingMinor,
    effectiveMarkup: goodsCostMinor > 0 ? printingMinor / goodsCostMinor : null,
  };
}
