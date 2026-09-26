-- Impact dashboard, phase 2 (docs/impact-dashboard-handoff.md §2, §5):
-- public/impact.html reads everything through these two functions.
--
-- Additive, no table changes. RUN IN THE SUPABASE SQL EDITOR (prod). Needs
-- 2026-09-26-impact-events.sql first (device_id / entry / collection_id).
--
-- Who can read a campaign: the admin (curtmid@gmail.com, same gate as the
-- other analytics RPCs) or the project's owner. That is the "org users see
-- only their own account" rule, since an org is the account that owns the
-- project. A campaign = a collection (project).
--
-- Every aggregate is computed here, not in the browser (§5). Definitions:
--   scans          target_found events (one per photo recognised and played)
--   phones         distinct device_id among scans; events from before
--                  device_id existed fall back to a hash of IP + user agent.
--                  An estimate either way (iOS can clear storage).
--   plays          video_play + video_play_tap + audio_play
--   completes      video_complete + audio_complete
--   avg_pct        mean of each play's furthest point: 100 for a complete,
--                  else its media_progress progress_pct. Plays whose tab was
--                  killed before reporting drop out.
--   taps           cta_tap_1..3 (After the Video buttons, by position)
--   visits         scan_open, split by entry ('custom' = arrived via the
--                  org's own address with ?via=org; null = before tracking,
--                  counted as popcode.app, which was the only address then)
--   funnel         distinct devices that scanned / finished / tapped
-- Days are grouped in p_tz (default America/New_York).
--
-- Events are matched by collection_id, or by slug for events logged before
-- collection_id existed. Events logged under an OLD slug (before a rename,
-- and before collection_id) can't be found.
--
-- The owner's own signed-in events are left out unless p_include_owner, so
-- test scans don't count (same rule as viewer insights).

begin;

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
  c        record;
  v_tz     text;
  v_from   date;
  v_to     date;
  v_first  date;
  result   jsonb;
begin
  select id, slug, name, user_id, created_at, cover_config
    into c from collections where slug = p_slug;
  if not found then return null; end if;

  if coalesce(auth.jwt() ->> 'email', '') <> 'curtmid@gmail.com'
     and c.user_id is distinct from auth.uid() then
    raise exception 'Unauthorized';
  end if;

  v_tz := case when exists (select 1 from pg_timezone_names where name = p_tz)
               then p_tz else 'America/New_York' end;

  -- Default range: first event (or the project's creation) through today.
  select min((e.created_at at time zone v_tz)::date) into v_first
    from scan_events e
   where e.collection_id = c.id or (e.collection_id is null and e.slug = c.slug);
  v_to   := coalesce(p_to, (now() at time zone v_tz)::date);
  v_from := coalesce(p_from, v_first, (c.created_at at time zone v_tz)::date);
  if v_from > v_to then v_from := v_to; end if;
  -- A year of bars is plenty; keeps the day series bounded.
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
  ends as (   -- one row per play that reported how far it got
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
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_impact_dashboard(text, date, date, text, boolean) from public, anon;
grant execute on function public.get_impact_dashboard(text, date, date, text, boolean) to authenticated;

-- The campaign selector: the caller's own projects; the admin also sees every
-- project with an org cover or After the Video set (cover_config is
-- admin-only, so those are the nonprofit ones).
create or replace function public.get_impact_campaigns()
returns table (slug text, name text, created_at timestamptz, owned boolean)
language plpgsql security definer set search_path = public
as $$
begin
  return query
    select c.slug::text, c.name::text, c.created_at::timestamptz, (c.user_id = auth.uid())
      from collections c
     where c.slug is not null
       and (c.user_id = auth.uid()
            or (coalesce(auth.jwt() ->> 'email', '') = 'curtmid@gmail.com'
                and c.cover_config is not null))
     order by (c.cover_config is not null) desc, c.created_at desc
     limit 500;
end;
$$;

revoke all on function public.get_impact_campaigns() from public, anon;
grant execute on function public.get_impact_campaigns() to authenticated;

commit;

-- Check (as the admin, in the app — the SQL editor has no auth.jwt()):
--   select get_impact_dashboard('commontide');
