-- "Popcodes on anything you buy from the Popcode Shop are always free and
-- unlimited" — the promise on public/pricing.html, made true.
--
-- Additive. RUN IN THE SUPABASE SQL EDITOR before merging the code that uses it.
-- Depends on 2026-09-17-popcode-credits.sql.
--
-- A Popcode exists BEFORE anyone buys a print of it, so it cannot be exempted at
-- the moment it is made. Instead a paid order refunds it: when a print order is
-- fulfilled, the Popcodes on the projects in it are credited back, which leaves
-- the buyer exactly where the page says they will be — those ones never counted.
--
-- Credits are counted in three separate columns rather than one, so the ledger
-- stays legible: what someone bought, what we comped, and what a purchase
-- refunded.

begin;

alter table popcode_credits
  add column if not exists from_purchases integer not null default 0;

-- Null means this order has not been settled yet. Writing a number is the claim,
-- so two callers (the success page and the webhook) cannot both refund it.
alter table print_orders
  add column if not exists popcode_credits_granted integer;

-- ── Allowance now includes purchase refunds ─────────────────────────────────
-- Dropped, not replaced: this adds a column to the returns-table, and
-- create-or-replace cannot change a function's return type. Nothing depends on
-- it but the client, which reads by name.
drop function if exists public.popcode_quota();
create or replace function public.popcode_quota()
returns table (allowance integer, used integer, remaining integer,
               purchased integer, granted integer, from_purchases integer)
language plpgsql stable security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p integer := 0; g integer := 0; f integer := 0; u integer := 0; a integer;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  select coalesce(pc.purchased, 0), coalesce(pc.granted, 0), coalesce(pc.from_purchases, 0)
    into p, g, f
    from popcode_credits pc where pc.user_id = uid;
  u := public.popcode_used(uid);
  a := public.popcode_free_allowance() + coalesce(p, 0) + coalesce(g, 0) + coalesce(f, 0);
  return query select a, u, greatest(a - u, 0), coalesce(p, 0), coalesce(g, 0), coalesce(f, 0);
end;
$$;
grant execute on function public.popcode_quota() to authenticated;

create or replace function public.enforce_popcode_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  allowance integer;
  used integer;
begin
  if coalesce(new.video_url, '') = '' and coalesce(new.audio_url, '') = '' then
    return new;
  end if;

  select c.user_id into owner from collections c where c.id = new.collection_id;
  if owner is null then
    return new;
  end if;
  if public.is_popcode_admin() then
    return new;
  end if;

  if exists (
    select 1 from collection_items ci
    where ci.collection_id = new.collection_id
      and ci.target_index = new.target_index
      and (coalesce(ci.video_url, '') <> '' or coalesce(ci.audio_url, '') <> '')
  ) then
    return new;
  end if;

  select coalesce(pc.purchased, 0) + coalesce(pc.granted, 0) + coalesce(pc.from_purchases, 0)
    into allowance
    from popcode_credits pc where pc.user_id = owner;
  allowance := public.popcode_free_allowance() + coalesce(allowance, 0);
  used := public.popcode_used(owner);

  if used >= allowance then
    raise exception 'POPCODE_QUOTA_EXCEEDED: % of % used', used, allowance
      using hint = 'Buy a pack at /pricing.html';
  end if;
  return new;
end;
$$;

-- ── How many Popcodes are on one project ────────────────────────────────────
-- Same shape as popcode_used, scoped to a collection: media only, deduplicated
-- on target_index, because prod has collections with several rows per page.
create or replace function public.popcode_count_in_collection(cid uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select coalesce(count(*), 0)::int from (
    select distinct ci.target_index
    from collection_items ci
    where ci.collection_id = cid
      and (coalesce(ci.video_url, '') <> '' or coalesce(ci.audio_url, '') <> '')
  ) t;
$$;

-- ── Settle one paid print order ─────────────────────────────────────────────
-- Service-role only: not granted to authenticated, so nobody can call it to
-- credit themselves. Idempotent — the first caller writes the count and every
-- caller after it gets that same number back without granting again.
create or replace function public.popcode_settle_print_order(order_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  o record;
  cids uuid[];
  total integer := 0;
  cid uuid;
begin
  -- The claim and the read are one statement, so two callers cannot both win.
  update print_orders
     set popcode_credits_granted = -1
   where id = order_id
     and popcode_credits_granted is null
  returning * into o;

  if not found then
    select popcode_credits_granted into total from print_orders where id = order_id;
    return coalesce(total, 0);
  end if;

  if o.user_id is null then
    update print_orders set popcode_credits_granted = 0 where id = order_id;
    return 0;
  end if;

  -- A cart order can span projects: the row points at the first and `items`
  -- carries the rest.
  select array_agg(distinct x) into cids from (
    select o.collection_id as x
    union
    select (elem ->> 'collection_id')::uuid
      from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) elem
     where elem ->> 'collection_id' is not null
  ) s where x is not null;

  foreach cid in array coalesce(cids, array[]::uuid[]) loop
    -- Only the buyer's own projects, so a gift order cannot credit someone else.
    if exists (select 1 from collections c where c.id = cid and c.user_id = o.user_id) then
      total := total + public.popcode_count_in_collection(cid);
    end if;
  end loop;

  if total > 0 then
    insert into popcode_credits (user_id, from_purchases)
      values (o.user_id, total)
      on conflict (user_id) do update
        set from_purchases = popcode_credits.from_purchases + excluded.from_purchases,
            updated_at = now();
  end if;

  update print_orders set popcode_credits_granted = total where id = order_id;
  return total;
end;
$$;
revoke all on function public.popcode_settle_print_order(uuid) from public, anon, authenticated;
-- Revoking from PUBLIC takes the default grant away from every role, service_role
-- included, and EXECUTE is not covered by bypassrls — so grant it back explicitly
-- to the one role that calls it.
grant execute on function public.popcode_settle_print_order(uuid) to service_role;

commit;

-- ── Operator notes ──────────────────────────────────────────────────────────
-- Settle orders paid before this shipped (safe to re-run; already-settled
-- orders return their existing number without granting again):
--   select id, public.popcode_settle_print_order(id)
--     from print_orders
--    where status in ('paid','submitted','in_production','shipped','complete')
--      and popcode_credits_granted is null;
--
-- An order stuck at -1 means a caller crashed mid-settle. Clear it to retry:
--   update print_orders set popcode_credits_granted = null where popcode_credits_granted = -1;
