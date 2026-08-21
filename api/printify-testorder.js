// TEMPORARY. Places ONE Printify board-book order with send_to_production:false
// (recorded in the dashboard, never printed, cancellable) to (a) confirm the live
// upload→order path and (b) capture the base cost for catalog.baseCostMinor.
// Delete after we read the cost. Guarded by ?k=popcode.
//
// GET /api/printify-testorder?k=popcode

const IMG = 'https://popcode.app/assets/og_image.png'; // any public image — cost is by variant
const POSITIONS = ['cover', 'spread_1', 'spread_2', 'spread_3', 'spread_4', 'spread_5', 'spread_6', 'spread_7', 'spread_8', 'spread_9', 'spread_10'];

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if ((req.query.k || '') !== 'popcode') return res.status(403).json({ error: 'nope' });
  const token = (process.env.PRINTIFY_API_TOKEN || '').trim();
  if (!token) return res.status(200).json({ configured: false });

  // Force dry-run regardless of env, so this can NEVER produce.
  process.env.PRINTIFY_DRY_RUN = 'true';
  const shopId = (process.env.PRINTIFY_SHOP_ID || '28663478').trim();

  const order = {
    id: 'popcode-test-' + Date.now(),
    copies: 1,
    shipping_method: 'Standard',
    provider_meta: { blueprintId: 2727, printProviderId: 28, variantId: 148738 },
    asset_urls: POSITIONS.map((p) => ({ url: IMG, print_area: p })),
    recipient: {
      name: 'Popcode Test',
      email: 'test@popcode.app',
      address: { line1: '19 Morris Ave', townOrCity: 'New Rochelle', stateOrCounty: 'NY', postalOrZipCode: '10804', countryCode: 'US' },
    },
  };

  try {
    const { submitOrder } = await import('../lib/print/providers/printify.mjs');
    const result = await submitOrder({ order });

    // If the order was created, fetch its detail to read the cost breakdown.
    let cost = null;
    if (result.ok && result.providerOrderId) {
      const r = await fetch(`https://api.printify.com/v1/shops/${shopId}/orders/${result.providerOrderId}.json`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json().catch(() => null);
      if (j) {
        cost = {
          total_price: j.total_price, total_shipping: j.total_shipping, total_tax: j.total_tax,
          line_items: (j.line_items || []).map((li) => ({ cost: li.cost, shipping_cost: li.shipping_cost, quantity: li.quantity, status: li.status })),
          status: j.status,
        };
      }
    }
    return res.status(200).json({ ok: result.ok, providerOrderId: result.providerOrderId, dryRun: result.dryRun, cost, submitResult: result });
  } catch (e) {
    return res.status(200).json({ error: String(e) });
  }
}
