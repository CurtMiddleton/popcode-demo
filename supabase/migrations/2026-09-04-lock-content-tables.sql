-- 2026-09-04 — Lock down the content tables.
--
-- WHY
-- ---
-- `collections` and `collection_items` were readable AND writable by the anon
-- key (the key that ships in public/config.js and is served to every visitor).
-- Verified 2026-09-04: an anon INSERT into `collections` was rejected by a
-- NOT NULL constraint (23502), not by a policy — while the same insert into
-- print_orders / pop_images / cart_items was rejected at the policy layer
-- (42501). That means the policy let it through.
--
-- The consequence that matters for this product: view.html builds its media map
-- as `mediaMap[item.target_index] = {...}` (view.html:670-679), so a *second*
-- collection_items row with an existing target_index silently overrides what
-- plays. Anyone could repoint the video behind an already-printed book. Printed
-- objects can't be recalled.
--
-- WHAT THIS DOES
-- --------------
--   1. Clean slate: drop every existing policy on the three content tables.
--   2. Owner-scoped read/write for signed-in creators; admins keep full read.
--   3. Removes anon access entirely — the public viewer now reads through
--      /api/collection (service key), which returns only what the player needs
--      and never exposes user_id or book_layout.
--   4. Two narrow SECURITY DEFINER RPCs for the reads that legitimately cross
--      ownership: slug availability, and the "Past Views" cards.
--
-- Safe to re-run. Verified against the live schema: 45 collections,
-- 294 collection_items, 2 legacy experiences, and ZERO collections with a
-- NULL user_id (so no orphan-claiming escape hatch is needed in the policies).
--
-- DEPLOY ORDER: deploy the code first (api/collection.js + the view.html,
-- slug.js and views.html changes), confirm a scan works, THEN run this.
-- Running this against the old front end will break the public viewer.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Clean slate
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare p record;
begin
  for p in
    select policyname, tablename
      from pg_policies
     where schemaname = 'public'
       and tablename in ('collections', 'collection_items', 'experiences')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.collections      enable row level security;
alter table public.collection_items enable row level security;
alter table public.experiences      enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Admin helper
--    Mirrors the client-side gates. analytics.html gates to curtmid@gmail.com
--    only; book/calendar/boardbook treat both addresses as admin. Both are
--    listed here — drop the second line if you want the DB to be stricter than
--    the UI.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_popcode_admin()
returns boolean
language sql stable
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'email', '') in (
    'curtmid@gmail.com',
    'curt@theworkshop.works'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. collections — owner-scoped, admin-readable, no anon
-- ─────────────────────────────────────────────────────────────────────────────
create policy collections_select on public.collections
  for select to authenticated
  using (user_id = auth.uid() or public.is_popcode_admin());

create policy collections_insert on public.collections
  for insert to authenticated
  with check (user_id = auth.uid());

create policy collections_update on public.collections
  for update to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy collections_delete on public.collections
  for delete to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. collection_items — inherits ownership from its parent collection
-- ─────────────────────────────────────────────────────────────────────────────
create policy collection_items_select on public.collection_items
  for select to authenticated
  using (exists (
    select 1 from public.collections c
     where c.id = collection_items.collection_id
       and (c.user_id = auth.uid() or public.is_popcode_admin())
  ));

create policy collection_items_insert on public.collection_items
  for insert to authenticated
  with check (exists (
    select 1 from public.collections c
     where c.id = collection_items.collection_id
       and c.user_id = auth.uid()
  ));

create policy collection_items_update on public.collection_items
  for update to authenticated
  using (exists (
    select 1 from public.collections c
     where c.id = collection_items.collection_id
       and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.collections c
     where c.id = collection_items.collection_id
       and c.user_id = auth.uid()
  ));

create policy collection_items_delete on public.collection_items
  for delete to authenticated
  using (exists (
    select 1 from public.collections c
     where c.id = collection_items.collection_id
       and c.user_id = auth.uid()
  ));

-- The ownership subquery runs per row. Cheap at current volumes, but index it
-- so it stays cheap.
create index if not exists collections_user_id_idx
  on public.collections (user_id);
create index if not exists collection_items_collection_id_idx
  on public.collection_items (collection_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. experiences (legacy single-target format, 2 rows)
--    No client policies at all. RLS is on and nothing is granted, so anon and
--    authenticated both see nothing. view.html reaches it through
--    /api/collection, and slug availability through the RPC below.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC: slug availability (public.slug.js, used by book/boardbook/calendar
--    while signed in AND by scan.html anonymously in resolveMiscasedSlug).
--
--    Discloses only "does this slug exist" for slugs you already guessed —
--    which is public anyway, since anyone can just load popcode.app/{slug}.
--    Requires an explicit candidate list, so it can't be used to enumerate.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.popcode_slugs_taken(slugs text[])
returns text[]
language plpgsql stable security definer
set search_path = public
as $$
declare taken text[];
begin
  if slugs is null or array_length(slugs, 1) is null then
    return array[]::text[];
  end if;
  if array_length(slugs, 1) > 50 then
    raise exception 'popcode_slugs_taken: too many slugs (max 50)';
  end if;

  select coalesce(array_agg(distinct s), array[]::text[])
    into taken
    from (
      select slug as s from public.collections where slug = any(slugs)
      union
      select slug as s from public.experiences where slug = any(slugs)
    ) q;

  return taken;
end;
$$;

revoke all on function public.popcode_slugs_taken(text[]) from public;
grant execute on function public.popcode_slugs_taken(text[]) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RPC: "Past Views" cards (views.html).
--    A viewer's recently-scanned list is by definition other people's projects,
--    so this has to cross ownership. It returns name + first photo only — no
--    user_id, no media URLs, no book_layout — and only for slugs the caller
--    already has in their own localStorage / scan_events.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.popcode_view_cards(slugs text[])
returns table (slug text, name text, thumb text)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if slugs is null or array_length(slugs, 1) is null then
    return;
  end if;
  if array_length(slugs, 1) > 100 then
    raise exception 'popcode_view_cards: too many slugs (max 100)';
  end if;

  return query
    select c.slug,
           c.name,
           (select ci.photo_url
              from public.collection_items ci
             where ci.collection_id = c.id
               and ci.photo_url is not null
             order by ci.target_index
             limit 1) as thumb
      from public.collections c
     where c.slug = any(slugs);
end;
$$;

revoke all on function public.popcode_view_cards(text[]) from public;
grant execute on function public.popcode_view_cards(text[]) to anon, authenticated;

commit;

-- ═════════════════════════════════════════════════════════════════════════════
-- STAGED FOLLOW-UPS — do NOT run with the block above. Each needs a check
-- first, and each is lower severity than the content-table lockdown.
-- ═════════════════════════════════════════════════════════════════════════════

-- (a) scan_events: anon can currently INSERT, so anyone can post fake analytics.
--     api/log-event.js now prefers SUPABASE_SERVICE_ROLE_KEY, so once you have
--     confirmed that variable is set in EVERY Vercel environment (Production and
--     Preview) and a real scan still shows up in analytics, revoke the grant:
--
--       drop policy if exists "anon insert scan_events" on public.scan_events;
--
--     Check the actual policy name first:
--       select policyname, cmd, roles from pg_policies where tablename = 'scan_events';

-- (b) Storage: anon can LIST the `experiences` bucket, which turns the public
--     media URLs into an enumerable index. Public *reads* must keep working
--     (the player streams video straight from the public URL, and Prodigi
--     fetches print assets by URL), so only listing should go. Authenticated
--     listing must stay — analytics.html walks the bucket for the cost panel,
--     and manage.html/edit.html list a slug folder to delete or rename it.
--
--     Inspect before changing anything; these policies were created by hand in
--     the dashboard and their names are not in git:
--       select policyname, cmd, roles, qual
--         from pg_policies where schemaname = 'storage' and tablename = 'objects';
--
--     The shape you want is a SELECT policy on storage.objects restricted to
--     `to authenticated` for bucket_id = 'experiences', with no anon equivalent.
--     Deliberately not scripted here: dropping the wrong storage policy breaks
--     uploads across create/edit/book/calendar/order.

-- (c) Column-level tightening of `cover_config`: the admin-only write is
--     enforced by the enforce_cover_config_admin trigger, which is unaffected by
--     this migration and still in place.
