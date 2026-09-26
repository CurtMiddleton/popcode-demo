-- Global reach map (analytics.html → Map tab).
--
-- Additive. RUN IN THE SUPABASE SQL EDITOR (prod). Order doesn't matter as
-- much as usual: api/log-event.js retries without the two new columns if the
-- insert says they don't exist, so the deploy can go first. But until this
-- runs, every event is written without coordinates and the map has to look
-- each city up by name.
--
-- 1. latitude / longitude on scan_events. Vercel sends x-vercel-ip-latitude /
--    -longitude alongside the country/region/city headers already stored; they
--    are city-level (the IP's city centre), not the person's position.
-- 2. get_reach_events(): the rows the map needs, all time, admin only. Its own
--    function rather than a change to get_events_with_users, whose definition
--    lives only in prod (see the 2026-04-15 lesson: adding a column to an RPC
--    means drop + recreate, and that one isn't in this repo to recreate).
--    Raw IPs never leave the database: `visitor` is a hash of IP + user agent,
--    used only to count distinct viewers.

begin;

alter table public.scan_events add column if not exists latitude  double precision;
alter table public.scan_events add column if not exists longitude double precision;

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
           md5(coalesce(e.ip_address::text, '') || '|' || coalesce(e.user_agent, '')) as visitor
    from scan_events e
    where (e.country is not null or e.latitude is not null)
      and (e.event_type in ('signup', 'scan_open')
           or e.event_type like 'create\_%'
           or e.user_id is not null)
    order by e.created_at
    limit max_rows;
end;
$$;

revoke execute on function public.get_reach_events(integer) from public, anon;
grant execute on function public.get_reach_events(integer) to authenticated;

commit;
