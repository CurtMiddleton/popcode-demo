// POST /api/book-spine — return the Prodigi spine width (mm) for a book order.
//
// The spine thickness of a layflat book depends on the page count AND the
// binding lab for the destination, so it must be queried per order. The client
// (book.html) uses the returned width to render a width-matched spine strip and
// submit it as the Prodigi `spine` asset.
//
// Ported from trek-folio (Bashō) lib/prodigi.ts: getProdigiSpine +
// extractSpineWidthMm. POSTs to Prodigi's /v4.0/products/spine.
//
// Body: { sku, numberOfPages, destinationCountryCode, state? }
// 200  { widthMm: number|null }   (null = lab/spine lookup failed → skip the spine)
//
// Env: PRODIGI_API_KEY, PRODIGI_BASE_URL.

const PRODIGI_BASE_URL = (process.env.PRODIGI_BASE_URL || 'https://api.sandbox.prodigi.com').trim().replace(/\/+$/, '');
const PRODIGI_API_KEY = (process.env.PRODIGI_API_KEY || '').trim();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!PRODIGI_API_KEY) return res.status(500).json({ error: 'Prodigi not configured' });

  try {
    const { productType, variantId, numberOfPages, destinationCountryCode, state } = req.body || {};
    if (!numberOfPages || !destinationCountryCode) {
      return res.status(400).json({ error: 'Missing numberOfPages / destinationCountryCode' });
    }
    // Resolve the SKU from the catalog (never trust a client-sent SKU).
    const { findVariant } = await import('../lib/print/catalog.mjs');
    const variant = findVariant(productType, variantId);
    if (!variant || !variant.isBook) return res.status(400).json({ error: 'Unknown book product' });
    const sku = variant.sku;
    const resp = await fetch(`${PRODIGI_BASE_URL}/v4.0/products/spine`, {
      method: 'POST',
      headers: { 'X-API-Key': PRODIGI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku,
        numberOfPages: parseInt(numberOfPages, 10),
        destinationCountryCode,
        ...(state ? { state } : {}),
      }),
    });
    const raw = await resp.json().catch(() => null);
    // Best-effort: a non-OK spine lookup returns widthMm:null so the client
    // simply skips the spine — a book without a custom spine still binds.
    return res.status(200).json({ widthMm: extractSpineWidthMm(raw), env: PRODIGI_BASE_URL.includes('sandbox') ? 'sandbox' : 'production' });
  } catch (e) {
    console.error('book-spine error:', e);
    return res.status(200).json({ widthMm: null, error: String(e) });
  }
}

// Tolerant of where the width lands: v4 docs show camelCase spineInfo.widthMm,
// but the sandbox returns PascalCase SpineInfo.WidthMm — and on an error nests
// the whole thing as a stringified JSON under `debugDetails`. 0 = lookup failed
// (e.g. a US order with no state) → treat as null.
function extractSpineWidthMm(raw) {
  const positive = (n) => (typeof n === 'number' && n > 0 ? n : null);
  const fromObj = (o) => {
    if (!o) return null;
    const direct =
      positive(o.spineInfo?.widthMm) ??
      positive(o.spineInfo?.width) ??
      positive(o.SpineInfo?.WidthMm) ??
      positive(o.SpineInfo?.widthMm) ??
      positive(o.spine?.widthMm) ??
      positive(o.widthMm) ??
      positive(o.WidthMm);
    if (direct != null) return direct;
    if (typeof o.debugDetails === 'string') {
      try { return fromObj(JSON.parse(o.debugDetails)); } catch { return null; }
    }
    return null;
  };
  return fromObj(raw);
}
