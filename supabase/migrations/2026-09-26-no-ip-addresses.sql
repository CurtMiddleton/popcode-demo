-- Stop relying on viewer IP addresses (2026-09-26).
--
-- RUN IN THE SUPABASE SQL EDITOR (prod) BEFORE the code that stops writing
-- ip_address deploys (api/log-event.js). Replaces functions only; no data is
-- changed. Past rows keep their IPs (the user chose not to erase them).
--
-- From here on, events carry no IP. Every place that told viewers apart by
-- a hash of IP + user agent now uses the anonymous device_id (view.html,
-- localStorage) and falls back to the old hash only for events from before
-- device_id existed:
--   get_reach_events       Analytics → Map, "unique viewers"
--   get_my_view_events     My Popcodes viewer insights (per-project key, so
--                          one phone can't be linked across projects)
--   get_impact_dashboard   already did this (2026-09-26-impact-phase3.sql)
--   get_events_with_users  Analytics → Activity: gains a device_id column
--                          (dropped and recreated — see the section at the end).
-- The first two keep their signatures, so create or replace is enough.
--
-- SECURITY FIX (same file): get_events_with_users, as it stood in prod, was
-- SECURITY DEFINER with NO caller check and default EXECUTE for everyone — so
-- the public anon key could read every event with account holders' names,
-- emails and IPs. It is recreated admin-only, and anon/public lose EXECUTE.

begin;

create or replace function public.get_reach_events(max_rows integer default 100000)
returns table (
  slug       text,
  event_type text,
  user_id    uuid,
  created_at timestamptz,
  city       text,
  region     text,
  country    text,
  latitude   double precision,
  longitude  double precision,
  visitor    text
)
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'curtmid@gmail.com' then
    raise exception 'Unauthorized';
  end if;

  -- Opens (watched), creations and signups, plus any signed-in event: an
  -- account made before signup events existed (2026-09-09) is placed where it
  -- was first seen.
  return query
    -- Casts: return query must match the declared types exactly, and this
    -- table's column types were set in the dashboard, not in this repo.
    select e.slug::text, e.event_type::text, e.user_id::uuid, e.created_at::timestamptz,
           e.city::text, e.region::text, e.country::text, e.latitude, e.longitude,
           coalesce(e.device_id::text,
                    md5(coalesce(e.ip_address::text, '') || '|' || coalesce(e.user_agent, ''))) as visitor
    from scan_events e
    where (e.country is not null or e.latitude is not null)
      and (e.event_type in ('signup', 'scan_open')
           or e.event_type like 'create\_%'
           or e.user_id is not null)
    -- Newest first: past max_rows it's the oldest events that drop off, not
    -- this week's. The map doesn't depend on row order.
    order by e.created_at desc
    limit max_rows;
end;
$$;

create or replace function public.get_my_view_events(max_rows integer default 5000)
returns table (
  slug           text,
  created_at     timestamptz,
  event_type     text,
  target_index   integer,
  city           text,
  region         text,
  country        text,
  device_type    text,
  user_agent     text,
  viewer_key     text,
  viewer_name    text,
  recipient_code text,
  recipient_name text,
  progress_pct   integer
)
language plpgsql security definer set search_path = public, auth
as $$
begin
  return query
    select
      e.slug::text,
      e.created_at::timestamptz,
      e.event_type::text,
      e.target_index::integer,
      e.city::text,
      e.region::text,
      e.country::text,
      e.device_type::text,
      e.user_agent::text,
      md5(c.id::text || '|' || coalesce(e.device_id::text,
          coalesce(e.ip_address::text, '') || '|' || coalesce(e.user_agent::text, ''))),
      case when e.user_id is not null
           then coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
                         nullif(btrim(u.raw_user_meta_data->>'name'), ''),
                         u.email::text)
      end,
      r.code,
      r.name,
      e.progress_pct::integer
    from scan_events e
    join collections c on c.slug = e.slug and c.user_id = auth.uid()
    left join auth.users u on u.id = e.user_id
    left join share_recipients r on r.code = e.recipient_code and r.collection_id = c.id
    where (e.user_id is null or e.user_id <> auth.uid())
      and e.event_type in ('scan_open', 'scan_start', 'target_found',
                           'video_play', 'video_play_tap', 'video_complete',
                           'audio_play', 'audio_complete', 'media_progress')
    order by e.created_at desc
    limit greatest(1, least(coalesce(max_rows, 5000), 20000));
end;
$$;

-- ── Analytics → Activity feed ───────────────────────────────────────────────
-- The prod definition (read with pg_get_functiondef, 2026-09-26) plus
-- device_id at the end, an admin check, and no grant to anon. Same columns in
-- the same order otherwise, so analytics.html needs no change to read it.
drop function if exists public.get_events_with_users(integer, integer);

create function public.get_events_with_users(days_back integer default 30, max_rows integer default 50000)
returns table (
  id uuid, slug text, event_type text, target_index integer, device_type text, browser text,
  user_agent text, ip_address text, country text, region text, city text,
  created_at timestamptz, user_id uuid, user_name text, user_email text, device_id text
)
language plpgsql security definer set search_path = public, auth
as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'curtmid@gmail.com' then
    raise exception 'Unauthorized';
  end if;
  return query
    select
      e.id::uuid, e.slug::text, e.event_type::text, e.target_index::integer,
      e.device_type::text, e.browser::text, e.user_agent::text,
      e.ip_address::text, e.country::text, e.region::text, e.city::text,
      e.created_at::timestamptz, e.user_id::uuid,
      (u.raw_user_meta_data->>'full_name')::text as user_name,
      u.email::text as user_email,
      e.device_id::text
    from scan_events e
    left join auth.users u on u.id = e.user_id
    where (days_back = 0 or e.created_at >= now() - (days_back || ' days')::interval)
    order by e.created_at desc
    limit max_rows;
end;
$$;

revoke all on function public.get_events_with_users(integer, integer) from public, anon;
grant execute on function public.get_events_with_users(integer, integer) to authenticated;

commit;

-- Check (should be false, then true):
--   select has_function_privilege('anon', 'public.get_events_with_users(integer,integer)', 'execute'),
--          has_function_privilege('authenticated', 'public.get_events_with_users(integer,integer)', 'execute');
