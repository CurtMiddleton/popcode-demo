-- Prodigi print orders + Stripe checkout.
--
-- Additive. RUN IN THE SUPABASE SQL EDITOR (branch first, then prod at cutover).
-- Nothing here is destructive. Backs the order flow in public/order.html and the
-- api/create-checkout.js + api/stripe-webhook.js functions.
--
-- All WRITES happen server-side with the service-role key (which bypasses RLS),
-- so a buyer can never forge a `paid` status, tamper with the charged amount, or
-- insert a row directly. The only client-facing grant is SELECT-your-own-rows so
-- order-success.html can show status.

create table if not exists print_orders (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid,                                  -- buyer / project owner (auth.users.id)
  collection_id       uuid references collections(id) on delete set null,

  -- lifecycle: pending -> paid -> submitted -> (in_production/shipped/complete)
  --            plus: payment_failed | prodigi_failed | cancelled
  status              text not null default 'pending',

  product_type        text,                                  -- 'print' | 'tile' (extensible: 'photobook' | 'calendar')
  sku                 text,
  copies              int  not null default 1,
  sizing              text not null default 'fillPrintArea',
  attributes          jsonb not null default '{}'::jsonb,    -- Prodigi product attributes (finish, frame, ...)

  -- v1: single element; jsonb array so multi-page (books/calendars) needs no migration.
  -- shape: [{ target_index, print_area, url }]
  asset_urls          jsonb,

  -- { name, email, address:{ line1,line2,townOrCity,stateOrCounty,postalOrZipCode,countryCode } }
  recipient           jsonb,
  shipping_method     text default 'Standard',

  -- money is stored in integer MINOR units (cents). markup is a snapshot of the
  -- multiplier at order time. total_charged_minor is reconciled against Stripe.
  currency            text not null default 'USD',
  quote_cost_minor    int,                                   -- Prodigi product + shipping
  markup              numeric,
  total_charged_minor int,

  stripe_session_id   text,
  prodigi_order_id    text,
  prodigi_response    jsonb,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists print_orders_user_id_idx     on print_orders(user_id);
create index if not exists print_orders_stripe_sess_idx on print_orders(stripe_session_id);

-- RLS: readable only by its owner; no client INSERT/UPDATE/DELETE (server-only writes).
alter table print_orders enable row level security;

drop policy if exists "read own print_orders" on print_orders;
create policy "read own print_orders" on print_orders
  for select to authenticated
  using (auth.uid() = user_id);
