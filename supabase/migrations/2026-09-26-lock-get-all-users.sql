-- get_all_users (Analytics → Accounts): fix the admin check and record the
-- function in the repo (it had only ever existed in prod).
--
-- RUN IN THE SUPABASE SQL EDITOR (prod). Same signature and columns, so the
-- live Analytics page needs no change.
--
-- The prod check was `if (auth.jwt() ->> 'email') <> 'curtmid@gmail.com'`.
-- For a caller who isn't signed in, the email is NULL, `NULL <> '…'` is NULL,
-- and the `if` is skipped — so the public anon key could read every account's
-- email and name. (Signed-in non-admins were always refused.) On 2026-09-26
-- EXECUTE was revoked from anon/public in prod as a first step; this adds
-- coalesce(), the same as every other admin function, and keeps that revoke.

begin;

create or replace function public.get_all_users(max_rows integer default 100)
returns table (id uuid, email text, full_name text, created_at timestamptz, project_count integer)
language plpgsql security definer set search_path = public, auth
as $$
begin
  -- Admin gate: mirrors ADMIN_EMAIL in analytics.html. coalesce() matters:
  -- without it a signed-out caller (NULL email) passes.
  if coalesce(auth.jwt() ->> 'email', '') <> 'curtmid@gmail.com' then
    raise exception 'Unauthorized';
  end if;

  return query
    select
      u.id,
      u.email::text,
      coalesce(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name'
      )::text as full_name,
      u.created_at,
      (select count(*)::integer from collections c where c.user_id = u.id) as project_count
    from auth.users u
    order by u.created_at desc
    limit max_rows;
end;
$$;

revoke all on function public.get_all_users(integer) from public, anon;
grant execute on function public.get_all_users(integer) to authenticated;

commit;
