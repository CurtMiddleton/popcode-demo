# Print ordering (Prodigi + Stripe)

Lets a creator order physical products of a Popcode project — **flat photo prints**
and **framed photo tiles** in v1 — fulfilled by [Prodigi](https://www.prodigi.com),
paid via Stripe Checkout. The Popcode scan badge is baked into each photo before
printing, so the printed product stays scannable.

Photo books and calendars are a planned later phase (multi-page layout). The schema
(`asset_urls` jsonb array) and catalog are designed to add them without a migration.

## Architecture

```
order.html  →  composite badge + upload to public print-assets bucket
            →  POST /api/create-checkout   (auth; re-quotes Prodigi, inserts print_orders, opens Stripe Checkout)
            →  Stripe Checkout (buyer pays)
            →  POST /api/stripe-webhook     (raw-body verify; submits the paid order to Prodigi)
order-success.html  →  polls own print_orders row for status
```

- `lib/print/catalog.mjs` — server-authoritative product catalog + Prodigi item/price helpers. **Client SKU/price is never trusted.**
- `api/prodigi-quote.js` — live price for the UI (display only).
- `api/create-checkout.js` — validates owner + SKU + asset URLs, re-quotes Prodigi server-side, charges that × markup.
- `api/stripe-webhook.js` — idempotent; only submits to Prodigi after a verified `checkout.session.completed`.

## One-time setup

### 1. Install the new dependency (locally — keep `node_modules` out of commits)
```
npm install
```
`stripe` was added to `package.json`. Vercel runs its own install at deploy.

### 2. Database
Run `supabase/migrations/2026-06-27-print-orders.sql` in the Supabase SQL editor
(branch first, then prod). Creates `print_orders` + RLS (owner can `select` their
own rows; all writes are server-side via the service-role key).

### 3. Storage bucket
Create a **public** bucket named **`print-assets`** (Supabase dashboard → Storage →
New bucket → Public). Composited print images are uploaded here so Prodigi can fetch
them by URL. The checkout endpoint only accepts asset URLs under this bucket's public
prefix.

### 4. Stripe
- Create a Stripe account; start in **test mode**.
- Add a webhook endpoint → `https://<your-deploy>/api/stripe-webhook`, event
  `checkout.session.completed`. Copy its **Signing secret** (`whsec_…`).
- For local testing: `stripe listen --forward-to <preview>/api/stripe-webhook`.

### 5. Prodigi
- Get a **sandbox** API key from the Prodigi dashboard.
- Verify/extend the SKUs in `lib/print/catalog.mjs` against
  `GET https://api.sandbox.prodigi.com/v4.0/products/{sku}` — that endpoint is the
  authoritative source for valid SKUs/attributes/sizes.

### 6. Vercel env vars (Production + Preview scope)
| Var | Example | Notes |
|---|---|---|
| `PRODIGI_API_KEY` | `…` | sandbox key first |
| `PRODIGI_BASE_URL` | `https://api.sandbox.prodigi.com` | prod: `https://api.prodigi.com` |
| `STRIPE_SECRET_KEY` | `sk_test_…` | live `sk_live_…` at cutover |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | from the webhook endpoint |
| `PRINT_MARKUP_MULTIPLIER` | `1.4` | charged = Prodigi cost × this |
| `PUBLIC_BASE_URL` | `https://popcode.app` | optional; falls back to request host |
| `SUPABASE_SERVICE_ROLE_KEY` | *(existing)* | already set |

No client publishable key is needed — the server returns the Checkout `url` and the
client redirects to it.

## End-to-end test (sandbox)

1. RLS: as a signed-in user, selecting `print_orders` returns only your rows; a client
   insert is denied.
2. Quote: in `order.html`, change product/size/country/qty → price updates; confirm
   `total = round(prodigi_cost × markup)` vs a manual Prodigi sandbox quote.
3. Happy path: Stripe test card `4242 4242 4242 4242`. The `print_orders` row goes
   `pending → paid → submitted` and `prodigi_order_id` populates; the order appears in
   the Prodigi **sandbox** dashboard with the badge-composited image.
4. Webhook: confirm signature verification passes with the raw body, and returns **400**
   if `STRIPE_WEBHOOK_SECRET` is wrong.
5. Idempotency: resend the same webhook event (Stripe dashboard) → no duplicate Prodigi
   order.
6. Failures: cancel at Checkout (`order.html?…&cancelled=1`, row stays `pending`);
   declined card `4000 0000 0000 0002` (no `paid`); a bad SKU → `prodigi_failed` +
   Sentry, webhook still 200.
7. Security: an external (non-`print-assets`) asset URL is rejected by `create-checkout`;
   the server re-quote (not the client total) drives the charged amount.

## Production cutover

Swap `PRODIGI_BASE_URL` and the Stripe keys to live, register the live webhook endpoint,
re-run the migration in prod, create the `print-assets` bucket in prod, and place one
low-cost real order before announcing.

## Notes / gotchas

- **Raw-body webhook**: `api/stripe-webhook.js` sets `export const config = { api:{ bodyParser:false } }`
  and reads the stream manually — required for Stripe signature verification on Vercel.
- **ESM/CJS**: the API functions dynamic-`import()` `lib/print/catalog.mjs` (Vercel bundles
  `api/*.js` as CJS; a static import of a local `.mjs` throws `ERR_REQUIRE_ESM`).
- **Money** is handled in integer minor units (cents) and rounded once in `priceFromQuote`.
- **Dedupe**: projects have duplicate `target_index` rows; `order.html` dedupes by
  `target_index` (keeps first non-null `photo_url`).
