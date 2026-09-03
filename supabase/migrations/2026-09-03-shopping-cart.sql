-- Shopping cart: multiple designs in one order.
--
-- Additive. RUN IN THE SUPABASE SQL EDITOR (prod). Nothing here is destructive
-- and nothing existing changes behaviour: the single-item "buy it now" path
-- keeps working exactly as before (print_orders rows without order_group_id /
-- items are read the old way).
--
-- Two pieces:
--   1. cart_items — the customer's saved cart. Owner-scoped via RLS; this is the
--      one client-writable print table (a cart line is just an intent to buy, it
--      can't move money). Price is NEVER stored here: api/cart-quote.js and
--      api/create-checkout.js re-quote the provider server-side, so a tampered
--      cart row can only ask for a different product, never a different price.
--   2. print_orders.order_group_id + items — one checkout can now produce several
--      provider orders (Prodigi items in one order, Printify items in another).
--      They share an order_group_id so order-success.html can show them as one
--      purchase, and `items` carries the per-line detail for a multi-item order.

create table if not exists cart_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid(),
  collection_id  uuid references collections(id) on delete cascade,

  product_type   text not null,                          -- catalog key: 'print' | 'tile' | 'book' | 'calendar' | 'boardbook' | ...
  variant_id     text not null,                          -- catalog variant id (size/finish)
  copies         int  not null default 1 check (copies between 1 and 99),

  -- Everything needed to PRINT this line without reopening the maker. The badge
  -- composite / print PDF is built when the line is added (the maker page is the
  -- only place that can render it) and its durable URL stored here.
  --   [{ url, print_area, target_index, page_count }]
  asset_urls     jsonb not null default '[]'::jsonb,
  page_count     int,                                    -- page-priced products (photo books)

  -- Display + rebuild metadata: { orientation, scale, frameColor, sizeLabel, ... }
  options        jsonb not null default '{}'::jsonb,
  title          text,                                   -- line label shown in the cart
  thumb_url      text,                                   -- cart thumbnail

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists cart_items_user_id_idx on cart_items(user_id);

alter table cart_items enable row level security;

drop policy if exists "read own cart_items"   on cart_items;
drop policy if exists "insert own cart_items" on cart_items;
drop policy if exists "update own cart_items" on cart_items;
drop policy if exists "delete own cart_items" on cart_items;

create policy "read own cart_items"   on cart_items for select to authenticated using (auth.uid() = user_id);
create policy "insert own cart_items" on cart_items for insert to authenticated with check (auth.uid() = user_id);
create policy "update own cart_items" on cart_items for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own cart_items" on cart_items for delete to authenticated using (auth.uid() = user_id);

-- One Stripe payment can now fan out to several provider orders. Rows from the
-- same checkout share order_group_id; `items` holds the line detail for a
-- multi-item provider order ([{ product_type, variant_id, sku, copies,
-- asset_urls, page_count, attributes, sizing, title }]).
alter table print_orders add column if not exists order_group_id uuid;
alter table print_orders add column if not exists items jsonb;

create index if not exists print_orders_group_idx on print_orders(order_group_id);
