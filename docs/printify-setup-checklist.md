# Printify board book — setup checklist

What I need from you to build the Printify adapter (Phase 2) + run the spike. All
click-by-click. Should take ~15 min. Nothing here charges money.

---

## Part 1 — Account + store + API token (~5 min)

1. **Create a Printify account** at printify.com (free). Verify your email.
2. **Create a store** you can order against via API:
   - Top-left store switcher → **Add new store** → choose **"I want to sell on my own / Custom integration"** (labels vary — you want the API/custom option, NOT "connect Etsy/Shopify").
   - Name it e.g. `Popcode`.
3. **Generate a Personal Access Token:**
   - Go to **My Profile → Connections** (or **Settings → API**) → the **Personal access tokens / API** section →
     `https://printify.com/app/account/api`.
   - Click **Generate new token**.
   - **Scopes** — enable at least: `shops.read`, `catalog.read`, `orders.read`,
     `orders.write`, `products.read`, `products.write`, `uploads.read`, `uploads.write`.
     (If it's all-or-nothing, the default full-access token is fine for testing.)
   - **Copy the token** — it's shown once. It looks like a long random string.
4. **Find your shop id:** on the API page it may show it, or I'll read it from the
   token in Part 2. (If shown, note the numeric **shop_id**.)

## Part 2 — Give me the token so I can pull the IDs + run the spike

Two ways — **Option A is easiest and keeps the token out of chat.**

### Option A (recommended) — put the token in Vercel, I do the rest
1. Vercel → the `popcode-demo` project → **Settings → Environment Variables**.
2. Add **`PRINTIFY_API_TOKEN`** = your token, scope = **Preview** only (NOT Production).
   Mark it **Sensitive**.
3. Tell me it's set. I'll add a temporary read-only discovery endpoint
   (`/api/printify-probe`, same pattern as the old sentry-test route), which returns:
   - your shop id,
   - the board-book **blueprint / print-provider / variant** ids + the 6×6 variant,
   - the page-count options + artwork specs (px/DPI/bleed per page),
   - and the **spike answer**: whether Printify accepts per-order uploaded artwork
     without pre-creating a catalog product (this decides the adapter's shape).
   Then I delete the probe. Token never leaves Vercel.

### Option B — run three read-only calls yourself and paste me the output
In a terminal (replace `YOUR_TOKEN`). These only READ the catalog — no orders, no charge:
```bash
TOKEN=YOUR_TOKEN
# 1) your shop id
curl -s https://api.printify.com/v1/shops.json -H "Authorization: Bearer $TOKEN"
# 2) print providers for the board book (blueprint 2727)
curl -s https://api.printify.com/v1/catalog/blueprints/2727/print_providers.json -H "Authorization: Bearer $TOKEN"
# 3) variants for that board book from a provider (use a provider id from step 2)
curl -s "https://api.printify.com/v1/catalog/blueprints/2727/print_providers/PROVIDER_ID/variants.json" -H "Authorization: Bearer $TOKEN"
```
Paste me the JSON (or just the ids). Note: blueprint **2727** is Printify's generic
6×6 board book from the product page; if it 404s I'll find the right blueprint id via
`/v1/catalog/blueprints.json`.

## Part 3 — What I end up with (you don't need to collect these — I will)

- `PRINTIFY_SHOP_ID`, blueprint id, print-provider id, 6×6 variant id
- board-book page count + per-page artwork spec (dimensions, DPI, bleed)
- the spike answer (per-order upload vs product-per-order)

Once I have those I fill in `PRODUCTS.boardbook` in `lib/print/catalog.mjs`, write
`lib/print/providers/printify.mjs` (the adapter — the seam is already in place from
Phase 1), and we test a **dry-run** order on the Vercel preview before anything real.

---

### Notes
- **Keep the token in Vercel Preview only** for now (not Production) — the board book
  isn't live yet, and Preview is where we'll test.
- Printify's **sandbox/live** distinction is different from Prodigi's: there isn't a
  separate sandbox key — you test by creating an order and **not** sending it to
  production (`send_to_production: false`), or by cancelling before production. The
  adapter will default to that "don't produce" mode until we deliberately go live
  (mirrors our `PRODIGI_DRY_RUN` pattern).
- Base URL is `https://api.printify.com/v1/`; auth is `Authorization: Bearer <token>`.
