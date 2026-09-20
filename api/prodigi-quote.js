// POST /api/prodigi-quote — live price for the order UI (display only).
//
// Body: { productType, variantId, copies, destinationCountryCode, shippingMethod,
//         pageCount }
// 200  { quote_cost_minor, markup, total_minor, printing_minor, shipping_minor,
//        currency, page_count, breakdown }
//
// `printing_minor` is the marked-up PRODUCT price and `shipping_minor` the
// carrier cost passed through; they sum to `total_minor`. The shop's "From $X"
// shows printing_minor alone (shipping isn't knowable before an address), and
// checkout shows both lines.
//
// `pageCount` only applies to page-priced photo books. Omit it and a book is
// priced at its SMALLEST buildable size (variant.minPages) — that is the
// "From $X" the product pages show before a book has any pages in it. The
// count actually used comes back as `page_count` so the UI can label it.
//
// No asset URL is needed: Prodigi prices by SKU + destination + method. This is
// advisory — api/create-checkout.js re-quotes server-side before charging, so a
// stale or tampered UI price can never drive the actual amount.
//
// Env: PRODIGI_API_KEY, PRODIGI_BASE_URL (e.g. https://api.sandbox.prodigi.com),
//      PRINT_MARKUP_MULTIPLIER (e.g. 1.4).

import { Sentry } from './_sentry.js';

const MARKUP = Number(process.env.PRINT_MARKUP_MULTIPLIER || 1.4);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { productType, variantId, copies, destinationCountryCode, shippingMethod, address, pageCount } = req.body || {};
    if (!productType || !variantId || !destinationCountryCode) {
      return res.status(400).json({ error: 'Missing productType, variantId or destinationCountryCode' });
    }

    const { destinationRestriction } = await import('../lib/print/destinations.mjs');
    const blocked = destinationRestriction(destinationCountryCode, address && address.postalOrZipCode);
    if (blocked) return res.status(400).json({ error: blocked.message, restricted: true });

    const { findVariant, markupFor, priceParts, providerFor } = await import('../lib/print/catalog.mjs');
    const variant = findVariant(productType, variantId);
    if (!variant) return res.status(400).json({ error: 'Unknown product' });

    // Page-priced books: Prodigi needs a page count to quote at all, so a
    // request that omits one is priced at the minimum book. Same validation as
    // lib/print/cart.mjs (even, within the variant's bounds) so a display quote
    // can never promise a price checkout would refuse to honour.
    let pages = null;
    if (variant.isBook) {
      if (pageCount == null || pageCount === '') {
        pages = variant.minPages || null;
      } else {
        pages = parseInt(pageCount, 10);
        if (!Number.isInteger(pages) || pages % 2 !== 0 ||
            pages < (variant.minPages || 2) || pages > (variant.maxPages || 1000)) {
          return res.status(400).json({ error: 'Invalid pageCount' });
        }
      }
    }

    const { getProvider } = await import('../lib/print/providers/index.mjs');
    const provider = getProvider(providerFor(productType));
    if (!provider.isConfigured()) return res.status(500).json({ error: 'Print provider not configured' });
    // Retry a couple of times — the print provider occasionally returns an empty
    // quote transiently; a customer shouldn't see a price fail over a blip.
    let summed = null;
    for (let attempt = 0; attempt < 3 && !summed; attempt++) {
      try {
        // `address` is optional and only used by providers that price shipping by
        // full address (e.g. Printify); Prodigi ignores it and prices by country.
        summed = await provider.quote({ variant, copies, pageCount: pages, destinationCountryCode, address, shippingMethod });
      } catch (err) {
        // Unservable routes are a normal answer, not a failure — don't retry.
        if (err.unservable) return res.status(502).json({ error: 'Could not price this product/destination', unservable: true });
        if (attempt === 2) throw err;
      }
    }
    if (!summed) return res.status(502).json({ error: 'Could not price this product/destination', unservable: true });

    // Markup is per product type (see catalog.TYPE_MARKUPS); MARKUP is only the
    // fallback for a type with no entry.
    const typeMarkup = markupFor(productType, MARKUP);
    const parts = priceParts(summed, typeMarkup);
    res.status(200).json({
      quote_cost_minor: summed.totalMinor,
      markup: typeMarkup,
      total_minor: parts.totalMinor,
      printing_minor: parts.printingMinor,
      shipping_minor: parts.shippingMinor,
      currency: summed.currency,
      page_count: pages,
      breakdown: {
        product_and_shipping_minor: summed.totalMinor,
        product_cost_minor: summed.itemsMinor ?? null,
        shipping_cost_minor: summed.shippingMinor ?? null,
        markup: typeMarkup,
      },
    });
  } catch (e) {
    console.error('prodigi-quote error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    res.status(500).json({ error: e.message });
  }
}
