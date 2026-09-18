-- The quota read and the quota trigger disagreed about admins.
--
-- Additive, replaces one function. RUN IN THE SUPABASE SQL EDITOR.
--
-- enforce_popcode_quota() exempts admins, but popcode_quota() did not — so an
-- admin was stopped by the client's pre-flight check for a cap the database
-- would have let straight through. The two must answer the same question the
-- same way, or the friendlier client check becomes a wall that is not real.
--
-- Same signature as before, so create-or-replace is fine here.

create or replace function public.popcode_quota()
returns table (allowance integer, used integer, remaining integer,
               purchased integer, granted integer, from_purchases integer)
language plpgsql stable security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p integer := 0; g integer := 0; f integer := 0; u integer := 0; a integer;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  select coalesce(pc.purchased, 0), coalesce(pc.granted, 0), coalesce(pc.from_purchases, 0)
    into p, g, f
    from popcode_credits pc where pc.user_id = uid;
  u := public.popcode_used(uid);

  -- Matches the trigger: an admin is never capped, so report headroom rather
  -- than a limit the insert would ignore anyway.
  if public.is_popcode_admin() then
    return query select 2147483647, u, 2147483647 - u, coalesce(p, 0), coalesce(g, 0), coalesce(f, 0);
    return;
  end if;

  a := public.popcode_free_allowance() + coalesce(p, 0) + coalesce(g, 0) + coalesce(f, 0);
  return query select a, u, greatest(a - u, 0), coalesce(p, 0), coalesce(g, 0), coalesce(f, 0);
end;
$$;
grant execute on function public.popcode_quota() to authenticated;
