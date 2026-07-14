-- Per-photo scan counts for the analytics.html "By Photo" breakdown.
--
-- Additive. RUN IN THE SUPABASE SQL EDITOR (prod).
--
-- view.html logs 'target_found' with the target_index of the photo that was
-- recognized (see logEvent('target_found', idx)), so we can show WHICH photo in
-- a project gets scanned — not just a per-project lump. Aggregated + admin-gated
-- via a security-definer RPC (same pattern as the other admin RPCs) so it works
-- regardless of the scan_events RLS.

create or replace function get_target_scan_counts(days_back integer default 0)
returns table (
  slug         text,
  target_index integer,
  found_count  bigint
)
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'curtmid@gmail.com' then
    raise exception 'Unauthorized';
  end if;

  return query
    select e.slug, e.target_index, count(*)::bigint as found_count
    from scan_events e
    where e.event_type = 'target_found'
      and e.target_index is not null
      and (days_back = 0 or e.created_at >= now() - make_interval(days => days_back))
    group by e.slug, e.target_index;
end;
$$;

grant execute on function get_target_scan_counts(integer) to authenticated;
