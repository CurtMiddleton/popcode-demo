// POST /api/prodigi-quote — live price for the order UI (display only).
//
// Body: { productType, variantId, copies, destinationCountryCode, shippingMethod }
// 200  { quote_cost_minor, markup, total_minor, currency, breakdown }
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
    const { productType, variantId, copies, destinationCountryCode, shippingMethod, address } = req.body || {};
    if (!productType || !variantId || !destinationCountryCode) {
      return res.status(400).json({ error: 'Missing productType, variantId or destinationCountryCode' });
    }

    const { findVariant, priceFromQuote, providerFor } = await import('../lib/print/catalog.mjs');
    const variant = findVariant(productType, variantId);
    if (!variant) return res.status(400).json({ error: 'Unknown product' });

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
        summed = await provider.quote({ variant, copies, destinationCountryCode, address, shippingMethod });
      } catch (err) {
        // Unservable routes are a normal answer, not a failure — don't retry.
        if (err.unservable) return res.status(502).json({ error: 'Could not price this product/destination', unservable: true });
        if (attempt === 2) throw err;
      }
    }
    if (!summed) return res.status(502).json({ error: 'Could not price this product/destination', unservable: true });

    const total_minor = priceFromQuote(summed.totalMinor, MARKUP);
    res.status(200).json({
      quote_cost_minor: summed.totalMinor,
      markup: MARKUP,
      total_minor,
      currency: summed.currency,
      breakdown: { product_and_shipping_minor: summed.totalMinor, markup: MARKUP },
    });
  } catch (e) {
    console.error('prodigi-quote error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    res.status(500).json({ error: e.message });
  }
}
