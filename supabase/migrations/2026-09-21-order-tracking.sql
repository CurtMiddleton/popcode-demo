-- Order tracking from Prodigi — additive, safe to run before the code deploys.
--
-- Until now `status` was written at checkout (pending → paid → submitted) and
-- then never again, and `tracking_url` was only ever typed by hand in the admin
-- panel. So an order page built on this data would show every customer
-- "Submitted" forever. Prodigi sends callbacks as an order moves and returns a
-- shipments array with carrier and tracking; these columns hold it.
--
-- Nothing reads them until api/prodigi-callback.js ships, so run order does not
-- matter here (contrast the `branding` column on 2026-09-15, where the insert
-- named the column unconditionally and SQL had to go first).

begin;

alter table print_orders
  -- One row per parcel, normalised by lib/print/order-status.mjs:
  --   [{ id, status, carrier, tracking_url, tracking_number,
  --      dispatched_at, lab, country, item_ids }]
  -- An order can split across labs, so this is an ARRAY, not one tracking
  -- number — see the two-carrier order 14540074 on 2026-09-21.
  add column if not exists shipments jsonb,

  -- Prodigi's own view, last seen: { stage, details, issues, fetched_at }.
  -- Kept apart from `prodigi_response`, which is the record of what SUBMIT
  -- returned and must not be overwritten as the order moves.
  add column if not exists provider_status jsonb,

  -- When we last successfully reconciled against Prodigi. Distinguishes "no
  -- news" from "never checked", which matters for orders placed before this.
  add column if not exists tracked_at timestamptz;

-- The callback looks an order up by its Prodigi id on every event.
create index if not exists print_orders_prodigi_order_id_idx
  on print_orders (prodigi_order_id)
  where prodigi_order_id is not null;

commit;

-- Customers already have SELECT on their own rows ("read own print_orders",
-- 2026-06-27), and these are plain columns on that row, so the order page needs
-- no new policy and no new endpoint to read them.
--
-- Writes come only from the service key in api/prodigi-callback.js.
