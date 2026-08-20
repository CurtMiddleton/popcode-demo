# Printify board book + multi-provider fulfillment — design sketch

Status: **design sketch, not built.** Goal: add the Printify **6×6 baby board book**
(and set up for other Printify merch) alongside the existing Prodigi prints/canvas/
framed, without turning the checkout into spaghetti.

The headline finding: **Printify's order model is different enough from Prodigi's that
the abstraction has to account for it up front.** This doc shows the interface, how each
vendor maps onto it, and the honest size of the lift.

---

## 1. The core difference (this drives everything)

**Prodigi** = *quote-by-SKU, order-with-asset-URL.* We hold the SKU (`GLOBAL-FAP-10x10`),
POST a quote with the destination, then POST an order with the SKU + a public image URL.
No pre-registration of products. This is what `lib/print/catalog.mjs` + the three `/api/*`
routes do today.

**Printify** = *product-centric.* Its hierarchy is:
- **Blueprint** — a base product in the catalog (the 6×6 board book is a blueprint).
- **Print Provider** — each blueprint is offered by one or more providers; you pick one.
- **Variant** — a provider's specific size/option combo (e.g. the 6×6, N-page board book).
- **Product** — a blueprint + provider + variant **with artwork attached**, living in *your shop*.
- **Order** — references a **product_id + variant_id** (or, for one-off art, an order with
  uploaded images + print-area placement).

So with Printify you typically **(a) upload artwork, (b) create/prepare a product, then
(c) order against it.** Base price comes from the variant; **shipping is a separate
`.../orders/shipping.json` call**; there's no single "quote" endpoint like Prodigi's.

**Integration risk to validate FIRST (before any real build):** confirm whether Printify
lets us place an order with **per-order uploaded artwork** (each Popcode board book is a
unique set of the customer's photos) *without* permanently creating a catalog product per
customer. Two known paths:
1. Create a throwaway product per order (upload images → create product → order → optionally
   delete). Works but chatty.
2. Order with `line_items` carrying `print_areas` + uploaded image ids directly.
Whichever Printify's current V1/V2 API actually supports decides the Printify adapter's shape.
**One spike against a real Printify sandbox answers this in an hour.**

---

## 2. The abstraction: a `FulfillmentProvider` interface

Everything vendor-specific hides behind one interface. The shared layers (Stripe checkout,
markup math, badge compositing, My Designs, the book/calendar builders) never learn who prints.

```js
// lib/print/providers/types.mjs  (JSDoc "interface" — this is vanilla JS)
//
// A provider adapter implements:
//   quote({ items, destination, shippingMethod }) -> { itemsCostMinor, shippingMinor, currency, raw }
//   submitOrder({ orderId, items, recipient, shippingMethod, assets }) -> { providerOrderId, status, raw }
//   getStatus(providerOrderId) -> { status, tracking, raw }   // optional; webhook or poll
//
// `items` are Popcode-neutral: [{ sku, copies, aspect, assetUrl }]
// The adapter translates them into the vendor's own payload.
```

### Provider registry + per-SKU routing

`catalog.mjs` gains a `provider` on every product, and a registry maps that to an adapter:

```js
// lib/print/catalog.mjs  (sketch)
export const PRODUCTS = {
  print:  { provider: 'prodigi', variants: [ /* GLOBAL-FAP-* ... */ ] },
  tile:   { provider: 'prodigi', variants: [ /* PHOTIL-FRA-* ... */ ] },
  canvas: { provider: 'prodigi', variants: [ /* ... */ ] },
  framed: { provider: 'prodigi', variants: [ /* ... */ ] },
  boardbook: {                      // NEW
    provider: 'printify',
    variants: [
      { id: 'bb-6x6', size: '6×6"', aspect: 1,
        printify: { blueprintId: 0, printProviderId: 0, variantId: 0 } }, // fill from Printify catalog
    ],
  },
};

export function providerFor(productType) { return (PRODUCTS[productType] || {}).provider; }
```

```js
// lib/print/providers/index.mjs
import * as prodigi from './prodigi.mjs';
import * as printify from './printify.mjs';
const REGISTRY = { prodigi, printify };
export function getProvider(name) {
  const p = REGISTRY[name];
  if (!p) throw new Error('Unknown fulfillment provider: ' + name);
  return p;
}
```

The current Prodigi code (`buildProdigiItems`, `prodigiQuote`, `cleanRecipient`, the
quote-vs-order item-shape handling, dry-run) moves almost verbatim into
`providers/prodigi.mjs` behind `quote()` / `submitOrder()`. **No behavior change for
existing products** — it's a lift-and-shift into the adapter.

---

## 3. The three API routes become thin dispatchers

Today each route talks to Prodigi directly. After the refactor they look up the provider
from the product and dispatch. Shared concerns (auth, ownership check, asset-URL prefix
validation, Stripe, idempotent atomic claim, markup) stay in the route.

```js
// api/print-quote.js  (was prodigi-quote.js — kept as alias for back-compat)
const { productType } = req.body;
const provider = getProvider(providerFor(productType));
const q = await provider.quote({ items, destination, shippingMethod });
return res.json({ total_minor: priceFromQuote(q), currency: q.currency });
```

```js
// api/create-checkout.js — unchanged except the quote line:
const provider = getProvider(providerFor(productType));
const q = await provider.quote({ items, destination: recipient.address, shippingMethod });
// ... same server-authoritative re-quote, same Stripe session, same print_orders insert ...
```

```js
// api/finalize-order.js / stripe-webhook.js — unchanged except the submit line:
const provider = getProvider(row.provider);   // provider stored on the print_orders row
const r = await provider.submitOrder({ orderId: row.id, items, recipient, shippingMethod, assets });
// ... same atomic 'submitting' claim, same status transitions, same Sentry ...
```

**What stays 100% shared:** Stripe, `priceFromQuote`/markup, whole-dollar rounding, badge
compositing, aspect-crop, `print_orders` table + idempotency, My Designs. Only `quote()`
and `submitOrder()` fork. That's the whole point — the messy surface is two small adapters,
not two checkout flows.

**One schema add (additive, no migration pain):** `print_orders.provider text default
'prodigi'` so finalize/webhook know which adapter to call. Everything else on the row is
provider-neutral already.

---

## 4. The Printify adapter specifics

```js
// lib/print/providers/printify.mjs  (sketch — the real shapes come from the spike)
const BASE = 'https://api.printify.com/v1';
const H = () => ({ Authorization: `Bearer ${process.env.PRINTIFY_API_TOKEN.trim()}`,
                   'Content-Type': 'application/json' });

export async function quote({ items, destination }) {
  // base cost = sum(variant cost × copies) from the blueprint/variant;
  // shipping = POST /shops/{SHOP}/orders/shipping.json { line_items, address_to }
  // returns { itemsCostMinor, shippingMinor, currency }
}

export async function submitOrder({ orderId, items, recipient, assets }) {
  // 1. POST /uploads/images.json  → upload each composited (badged, aspect-cropped) page
  // 2. build line_items referencing blueprint/print_provider/variant + uploaded image ids
  //    (or a prepared product_id — decided by the §1 spike)
  // 3. POST /shops/{SHOP}/orders.json with external_id = orderId (idempotency/merchantRef)
  // 4. honor PRINTIFY_DRY_RUN (mirror Prodigi's dry-run) — order.send_to_production optional
  // returns { providerOrderId, status }
}
```

Env (Vercel, Production + Preview scopes, mirroring the Prodigi vars):
`PRINTIFY_API_TOKEN`, `PRINTIFY_SHOP_ID`, `PRINTIFY_DRY_RUN`.

---

## 5. Board-book builder UX — you already have ~all of it

A board book is a **multi-page photo product** — which is exactly what `book.html` builds.
The board book is the book-maker's output routed to Printify instead of the PDF proof:
- Reuse the page/photo/layout engine, the popcode-per-page mechanic (each page's photo plays
  its video when scanned — *the* differentiator for a baby board book), the crop/adjust modal.
- Constrain to the 6×6 square page + the board book's fixed page count.
- On "Order", composite each page (badge + square crop) → hand the asset set to the Printify
  adapter via the same checkout as everything else.

So the new UX is mostly a **mode/config of the existing book builder**, not a new builder.

---

## 6. What YOU need to set up (Printify side — I can't do these)

1. Create a **Printify account** + a shop (the "Custom Integration" / API shop type).
2. Generate a **Personal Access Token** (Bearer) — this becomes `PRINTIFY_API_TOKEN`.
3. Find the **board book's** `blueprintId`, the **print provider** id, and the **6×6
   variant id** (via `GET /v1/catalog/blueprints...` or the dashboard) → fill into
   `PRODUCTS.boardbook.variants[].printify`.
4. Confirm the board book's required page count + artwork specs (px/DPI per page, bleed).
5. Note the **shop id** → `PRINTIFY_SHOP_ID`.

(Same shape as the Prodigi go-live: account → key → verify SKUs → env vars → dry-run → real
sandbox order → flip live.)

---

## 7. Phased plan

- **Phase 0 — Spike (1 hr, needs a Printify token):** answer the §1 question — can we order
  with per-order uploaded artwork without a permanent product? Confirm shipping-cost endpoint.
  This de-risks everything.
- **Phase 1 — Refactor to providers (no behavior change):** extract the Prodigi adapter,
  add the registry + `providerFor`, thin the three routes, add `print_orders.provider`.
  Ship behind the existing prints (regression: Prodigi still works identically).
- **Phase 2 — Printify adapter:** implement `quote`/`submitOrder` per the spike, dry-run first.
- **Phase 3 — Board book builder mode:** book.html → 6×6 board-book config → checkout routes
  to Printify. One real sandbox order end-to-end.
- **Phase 4 — Go live:** production env vars, real order, then decide on more Printify merch.

## 8. Honest size of the lift

- **Phase 1 (provider refactor):** ~half a day. It's mechanical — moving Prodigi code into
  an adapter and threading a `provider` field. Low risk, high leverage (every future vendor
  is cheap after this).
- **Phase 2 (Printify adapter):** ~1 day, *plus* the spike. The unknown is the artwork/order
  shape (§1); once known it's a normal REST adapter.
- **Phase 3 (board book mode):** ~1–2 days, mostly UX constraints on the existing builder.
- The scary-sounding part ("two POD platforms") is the *small* part: two ~150-line adapters.
  The shared checkout/payment/markup/design layers don't fork.

**Recommendation:** do Phase 0 + Phase 1 first. Phase 1 is worth doing regardless — it makes
the codebase vendor-agnostic and pays for itself the moment a second vendor (or a better
price on an existing product) shows up. Then the board book is just an adapter + a builder mode.
