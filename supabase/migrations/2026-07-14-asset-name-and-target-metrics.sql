-- Per-asset naming + richer per-target metrics for the analytics "By Photo" panel.
--
-- Additive. RUN IN THE SUPABASE SQL EDITOR (prod). Supersedes
-- 2026-07-14-target-scan-counts.sql (adds play/complete columns to the RPC).

-- Optional creator-set label for each photo/asset (shown in analytics).
alter table collection_items add column if not exists asset_name text;

-- Per (project, photo): scans (detections), plays (video OR audio), completions.
-- NB: video_play / audio_play / *_complete only carry target_index for scans
-- logged AFTER the view.html change ships, so play/complete counts accrue going
-- forward; found_count (scans) is historical.
drop function if exists get_target_scan_counts(integer);

create function get_target_scan_counts(days_back integer default 0)
returns table (
  slug           text,
  target_index   integer,
  found_count    bigint,
  play_count     bigint,
  complete_count bigint
)
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'curtmid@gmail.com' then
    raise exception 'Unauthorized';
  end if;

  return query
    select
      e.slug,
      e.target_index,
      count(*) filter (where e.event_type = 'target_found')::bigint,
      count(*) filter (where e.event_type in ('video_play', 'audio_play', 'video_play_tap', 'audio_play_tap'))::bigint,
      count(*) filter (where e.event_type in ('video_complete', 'audio_complete'))::bigint
    from scan_events e
    where e.target_index is not null
      and (days_back = 0 or e.created_at >= now() - make_interval(days => days_back))
    group by e.slug, e.target_index;
end;
$$;

grant execute on function get_target_scan_counts(integer) to authenticated;
