-- Marketing email consent — admin read access.
--
-- The answer itself lives in auth.users.raw_user_meta_data, written by the
-- client: auth.html sets it at signup (checkbox, unticked by default) and
-- account.html lets the person change it later.
--
--   marketing_opt_in       boolean
--   marketing_opt_in_at    timestamptz (ISO string) — when they agreed
--   marketing_opt_out_at   timestamptz (ISO string) — when they withdrew
--
-- auth.users is not readable from the client, so the Accounts table in
-- analytics.html reads it through this admin-only function. No table change.
-- Safe to run before or after the code: analytics shows "—" until it exists.
--
-- To pull the mailing list (e.g. to import into Resend):
--   select email, (raw_user_meta_data->>'marketing_opt_in_at') as opted_in_at
--   from auth.users
--   where (raw_user_meta_data->>'marketing_opt_in')::boolean is true
--   order by 2;

create or replace function public.get_marketing_opt_ins()
returns table (user_id uuid, opted_in boolean, opted_in_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_popcode_admin() then
    raise exception 'Unauthorized';
  end if;
  return query
    select u.id,
           coalesce((u.raw_user_meta_data->>'marketing_opt_in')::boolean, false),
           nullif(u.raw_user_meta_data->>'marketing_opt_in_at', '')::timestamptz
    from auth.users u;
end;
$$;

revoke all on function public.get_marketing_opt_ins() from public, anon;
grant execute on function public.get_marketing_opt_ins() to authenticated;
