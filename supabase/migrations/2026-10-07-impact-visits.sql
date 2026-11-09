-- Impact dashboard: leave link checkers out of Visits (2026-10-07).
--
-- RUN IN THE SUPABASE SQL EDITOR (prod), after 2026-09-26-impact-dropoff.sql.
-- Replaces one function; no tables or data change. Same as the drop-off
-- version except Visits (totals, the address split and By segment) count a
-- page open only when that device then did something else — tapped Tap to
-- scan, scanned, played. Emailing a link to three people produced ~20 opens
-- from mail-security scanners and previews (Ashburn VA, Council Bluffs IA,
-- Boardman OR: cloud data centres), none of which ever tap. Scans, phones,
-- plays and every rate were already immune: they count target_found and later.

begin;

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
           e.segment::text                              as seg,
           coalesce(e.device_id::text,
                    md5(coalesce(e.ip_address::text, '') || '|' || coalesce(e.user_agent::text, ''))) as dev,
           (e.created_at at time zone v_tz)::date       as day
      from scan_events e
     where (e.collection_id = c.id or (e.collection_id is null and e.slug = c.slug))
       and (p_include_owner or e.user_id is null or e.user_id is distinct from c.user_id)
       and (e.created_at at time zone v_tz)::date between v_from and v_to
  ),
  -- Devices that did anything besides open the page (tapped Tap to scan,
  -- scanned, played…). Link checkers in mail filters and chat previews only
  -- ever open, so a visit counts only from one of these.
  engaged as (
    select distinct dev from ev where t <> 'scan_open'
  ),
  opens as (
    select o.* from ev o where o.t = 'scan_open' and o.dev in (select dev from engaged)
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
      'visits',    (select count(*) from opens),
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
      'custom',  (select count(*) from opens where entry = 'custom'),
      'popcode', (select count(*) from opens where entry is distinct from 'custom')
    ),
    'results', (
      select jsonb_build_object('gifts', r.gifts_count, 'amount', r.amount_total,
                                'currency', r.currency, 'source', r.source, 'updated_at', r.updated_at,
                                'pieces', r.pieces_mailed, 'cost', r.print_cost)
        from campaign_results r where r.collection_id = c.id
    ),
    -- Where viewers stop: per photo, how many plays got at least k% in
    -- (k = 0, 10, … 100). at[0] is every play that reported; at[10] = completes.
    'dropoff', (
      select coalesce(jsonb_agg(jsonb_build_object('target_index', z.ti, 'n', z.n, 'at', z.at) order by z.ti), '[]'::jsonb)
        from (
          select g.ti, count(*) as n,
                 (select jsonb_agg((select count(*) from ends e2 where e2.ti = g.ti and e2.p >= k) order by k)
                    from generate_series(0, 100, 10) k) as at
            from ends g where g.ti is not null group by g.ti
        ) z
    ),
    -- One row per segment: every configured code, every code seen in the
    -- events, and a null-code row for visits that arrived without one.
    'segments', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'code', k.code, 'label', k.label, 'pieces', k.pieces,
               'visits',    (select count(*) from opens where opens.seg is not distinct from k.code),
               'scans',     (select count(*) from ev where ev.seg is not distinct from k.code and t = 'target_found'),
               'phones',    (select count(distinct dev) from ev where ev.seg is not distinct from k.code and t = 'target_found'),
               'plays',     (select count(*) from ev where ev.seg is not distinct from k.code and t in ('video_play', 'video_play_tap', 'audio_play')),
               'completes', (select count(*) from ev where ev.seg is not distinct from k.code and t in ('video_complete', 'audio_complete')),
               'taps',      (select count(*) from ev where ev.seg is not distinct from k.code and t like 'cta\_tap\_%')
             ) order by k.ord, k.code nulls last), '[]'::jsonb)
        from (
          select s.code, s.label, s.pieces_mailed as pieces, s.sort_order as ord
            from campaign_segments s where s.collection_id = c.id
          union all
          select x.seg, null, null, 1000
            from (select distinct seg from ev) x
           where not exists (select 1 from campaign_segments s
                              where s.collection_id = c.id and s.code is not distinct from x.seg)
        ) k
    )
  ) into result;

  return result;
end;
$$;
revoke all on function public.impact_dashboard_data(uuid, date, date, text, boolean) from public, anon, authenticated;

commit;
