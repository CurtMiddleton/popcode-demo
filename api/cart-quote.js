// POST /api/cart-quote — live price for a whole cart (display only).
//
// Body: { items: [{ productType, variantId, copies, pageCount }],
//         destinationCountryCode, address, shippingMethod }
// 200  { total_minor, currency, markup, groups: [{ provider, total_minor,
//        cost_minor, line_ids }], shipments }
//
// Lines are grouped by fulfillment provider and each group is quoted ONCE, so the
// number the cart shows already reflects the real saving of shipping several
// items together. Advisory only — api/create-checkout.js re-quotes server-side
// before charging, so a stale or tampered cart price can never drive the amount.
//
// No asset URLs needed: providers price by SKU + destination.
//
// Env: PRODIGI_API_KEY, PRODIGI_BASE_URL, PRINTIFY_*, PRINT_MARKUP_MULTIPLIER.

import { Sentry } from './_sentry.js';

const MARKUP = Number(process.env.PRINT_MARKUP_MULTIPLIER || 1.4);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { items, destinationCountryCode, address, shippingMethod } = req.body || {};
    const country = (address && address.countryCode) || destinationCountryCode;
    if (!country) return res.status(400).json({ error: 'Missing destinationCountryCode' });

    const { normalizeLines, quoteCart, CartError } = await import('../lib/print/cart.mjs');
    const { getProvider } = await import('../lib/print/providers/index.mjs');

    let priced;
    try {
      // The companion postcard is a branded insert, not a line item, so it
      // never appears here — it adds nothing to the quote.
      const lines = normalizeLines(items);
      priced = await quoteCart({
        lines,
        address: { ...(address || {}), countryCode: country },
        shippingMethod: shippingMethod || 'Standard',
        markup: MARKUP,
        getProvider,
      });
    } catch (e) {
      if (e instanceof CartError) {
        return res.status(e.status).json({ error: e.message, ...(e.unservable ? { unservable: true } : {}) });
      }
      throw e;
    }

    res.status(200).json({
      total_minor: priced.totalMinor,
      printing_minor: priced.printingMinor,
      shipping_minor: priced.shippingMinor,
      currency: priced.currency,
      // Per-type markups mean there is no single rate; report the one this order
      // actually achieved on its goods. MARKUP is now only a fallback.
      markup: priced.effectiveMarkup ?? MARKUP,
      // One group = one parcel, so the UI can say "ships in 2 parcels" honestly.
      shipments: priced.groups.length,
      groups: priced.groups.map((g) => ({
        provider: g.provider,
        cost_minor: g.costMinor,
        total_minor: g.totalMinor,
        line_ids: g.lines.map((l) => l.id).filter(Boolean),
      })),
      /* Per-line printing charge, so the cart can price each row. Allocated from
         the group total (see allocateLinePrices), so the column always adds up
         to printing_minor — these are a split of what is charged, never a
         second opinion about it. Shipping stays out: it is per parcel, not per
         line, and dividing it would invent a number. */
      lines: priced.groups.flatMap((g) =>
        g.lines.map((l, i) => ({
          id: l.id,
          printing_minor: (g.linePrices && g.linePrices[i]) ?? null,
        })).filter((l) => l.id),
      ),
    });
  } catch (e) {
    console.error('cart-quote error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    res.status(500).json({ error: e.message });
  }
}
