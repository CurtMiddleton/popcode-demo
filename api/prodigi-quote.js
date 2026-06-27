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

const PRODIGI_BASE_URL = process.env.PRODIGI_BASE_URL || 'https://api.sandbox.prodigi.com';
const PRODIGI_API_KEY = process.env.PRODIGI_API_KEY;
const MARKUP = Number(process.env.PRINT_MARKUP_MULTIPLIER || 1.4);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (!PRODIGI_API_KEY) return res.status(500).json({ error: 'Prodigi not configured' });

  try {
    const { productType, variantId, copies, destinationCountryCode, shippingMethod } = req.body || {};
    if (!productType || !variantId || !destinationCountryCode) {
      return res.status(400).json({ error: 'Missing productType, variantId or destinationCountryCode' });
    }

    const { findVariant, buildProdigiItems, priceFromQuote, sumQuoteMinor } = await import('../lib/print/catalog.mjs');
    const variant = findVariant(productType, variantId);
    if (!variant) return res.status(400).json({ error: 'Unknown product' });

    const items = buildProdigiItems({ variant, copies, assetUrls: [] });
    const quote = await prodigiQuote({ shippingMethod, destinationCountryCode, items });
    const summed = sumQuoteMinor(quote);
    if (!summed) return res.status(502).json({ error: 'Could not price this product/destination' });

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

export async function prodigiQuote({ shippingMethod, destinationCountryCode, items }) {
  const resp = await fetch(`${PRODIGI_BASE_URL}/v4.0/quotes`, {
    method: 'POST',
    headers: { 'X-API-Key': PRODIGI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      shippingMethod: shippingMethod || 'Standard',
      destinationCountryCode,
      items,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Prodigi quote failed (${resp.status}): ${text.slice(0, 300)}`);
  }
  return resp.json();
}
