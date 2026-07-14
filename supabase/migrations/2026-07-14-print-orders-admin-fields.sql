-- Admin-editable fulfillment fields for print orders (tracking URL + notes) and
-- an updated get_all_print_orders that returns them.
--
-- Additive. RUN IN THE SUPABASE SQL EDITOR (prod). Safe to run even if you
-- already ran 2026-07-14-print-orders-admin-rpc.sql — this supersedes it.

alter table print_orders add column if not exists tracking_url text;
alter table print_orders add column if not exists admin_notes  text;

-- Return type changed (two new columns) so we must drop before recreate.
drop function if exists get_all_print_orders(integer);

create function get_all_print_orders(max_rows integer default 200)
returns table (
  id                  uuid,
  created_at          timestamptz,
  status              text,
  product_type        text,
  sku                 text,
  copies              integer,
  currency            text,
  quote_cost_minor    integer,
  markup              numeric,
  total_charged_minor integer,
  prodigi_order_id    text,
  stripe_session_id   text,
  recipient           jsonb,
  asset_urls          jsonb,
  prodigi_response    jsonb,
  tracking_url        text,
  admin_notes         text,
  collection_id       uuid,
  user_id             uuid,
  buyer_email         text,
  project_name        text
)
language plpgsql security definer set search_path = public, auth
as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'curtmid@gmail.com' then
    raise exception 'Unauthorized';
  end if;

  return query
    select
      o.id, o.created_at, o.status, o.product_type, o.sku, o.copies, o.currency,
      o.quote_cost_minor, o.markup, o.total_charged_minor,
      o.prodigi_order_id, o.stripe_session_id,
      o.recipient, o.asset_urls, o.prodigi_response,
      o.tracking_url, o.admin_notes,
      o.collection_id, o.user_id,
      coalesce(o.recipient ->> 'email', u.email::text) as buyer_email,
      c.name as project_name
    from print_orders o
    left join auth.users  u on u.id = o.user_id
    left join collections c on c.id = o.collection_id
    order by o.created_at desc
    limit max_rows;
end;
$$;

grant execute on function get_all_print_orders(integer) to authenticated;
