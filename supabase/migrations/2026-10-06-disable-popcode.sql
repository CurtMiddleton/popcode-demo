-- 2026-10-06 — Admin "disable" switch for a Popcode.
--
-- RUN IN THE SUPABASE SQL EDITOR (prod). Additive and safe to re-run.
--
-- A disabled Popcode stays in the database and in storage, untouched, but
-- /api/collection refuses to serve it, so its link and every printed copy stop
-- playing. Clearing disabled_at turns it back on. Set from Analytics → Content
-- (the project's media viewer) through /api/set-popcode-disabled.
--
-- Owners can UPDATE their own `collections` row (2026-09-04-lock-content-tables),
-- so without the trigger below a creator could switch their own Popcode back on.
-- The trigger only lets these two columns change for an admin, or for a caller
-- with no user at all (the service key the API uses, or the SQL editor).

begin;

alter table public.collections
  add column if not exists disabled_at     timestamptz,
  add column if not exists disabled_reason text;

create or replace function public.enforce_disable_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.disabled_at is distinct from old.disabled_at
      or new.disabled_reason is distinct from old.disabled_reason)
     and auth.uid() is not null
     and not public.is_popcode_admin() then
    raise exception 'Only an admin can disable or re-enable a Popcode'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_disable_admin on public.collections;
create trigger enforce_disable_admin
  before update on public.collections
  for each row execute function public.enforce_disable_admin();

commit;
