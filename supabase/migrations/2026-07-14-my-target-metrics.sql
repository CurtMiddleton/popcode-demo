-- Creator-facing per-photo engagement (scoped to the caller's OWN projects).
--
-- Additive. RUN IN THE SUPABASE SQL EDITOR (prod).
--
-- Unlike get_target_scan_counts (admin-only, all projects), this returns metrics
-- only for collections owned by the calling user (c.user_id = auth.uid()), so
-- each creator can see engagement on their own Popcodes in edit.html. No admin
-- gate — the auth.uid() join IS the access control.

create or replace function get_my_target_metrics()
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
  return query
    select
      e.slug,
      e.target_index,
      count(*) filter (where e.event_type = 'target_found')::bigint,
      count(*) filter (where e.event_type in ('video_play', 'audio_play', 'video_play_tap', 'audio_play_tap'))::bigint,
      count(*) filter (where e.event_type in ('video_complete', 'audio_complete'))::bigint
    from scan_events e
    join collections c on c.slug = e.slug
    where c.user_id = auth.uid()
      and e.target_index is not null
    group by e.slug, e.target_index;
end;
$$;

grant execute on function get_my_target_metrics() to authenticated;
