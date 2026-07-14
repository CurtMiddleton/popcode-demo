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

A public bucket is publicly *readable*, but uploads still need INSERT/UPDATE RLS
policies on `storage.objects`. Those are included in
`supabase/migrations/2026-06-27-print-orders.sql` (`print-assets insert` / `update`)
— create the bucket first, then run the migration, or you'll hit
"new row violates row-level security policy" on the Pay step.

### 4. Stripe
- Create a Stripe account; start in **test mode**.
- Add a webhook endpoint → `https://<your-deploy>/api/stripe-webhook`, event
  `checkout.session.completed`. Copy its **Signing secret** (`whsec_…`).
- For local testing: `stripe listen --forward-to <preview>/api/stripe-webhook`.

### 5. Prodigi
- Popcode uses its **own dedicated Prodigi account** (Popcode Inc., on a Popcode Inc.
  card). This is **separate from Bashō / Curt Middleton Design, LLC**, which owns the
  original shared account. Never point Popcode at the old shared account's key —
  keep the two accounts, keys, and billing fully separate.
- Get a **sandbox** API key from the Popcode Prodigi dashboard. Sandbox and
  production are **different keys** and each only works against its matching base URL
  (sandbox key `test_…` → `api.sandbox.prodigi.com`; live key → `api.prodigi.com`).
  A key/URL mismatch returns `401 NotAuthenticated`.
- Verify/extend the SKUs in `lib/print/catalog.mjs` against
  `GET https://api.sandbox.prodigi.com/v4.0/products/{sku}` — that endpoint is the
  authoritative source for valid SKUs/attributes/sizes.

### 6. Vercel env vars (Production + Preview scope)
| Var | Example | Notes |
|---|---|---|
| `PRODIGI_API_KEY` | `test_…` (sandbox) / live key | **Popcode's own account only.** Must match `PRODIGI_BASE_URL`'s environment or Prodigi 401s. Trimmed at read time (a stray newline silently 401s). |
| `PRODIGI_BASE_URL` | `https://api.sandbox.prodigi.com` | prod: `https://api.prodigi.com`. This URL **is** the sandbox↔production toggle. |
| `PRODIGI_DRY_RUN` | `true` / *(unset)* | `true` = build the order body but never POST to Prodigi (safe against a live URL); unset/`false` = place real orders. |
| `STRIPE_SECRET_KEY` | `sk_test_…` | live `sk_live_…`/`rk_live_…` at cutover |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | from the webhook endpoint |
| `PRINT_MARKUP_MULTIPLIER` | `1.4` | charged = Prodigi cost × this |
| `PUBLIC_BASE_URL` | `https://popcode.app` | optional; falls back to request host |
| `SUPABASE_SERVICE_ROLE_KEY` | *(existing)* | already set (needs Production **and** Preview scope) |

All five Prodigi consumers read the same two vars — `PRODIGI_API_KEY` + `PRODIGI_BASE_URL`
(both `.trim()`-ed) — so one env swap repoints the whole integration:
`api/prodigi-quote.js`, `api/create-checkout.js`, `api/finalize-order.js`,
`api/stripe-webhook.js`, `api/book-spine.js`. `PRODIGI_DRY_RUN` is read by
`finalize-order.js` + `stripe-webhook.js`.

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

Swap `PRODIGI_API_KEY` to Popcode's **live** key, `PRODIGI_BASE_URL` to
`https://api.prodigi.com`, unset `PRODIGI_DRY_RUN`, switch the Stripe keys to live,
register the live webhook endpoint, re-run the migration in prod, create the
`print-assets` bucket in prod, and place one low-cost real order before announcing.
Verify the live sandbox path first (`test_…` key + `api.sandbox.prodigi.com`) before
touching the production key — a mismatch between key and base URL is the most common
failure and returns `401 NotAuthenticated`.

### Repointing to a new/dedicated Prodigi account (env-only)

The account key lives entirely in Vercel env vars — there is nothing hardcoded in the
repo — so moving Popcode to a different Prodigi account is a pure env swap, no code
change:

1. **Sandbox first.** Set `PRODIGI_API_KEY` = the new account's sandbox key (`test_…`),
   `PRODIGI_BASE_URL` = `https://api.sandbox.prodigi.com`, `PRODIGI_DRY_RUN` unset
   (or `false`), on the **Preview** scope. Redeploy the preview (Vercel env changes
   apply to the *next* build only).
2. Place one sandbox order end-to-end and confirm Prodigi accepts it (correct SKU,
   assets fetch, no auth/verification error). Sandbox orders are free and never print.
3. **Then production.** Set `PRODIGI_API_KEY` = the new account's **live** key,
   `PRODIGI_BASE_URL` = `https://api.prodigi.com` on the **Production** scope, and
   place one low-cost real order.

Do not reuse the previous shared account's key for Popcode — that account belongs to
Bashō / Curt Middleton Design, LLC.

## Notes / gotchas

- **Raw-body webhook**: `api/stripe-webhook.js` sets `export const config = { api:{ bodyParser:false } }`
  and reads the stream manually — required for Stripe signature verification on Vercel.
- **ESM/CJS**: the API functions dynamic-`import()` `lib/print/catalog.mjs` (Vercel bundles
  `api/*.js` as CJS; a static import of a local `.mjs` throws `ERR_REQUIRE_ESM`).
- **Money** is handled in integer minor units (cents) and rounded once in `priceFromQuote`.
- **Dedupe**: projects have duplicate `target_index` rows; `order.html` dedupes by
  `target_index` (keeps first non-null `photo_url`).
