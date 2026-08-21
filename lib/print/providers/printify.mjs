// Printify fulfillment adapter (board book, blueprint 2727 / variant 148738).
//
// Second provider behind the same interface as prodigi.mjs (quote + submitOrder +
// isConfigured). Printify's model differs from Prodigi's (see
// docs/board-book-printify-plan.md):
//   - No stateless quote-by-SKU. Product cost is fixed per variant (the board book
//     costs the same regardless of artwork); shipping is a separate address-based
//     call (POST /shops/{shop}/orders/shipping.json). So quote() = baseCost × copies
//     + live shipping when a full address is available, base-only for a country-only
//     display quote.
//   - Orders upload artwork first (POST /uploads/images.json by URL), then create an
//     order whose line item carries print_areas mapping each print position
//     (cover, spread_1..spread_10) to an uploaded image id. No permanent product.
//   - There is NO separate sandbox key. "dry run" = create the order with
//     send_to_production:false (Printify records it but never prints — cancellable).
//     PRINTIFY_DRY_RUN defaults TRUE until we deliberately go live.
//
// Reads its own env (PRINTIFY_*). Loaded via dynamic import() from the CJS routes.

const BASE = 'https://api.printify.com/v1';

function cfg() {
  return {
    token: (process.env.PRINTIFY_API_TOKEN || '').trim(),
    shopId: (process.env.PRINTIFY_SHOP_ID || '28663478').trim(),
    // Default to NOT producing until go-live explicitly sets PRINTIFY_DRY_RUN=false.
    dryRun: (process.env.PRINTIFY_DRY_RUN || 'true').trim().toLowerCase() !== 'false',
  };
}

export const name = 'printify';
export function isConfigured() { return !!cfg().token; }

// Standard | Express | Budget → Printify's numeric shipping method (1 std, 2 priority).
function shippingMethodCode(m) {
  return String(m || '').toLowerCase() === 'express' ? 2 : 1;
}

// Our recipient shape → Printify address_to.
function toPrintifyAddress(recipient) {
  const a = recipient?.address || {};
  const name = (recipient?.name || '').trim();
  const sp = name.indexOf(' ');
  const first = sp > 0 ? name.slice(0, sp) : name;
  const last = sp > 0 ? name.slice(sp + 1) : '';
  const out = {
    first_name: first || name || 'Popcode',
    last_name: last || '.',
    email: recipient?.email || '',
    phone: (recipient?.phone || a.phone || '').trim(),
    country: a.countryCode,
    region: (a.stateOrCounty || '').trim(),
    address1: a.line1,
    address2: (a.line2 || '').trim(),
    city: a.townOrCity,
    zip: a.postalOrZipCode,
  };
  // Drop empty optional strings (Printify is happier without blank region/address2/phone).
  for (const k of ['phone', 'region', 'address2']) if (!out[k]) delete out[k];
  return out;
}

async function pf(path, { method = 'GET', body } = {}) {
  const c = cfg();
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${c.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text().catch(() => '');
  let json = null; try { json = JSON.parse(text); } catch (_) {}
  return { ok: resp.ok, status: resp.status, json, text };
}

// Live price. Returns { totalMinor, currency } or null if unpriceable; throws on a
// hard error. `variant.printify.baseCostMinor` is the fixed product cost (per copy).
export async function quote({ variant, copies = 1, address = null, shippingMethod }) {
  const p = variant.printify || {};
  const qty = Math.max(1, parseInt(copies, 10) || 1);
  if (typeof p.baseCostMinor !== 'number') {
    // Base cost not captured yet (needs the first test order). Unpriceable → the UI
    // shows "—" and Pay stays disabled, same as an unservable Prodigi route.
    const err = new Error('Printify base cost not configured for ' + (variant.id || variant.sku));
    err.unservable = false;
    throw err;
  }
  let totalMinor = p.baseCostMinor * qty;
  const currency = p.currency || 'USD';

  // Live shipping needs a full address; a country-only display quote returns
  // base-only ("From $X"), with shipping added at checkout where the address exists.
  const haveAddress = address && address.line1 && address.townOrCity && address.postalOrZipCode && address.countryCode;
  if (haveAddress) {
    const c = cfg();
    const r = await pf(`/shops/${c.shopId}/orders/shipping.json`, {
      method: 'POST',
      body: {
        line_items: [{ print_provider_id: p.printProviderId, blueprint_id: p.blueprintId, variant_id: p.variantId, quantity: qty }],
        address_to: toPrintifyAddress({ name: 'x x', email: 'x@x.co', address }),
      },
    });
    if (!r.ok) {
      const err = new Error(`Printify shipping failed (${r.status}): ${(r.text || '').slice(0, 300)}`);
      // A 4xx here is usually "we don't ship that there" — deterministic, surface as unservable.
      err.unservable = r.status >= 400 && r.status < 500;
      throw err;
    }
    const std = r.json?.standard, exp = r.json?.express ?? r.json?.priority;
    const shipMinor = shippingMethodCode(shippingMethod) === 2 ? (exp ?? std) : std;
    if (typeof shipMinor === 'number') totalMinor += shipMinor;
  }
  return { totalMinor, currency };
}

// Submit a paid order. `order` is the print_orders row. Uploads each asset by URL to
// Printify, then creates an order mapping positions → uploaded image ids. Returns the
// normalized result the route persists (no DB writes here).
//   order.asset_urls: [{ url, print_area }]  — print_area = 'cover' | 'spread_1'.. etc.
export async function submitOrder({ order }) {
  const c = cfg();
  // The Printify variant config (blueprint/provider/variant ids) is stamped onto the
  // print_orders row's provider_meta at checkout, so finalize/webhook/retry can
  // rebuild the order without the catalog.
  const p = order.provider_meta || {};
  if (!p.blueprintId || !p.printProviderId || !p.variantId) {
    return { ok: false, error: 'Printify variant ids missing on order', response: { order_id: order.id } };
  }

  // 1. Upload each asset by URL → { position: imageId }
  const assets = (order.asset_urls || []).filter((a) => a && a.url && a.print_area);
  const placements = {};
  for (const a of assets) {
    const up = await pf('/uploads/images.json', {
      method: 'POST',
      body: { file_name: `${order.id}-${a.print_area}.png`, url: a.url },
    });
    if (!up.ok || !up.json?.id) {
      return { ok: false, httpStatus: up.status, error: `Printify upload failed for ${a.print_area} (${up.status})`, response: up.json || { body: up.text?.slice(0, 300) } };
    }
    // Printify order print_areas placements use `src` (the uploaded image id), NOT `id`.
    placements[a.print_area] = [{ src: up.json.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }];
  }
  if (!Object.keys(placements).length) {
    return { ok: false, error: 'No positioned board-book assets on order', response: { order_id: order.id } };
  }

  // 2. Create the order. dryRun → send_to_production:false (recorded, not printed).
  const orderBody = {
    external_id: order.id,
    label: `Popcode board book ${order.id}`,
    line_items: [{
      print_provider_id: p.printProviderId,
      blueprint_id: p.blueprintId,
      variant_id: p.variantId,
      quantity: Math.max(1, parseInt(order.copies, 10) || 1),
      print_areas: placements,
    }],
    shipping_method: shippingMethodCode(order.shipping_method),
    send_to_production: !c.dryRun,
    address_to: toPrintifyAddress(order.recipient),
  };

  const r = await pf(`/shops/${c.shopId}/orders.json`, { method: 'POST', body: orderBody });
  if (!r.ok) {
    return { ok: false, httpStatus: r.status, error: `Printify order failed (${r.status}) for ${order.id}`, response: r.json || { body: r.text?.slice(0, 400) } };
  }
  const providerOrderId = r.json?.id || null;
  return { ok: true, dryRun: c.dryRun, providerOrderId, response: { ...r.json, _sentToProduction: !c.dryRun } };
}
