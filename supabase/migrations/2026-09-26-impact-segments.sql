-- Impact dashboard: response rate and segments (2026-09-26).
--
-- RUN IN THE SUPABASE SQL EDITOR (prod), after 2026-09-26-impact-phase3.sql.
-- Additive: new columns and a new table; replaces three functions.
--
-- Segments: a mailing list or card version gets a code in its printed address,
-- popcode.app/{slug}/{code} (or ?v={code}, e.g. from an org's own redirect).
-- view.html keeps the code for the visit and sends it with every event;
-- outbound buttons get utm_content={code} so the donation platform can split
-- gifts by segment too.
--
-- Response rate: pieces mailed and print + postage cost, for the campaign and
-- optionally per segment, entered by the admin next to the gift totals.
-- Gifts / amount become optional so pieces can be entered before any gifts.

begin;

alter table public.scan_events add column if not exists segment text;

alter table public.campaign_results add column if not exists pieces_mailed integer check (pieces_mailed >= 0);
alter table public.campaign_results add column if not exists print_cost numeric(12, 2) check (print_cost >= 0);
alter table public.campaign_results alter column gifts_count drop not null;
alter table public.campaign_results alter column gifts_count drop default;
alter table public.campaign_results alter column amount_total drop not null;
alter table public.campaign_results alter column amount_total drop default;

create table if not exists public.campaign_segments (
  collection_id uuid not null references public.collections(id) on delete cascade,
  code          text not null check (code ~ '^[a-z0-9][a-z0-9-]{0,19}$'),
  label         text check (label is null or char_length(label) <= 60),
  pieces_mailed integer check (pieces_mailed >= 0),
  sort_order    integer not null default 0,
  primary key (collection_id, code)
);
alter table public.campaign_segments enable row level security;

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
                                'currency', r.currency, 'source', r.source, 'updated_at', r.updated_at,
                                'pieces', r.pieces_mailed, 'cost', r.print_cost)
        from campaign_results r where r.collection_id = c.id
    ),
    -- One row per segment: every configured code, every code seen in the
    -- events, and a null-code row for visits that arrived without one.
    'segments', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'code', k.code, 'label', k.label, 'pieces', k.pieces,
               'visits',    (select count(*) from ev where ev.seg is not distinct from k.code and t = 'scan_open'),
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

-- Gift totals + pieces + cost (admin). Any argument left null is stored as
-- null (not entered yet).
drop function if exists public.set_campaign_results(text, integer, numeric, text);
create or replace function public.set_campaign_results(
  p_slug text, p_gifts integer, p_amount numeric, p_currency text default 'USD',
  p_pieces integer default null, p_cost numeric default null
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
  insert into campaign_results (collection_id, gifts_count, amount_total, currency, source,
                                pieces_mailed, print_cost, updated_at, updated_by)
  values (cid, p_gifts, p_amount, upper(coalesce(p_currency, 'USD')), 'manual', p_pieces, p_cost, now(), auth.uid())
  on conflict (collection_id) do update
    set gifts_count = excluded.gifts_count, amount_total = excluded.amount_total,
        currency = excluded.currency, source = 'manual',
        pieces_mailed = excluded.pieces_mailed, print_cost = excluded.print_cost,
        updated_at = now(), updated_by = auth.uid();
end;
$$;
revoke all on function public.set_campaign_results(text, integer, numeric, text, integer, numeric) from public, anon;
grant execute on function public.set_campaign_results(text, integer, numeric, text, integer, numeric) to authenticated;

-- Segments (admin): replaces the campaign's list with p_segments,
-- a JSON array of {code, label, pieces}.
create or replace function public.set_campaign_segments(p_slug text, p_segments jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  cid uuid;
begin
  if not impact_is_admin() then raise exception 'Unauthorized'; end if;
  select id into cid from collections where slug = p_slug;
  if cid is null then raise exception 'No such campaign'; end if;
  if jsonb_typeof(coalesce(p_segments, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_segments, '[]'::jsonb)) > 20 then
    raise exception 'Segments must be a list of at most 20';
  end if;
  delete from campaign_segments where collection_id = cid;
  insert into campaign_segments (collection_id, code, label, pieces_mailed, sort_order)
  select cid, lower(btrim(x.value ->> 'code')), nullif(btrim(x.value ->> 'label'), ''),
         nullif(x.value ->> 'pieces', '')::integer, x.ordinality::integer
    from jsonb_array_elements(coalesce(p_segments, '[]'::jsonb)) with ordinality as x(value, ordinality)
   where coalesce(btrim(x.value ->> 'code'), '') <> '';
end;
$$;
revoke all on function public.set_campaign_segments(text, jsonb) from public, anon;
grant execute on function public.set_campaign_segments(text, jsonb) to authenticated;

commit;
