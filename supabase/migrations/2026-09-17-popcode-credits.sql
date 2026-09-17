-- Popcode credits: the free five, the packs, and the quota that enforces them.
--
-- Additive. RUN IN THE SUPABASE SQL EDITOR. Nothing here is destructive.
-- Backs public/pricing.html and the api/buy-credits.js + api/finalize-credits.js
-- functions.
--
-- DEPLOY ORDER: SQL FIRST, then merge the code. api/buy-credits.js writes to
-- credit_orders on every call, so merging first takes pack checkout down (the
-- table would not exist). Adding tables nothing reads yet is safe on its own.
--
-- All WRITES happen server-side with the service-role key, which bypasses RLS,
-- so a buyer can never grant themselves credits or forge a paid status. The only
-- client-facing grant is SELECT-your-own-rows plus the read-only quota RPC.

begin;

-- ── What a person has bought ────────────────────────────────────────────────
create table if not exists popcode_credits (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  purchased   integer not null default 0,   -- credits from packs
  granted     integer not null default 0,   -- comps and adjustments, by hand
  updated_at  timestamptz not null default now()
);

-- ── One row per pack purchase ───────────────────────────────────────────────
create table if not exists credit_orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete set null,
  pack_id           text not null,                       -- 'pack25' | 'pack100'
  credits           integer not null,
  -- pending -> granting -> granted, or payment_failed. 'granting' is the atomic
  -- claim: the success page and the webhook can both arrive, and only the one
  -- that wins the claim adds the credits.
  status            text not null default 'pending',
  amount_minor      integer,
  currency          text not null default 'usd',
  stripe_session_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists credit_orders_user_idx    on credit_orders (user_id, created_at desc);
create index if not exists credit_orders_session_idx on credit_orders (stripe_session_id);

alter table popcode_credits enable row level security;
alter table credit_orders   enable row level security;

drop policy if exists "own credits readable"  on popcode_credits;
drop policy if exists "own credit orders readable" on credit_orders;
create policy "own credits readable" on popcode_credits
  for select to authenticated using (user_id = auth.uid() or public.is_popcode_admin());
create policy "own credit orders readable" on credit_orders
  for select to authenticated using (user_id = auth.uid() or public.is_popcode_admin());
-- No insert/update/delete policy on purpose: writes are service-role only.

-- ── How many Popcodes a person has made ─────────────────────────────────────
-- A Popcode is a photo with something behind it, so rows with no media do not
-- count. Deduplicated on (collection_id, target_index): prod has collections
-- with several rows per page from earlier saves, and those are one Popcode.
create or replace function public.popcode_used(uid uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select coalesce(count(*), 0)::int from (
    select distinct ci.collection_id, ci.target_index
    from collection_items ci
    join collections c on c.id = ci.collection_id
    where c.user_id = uid
      and (coalesce(ci.video_url, '') <> '' or coalesce(ci.audio_url, '') <> '')
  ) t;
$$;

-- The free tier, in one place. Both the quota read and the trigger use it.
create or replace function public.popcode_free_allowance()
returns integer language sql immutable as $$ select 5 $$;

-- ── What the client reads ───────────────────────────────────────────────────
-- Own row only; no argument, so it cannot be used to inspect anyone else.
create or replace function public.popcode_quota()
returns table (allowance integer, used integer, remaining integer, purchased integer, granted integer)
language plpgsql stable security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p integer := 0;
  g integer := 0;
  u integer := 0;
  a integer;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  select coalesce(pc.purchased, 0), coalesce(pc.granted, 0) into p, g
    from popcode_credits pc where pc.user_id = uid;
  u := public.popcode_used(uid);
  a := public.popcode_free_allowance() + coalesce(p, 0) + coalesce(g, 0);
  return query select a, u, greatest(a - u, 0), coalesce(p, 0), coalesce(g, 0);
end;
$$;
grant execute on function public.popcode_quota() to authenticated;

-- ── Enforcement ─────────────────────────────────────────────────────────────
-- In a trigger, not in the client: Popcodes are inserted straight from the
-- browser with the user's own token, so there is no server endpoint to put this
-- behind. The client checks too, but only so it can say something friendly
-- before the upload rather than after.
create or replace function public.enforce_popcode_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  allowance integer;
  used integer;
begin
  -- Rows with no media are not Popcodes and are never counted or blocked.
  if coalesce(new.video_url, '') = '' and coalesce(new.audio_url, '') = '' then
    return new;
  end if;

  select c.user_id into owner from collections c where c.id = new.collection_id;
  if owner is null then
    return new;                       -- orphan row; ownership rules handle it
  end if;
  if public.is_popcode_admin() then
    return new;
  end if;

  -- Re-saving an existing page is not a new Popcode.
  if exists (
    select 1 from collection_items ci
    where ci.collection_id = new.collection_id
      and ci.target_index = new.target_index
      and (coalesce(ci.video_url, '') <> '' or coalesce(ci.audio_url, '') <> '')
  ) then
    return new;
  end if;

  select coalesce(pc.purchased, 0) + coalesce(pc.granted, 0) into allowance
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

drop trigger if exists trg_popcode_quota on collection_items;
create trigger trg_popcode_quota
  before insert on collection_items
  for each row execute function public.enforce_popcode_quota();

commit;

-- ── Operator notes ──────────────────────────────────────────────────────────
-- Comp someone credits by hand:
--   insert into popcode_credits (user_id, granted) values ('<uuid>', 50)
--   on conflict (user_id) do update set granted = popcode_credits.granted + 50,
--                                       updated_at = now();
--
-- See where an account stands:
--   select popcode_used('<uuid>');
--
-- Back out the enforcement without touching the tables or anyone's credits:
--   drop trigger if exists trg_popcode_quota on collection_items;
