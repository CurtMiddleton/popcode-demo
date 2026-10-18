-- Books, calendars and board books never count toward the Popcode limit.
--
-- Additive, replaces three functions. RUN IN THE SUPABASE SQL EDITOR (prod).
-- Depends on 2026-09-18-shop-popcodes-free.sql.
--
-- Until now a book's Popcodes counted from the moment they were saved, and were
-- only credited back when the book was ordered. So anyone building a book with
-- more than 5 photos was blocked mid-build and had to buy a pack the pricing
-- page says they don't need (only80yearsyoung, 2026-10-18: 19 photos, bought a
-- 25-pack). book.html also deletes a book's items before re-inserting them, so a
-- save that hit the limit left the book with no videos linked.
--
-- Now the three Shop builders' designs are left out of the count altogether,
-- and a print order no longer credits them back (they were never counted).
-- Orders of other Shop products (a mug made from a standard Popcode) still
-- credit that Popcode back, as before.
--
-- Credits already granted for books ordered before this ran are kept: those
-- accounts simply end up with a few extra.

begin;

-- The collection kinds whose Popcodes are always free. One place, so the
-- count, the trigger and the order settlement agree.
create or replace function public.popcode_free_kind(k text)
returns boolean language sql immutable as $$
  select coalesce(k, '') in ('book', 'calendar', 'boardbook')
$$;

-- ── How many Popcodes a person has made (books etc. left out) ───────────────
create or replace function public.popcode_used(uid uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select coalesce(count(*), 0)::int from (
    select distinct ci.collection_id, ci.target_index
    from collection_items ci
    join collections c on c.id = ci.collection_id
    where c.user_id = uid
      and not public.popcode_free_kind(c.kind)
      and (coalesce(ci.video_url, '') <> '' or coalesce(ci.audio_url, '') <> '')
  ) t;
$$;

-- ── Enforcement: same as 2026-09-18, plus the free-kind exemption ───────────
create or replace function public.enforce_popcode_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  owner_kind text;
  allowance integer;
  used integer;
begin
  if coalesce(new.video_url, '') = '' and coalesce(new.audio_url, '') = '' then
    return new;
  end if;

  select c.user_id, c.kind into owner, owner_kind from collections c where c.id = new.collection_id;
  if owner is null then
    return new;
  end if;
  if public.popcode_free_kind(owner_kind) then
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

-- ── Settle one paid print order: same as 2026-09-18, but free kinds credit 0 ─
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

  select array_agg(distinct x) into cids from (
    select o.collection_id as x
    union
    select (elem ->> 'collection_id')::uuid
      from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) elem
     where elem ->> 'collection_id' is not null
  ) s where x is not null;

  foreach cid in array coalesce(cids, array[]::uuid[]) loop
    -- Only the buyer's own projects, and not books etc. (never counted).
    if exists (select 1 from collections c
                where c.id = cid and c.user_id = o.user_id
                  and not public.popcode_free_kind(c.kind)) then
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
grant execute on function public.popcode_settle_print_order(uuid) to service_role;

commit;

-- ── Check after running ─────────────────────────────────────────────────────
-- Elena's account: `used` should drop by 19.
--   select public.popcode_used(c.user_id) from collections c where c.slug = 'only80yearsyoung';
