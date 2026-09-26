-- Impact dashboard, phase 3 (docs/impact-dashboard-handoff.md §3, §6):
-- gift totals entered by the admin, and a revocable read-only share link.
--
-- RUN IN THE SUPABASE SQL EDITOR (prod), after 2026-09-26-impact-dashboard.sql.
-- Replaces get_impact_dashboard() (same arguments) so its result carries the
-- gift totals; everything else it returns is unchanged.
--
-- campaign_results  One row per campaign (collection). Totals come from the
--                   org's donation platform (Classy, Donorbox, Givebutter…),
--                   filtered by utm_campaign={slug}. MVP: the admin types
--                   them in (source 'manual'); CSV import can come later.
-- impact_shares     Share links: popcode.app/impact.html?share={token}. The
--                   token is 24 random bytes, base64url (unguessable). A
--                   revoked link stops working at once. Created and revoked
--                   by the project's owner or the admin.
--
-- Neither table is readable or writable directly by anon/authenticated (RLS on,
-- no policies): everything goes through the security-definer functions below,
-- which do their own checks.

begin;

create table if not exists public.campaign_results (
  collection_id uuid primary key references public.collections(id) on delete cascade,
  gifts_count   integer not null default 0 check (gifts_count >= 0),
  amount_total  numeric(12, 2) not null default 0 check (amount_total >= 0),
  currency      text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  source        text not null default 'manual' check (source in ('manual', 'csv')),
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
alter table public.campaign_results enable row level security;

create table if not exists public.impact_shares (
  token         text primary key,
  collection_id uuid not null references public.collections(id) on delete cascade,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  revoked_at    timestamptz
);
create index if not exists impact_shares_collection_idx on public.impact_shares (collection_id);
alter table public.impact_shares enable row level security;

-- ── Helpers ─────────────────────────────────────────────────────────────────
create or replace function public.impact_is_admin()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'curtmid@gmail.com'
$$;

-- ── The dashboard (replaces phase 2's; adds 'results') ──────────────────────
-- The body is phase 2's, split so the share-link read below can reuse it
-- without the owner/admin check.
create or replace function public.impact_dashboard_data(
  c_id uuid, p_from date, p_to date, p_tz text, p_include_owner boolean
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  c        record;
  v_tz     text;
  v_from   date;
  v_to     date;
  v_first  date;
  result   jsonb;
begin
  select id, slug, name, user_id, created_at, cover_config
    into c from collections where id = c_id;
  if not found then return null; end if;

  v_tz := case when exists (select 1 from pg_timezone_names where name = p_tz)
               then p_tz else 'America/New_York' end;

  select min((e.created_at at time zone v_tz)::date) into v_first
    from scan_events e
   where e.collection_id = c.id or (e.collection_id is null and e.slug = c.slug);
  v_to   := coalesce(p_to, (now() at time zone v_tz)::date);
  v_from := coalesce(p_from, v_first, (c.created_at at time zone v_tz)::date);
  if v_from > v_to then v_from := v_to; end if;
  if v_to - v_from > 366 then v_from := v_to - 366; end if;

  with ev as (
    select e.event_type::text                          as t,
           e.target_index::integer                      as ti,
           e.progress_pct::integer                      as pct,
           e.entry::text                                as entry,
           coalesce(e.device_id::text,
                    md5(coalesce(e.ip_address::text, '') || '|' || coalesce(e.user_agent::text, ''))) as dev,
           (e.created_at at time zone v_tz)::date       as day
      from scan_events e
     where (e.collection_id = c.id or (e.collection_id is null and e.slug = c.slug))
       and (p_include_owner or e.user_id is null or e.user_id is distinct from c.user_id)
       and (e.created_at at time zone v_tz)::date between v_from and v_to
  ),
  ends as (
    select ti, case when t in ('video_complete', 'audio_complete') then 100 else pct end as p
      from ev
     where t in ('video_complete', 'audio_complete')
        or (t = 'media_progress' and pct is not null)
  ),
  items as (
    select distinct on (i.target_index)
           i.target_index::integer as ti, i.asset_name::text as name,
           i.photo_url::text as photo_url, i.video_url::text as video_url,
           i.audio_url::text as audio_url, coalesce(i.media_type::text, 'video') as media_type
      from collection_items i
     where i.collection_id = c.id
     order by i.target_index
  )
  select jsonb_build_object(
    'campaign', jsonb_build_object(
      'slug', c.slug, 'name', c.name, 'created_at', c.created_at,
      'from', v_from, 'to', v_to, 'tz', v_tz, 'first_event', v_first,
      'include_owner', p_include_owner,
      'org_logo_url', c.cover_config -> 'org_logo_url',
      'org_name', c.cover_config -> 'org_name',
      'buttons', coalesce(c.cover_config -> 'end' -> 'buttons', '[]'::jsonb),
      'items', coalesce((select jsonb_agg(to_jsonb(items) order by ti) from items), '[]'::jsonb)
    ),
    'totals', jsonb_build_object(
      'scans',     (select count(*) from ev where t = 'target_found'),
      'phones',    (select count(distinct dev) from ev where t = 'target_found'),
      'plays',     (select count(*) from ev where t in ('video_play', 'video_play_tap', 'audio_play')),
      'completes', (select count(*) from ev where t in ('video_complete', 'audio_complete')),
      'avg_pct',   (select round(avg(p)) from ends),
      'taps',      (select count(*) from ev where t like 'cta\_tap\_%'),
      'visits',    (select count(*) from ev where t = 'scan_open'),
      'events',    (select count(*) from ev)
    ),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'scans', coalesce(n, 0)) order by d), '[]'::jsonb)
        from generate_series(v_from, v_to, interval '1 day') d
        left join (select day, count(*) n from ev where t = 'target_found' group by day) s on s.day = d::date
    ),
    'stories', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'target_index', x.ti, 'scans', x.scans, 'plays', x.plays,
               'completes', x.completes, 'taps', x.taps,
               'avg_pct', (select round(avg(p)) from ends where ends.ti = x.ti)) order by x.ti), '[]'::jsonb)
        from (select ti,
                     count(*) filter (where t = 'target_found') scans,
                     count(*) filter (where t in ('video_play', 'video_play_tap', 'audio_play')) plays,
                     count(*) filter (where t in ('video_complete', 'audio_complete')) completes,
                     count(*) filter (where t like 'cta\_tap\_%') taps
                from ev where ti is not null group by ti) x
    ),
    'buttons', (
      select coalesce(jsonb_object_agg(substr(t, 9), n), '{}'::jsonb)
        from (select t, count(*) n from ev where t like 'cta\_tap\_%' group by t) b
    ),
    'funnel', jsonb_build_object(
      'scanned',  (select count(distinct dev) from ev where t = 'target_found'),
      'finished', (select count(distinct dev) from ev where t in ('video_complete', 'audio_complete')),
      'tapped',   (select count(distinct dev) from ev where t like 'cta\_tap\_%')
    ),
    'entry', jsonb_build_object(
      'custom',  (select count(*) from ev where t = 'scan_open' and entry = 'custom'),
      'popcode', (select count(*) from ev where t = 'scan_open' and entry is distinct from 'custom')
    ),
    'results', (
      select jsonb_build_object('gifts', r.gifts_count, 'amount', r.amount_total,
                                'currency', r.currency, 'source', r.source, 'updated_at', r.updated_at)
        from campaign_results r where r.collection_id = c.id
    )
  ) into result;

  return result;
end;
$$;
-- Internal: no one calls it directly.
revoke all on function public.impact_dashboard_data(uuid, date, date, text, boolean) from public, anon, authenticated;

create or replace function public.get_impact_dashboard(
  p_slug          text,
  p_from          date    default null,
  p_to            date    default null,
  p_tz            text    default 'America/New_York',
  p_include_owner boolean default false
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  c record;
  result jsonb;
begin
  select id, user_id into c from collections where slug = p_slug;
  if not found then return null; end if;
  if not impact_is_admin() and c.user_id is distinct from auth.uid() then
    raise exception 'Unauthorized';
  end if;
  result := impact_dashboard_data(c.id, p_from, p_to, p_tz, p_include_owner);
  -- What the viewer may do on the page: enter gifts (admin), manage links (both).
  return result || jsonb_build_object('can', jsonb_build_object(
    'edit_results', impact_is_admin(), 'share', true));
end;
$$;
revoke all on function public.get_impact_dashboard(text, date, date, text, boolean) from public, anon;
grant execute on function public.get_impact_dashboard(text, date, date, text, boolean) to authenticated;

-- ── Share link read: anyone holding a live token ────────────────────────────
-- Never includes the owner's own scans, and no 'can' block.
create or replace function public.get_impact_dashboard_shared(
  p_token text,
  p_from  date default null,
  p_to    date default null,
  p_tz    text default 'America/New_York'
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cid uuid;
begin
  select s.collection_id into cid from impact_shares s
   where s.token = p_token and s.revoked_at is null;
  if cid is null then raise exception 'Link not valid'; end if;
  return impact_dashboard_data(cid, p_from, p_to, p_tz, false)
         || jsonb_build_object('shared', true);
end;
$$;
revoke all on function public.get_impact_dashboard_shared(text, date, date, text) from public;
grant execute on function public.get_impact_dashboard_shared(text, date, date, text) to anon, authenticated;

-- ── Gift totals (admin) ─────────────────────────────────────────────────────
create or replace function public.set_campaign_results(
  p_slug text, p_gifts integer, p_amount numeric, p_currency text default 'USD'
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  cid uuid;
begin
  if not impact_is_admin() then raise exception 'Unauthorized'; end if;
  select id into cid from collections where slug = p_slug;
  if cid is null then raise exception 'No such campaign'; end if;
  insert into campaign_results (collection_id, gifts_count, amount_total, currency, source, updated_at, updated_by)
  values (cid, p_gifts, p_amount, upper(coalesce(p_currency, 'USD')), 'manual', now(), auth.uid())
  on conflict (collection_id) do update
    set gifts_count = excluded.gifts_count, amount_total = excluded.amount_total,
        currency = excluded.currency, source = 'manual',
        updated_at = now(), updated_by = auth.uid();
end;
$$;
revoke all on function public.set_campaign_results(text, integer, numeric, text) from public, anon;
grant execute on function public.set_campaign_results(text, integer, numeric, text) to authenticated;

create or replace function public.clear_campaign_results(p_slug text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not impact_is_admin() then raise exception 'Unauthorized'; end if;
  delete from campaign_results r using collections c
   where r.collection_id = c.id and c.slug = p_slug;
end;
$$;
revoke all on function public.clear_campaign_results(text) from public, anon;
grant execute on function public.clear_campaign_results(text) to authenticated;

-- ── Share links (owner or admin) ────────────────────────────────────────────
create or replace function public.list_impact_shares(p_slug text)
returns table (token text, created_at timestamptz, revoked_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  c record;
begin
  select id, user_id into c from collections where slug = p_slug;
  if not found then return; end if;
  if not impact_is_admin() and c.user_id is distinct from auth.uid() then
    raise exception 'Unauthorized';
  end if;
  return query select s.token, s.created_at, s.revoked_at from impact_shares s
                where s.collection_id = c.id order by s.created_at desc;
end;
$$;
revoke all on function public.list_impact_shares(text) from public, anon;
grant execute on function public.list_impact_shares(text) to authenticated;

create or replace function public.create_impact_share(p_slug text)
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare
  c record;
  t text;
begin
  select id, user_id into c from collections where slug = p_slug;
  if not found then raise exception 'No such campaign'; end if;
  if not impact_is_admin() and c.user_id is distinct from auth.uid() then
    raise exception 'Unauthorized';
  end if;
  -- 24 random bytes → 32 url-safe characters.
  t := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into impact_shares (token, collection_id, created_by) values (t, c.id, auth.uid());
  return t;
end;
$$;
revoke all on function public.create_impact_share(text) from public, anon;
grant execute on function public.create_impact_share(text) to authenticated;

create or replace function public.revoke_impact_share(p_token text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  c record;
begin
  select col.id, col.user_id into c from impact_shares s join collections col on col.id = s.collection_id
   where s.token = p_token;
  if not found then return; end if;
  if not impact_is_admin() and c.user_id is distinct from auth.uid() then
    raise exception 'Unauthorized';
  end if;
  update impact_shares set revoked_at = now() where token = p_token and revoked_at is null;
end;
$$;
revoke all on function public.revoke_impact_share(text) from public, anon;
grant execute on function public.revoke_impact_share(text) to authenticated;

commit;
