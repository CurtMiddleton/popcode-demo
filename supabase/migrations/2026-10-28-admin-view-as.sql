-- Read-only "view as" for admins (2026-10-28).
--
-- Additive. RUN IN THE SUPABASE SQL EDITOR (prod).
--
-- Lets an admin open My Projects, My Orders and Account as a customer sees
-- them (?as=<user id>, from Analytics -> Accounts) so support can follow what
-- the customer is describing. READ ONLY: every policy below is SELECT, the
-- two functions only read, and the pages block writes as well
-- (public/view-as.js). Nothing here lets an admin change a customer's data.
--
-- collections and collection_items are already admin-readable
-- (2026-09-04-lock-content-tables.sql).

begin;

drop policy if exists "admin reads print_orders" on public.print_orders;
create policy "admin reads print_orders" on public.print_orders
  for select to authenticated using (public.is_popcode_admin());

drop policy if exists "admin reads popcode_credits" on public.popcode_credits;
create policy "admin reads popcode_credits" on public.popcode_credits
  for select to authenticated using (public.is_popcode_admin());

drop policy if exists "admin reads credit_orders" on public.credit_orders;
create policy "admin reads credit_orders" on public.credit_orders
  for select to authenticated using (public.is_popcode_admin());

drop policy if exists "admin reads share_recipients" on public.share_recipients;
create policy "admin reads share_recipients" on public.share_recipients
  for select to authenticated using (public.is_popcode_admin());

-- ── The Account page's Popcode count, for another user ─────────────────────
-- Same arithmetic as popcode_quota() (2026-09-18-quota-admin-parity.sql), for
-- for_user instead of the caller.
create or replace function public.popcode_quota_as(for_user uuid)
returns table (allowance integer, used integer, remaining integer,
               purchased integer, granted integer, from_purchases integer)
language plpgsql stable security definer set search_path = public
as $$
declare
  p integer := 0; g integer := 0; f integer := 0; u integer := 0; a integer;
begin
  if not public.is_popcode_admin() then
    raise exception 'Admins only';
  end if;
  select coalesce(pc.purchased, 0), coalesce(pc.granted, 0), coalesce(pc.from_purchases, 0)
    into p, g, f
    from popcode_credits pc where pc.user_id = for_user;
  u := public.popcode_used(for_user);
  a := public.popcode_free_allowance() + coalesce(p, 0) + coalesce(g, 0) + coalesce(f, 0);
  return query select a, u, greatest(a - u, 0), coalesce(p, 0), coalesce(g, 0), coalesce(f, 0);
end;
$$;
revoke all on function public.popcode_quota_as(uuid) from public, anon;
grant execute on function public.popcode_quota_as(uuid) to authenticated;

-- ── My Projects' view counts, for another user ─────────────────────────────
-- get_my_view_events() (2026-09-26-no-ip-addresses.sql) with for_user in place
-- of auth.uid(), and an admin check.
create or replace function public.get_view_events_as(for_user uuid, max_rows integer default 5000)
returns table (
  slug           text,
  created_at     timestamptz,
  event_type     text,
  target_index   integer,
  city           text,
  region         text,
  country        text,
  device_type    text,
  user_agent     text,
  viewer_key     text,
  viewer_name    text,
  recipient_code text,
  recipient_name text,
  progress_pct   integer
)
language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.is_popcode_admin() then
    raise exception 'Admins only';
  end if;
  return query
    select
      e.slug::text,
      e.created_at::timestamptz,
      e.event_type::text,
      e.target_index::integer,
      e.city::text,
      e.region::text,
      e.country::text,
      e.device_type::text,
      e.user_agent::text,
      md5(c.id::text || '|' || coalesce(e.device_id::text,
          coalesce(e.ip_address::text, '') || '|' || coalesce(e.user_agent::text, ''))),
      case when e.user_id is not null
           then coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
                         nullif(btrim(u.raw_user_meta_data->>'name'), ''),
                         u.email::text)
      end,
      r.code,
      r.name,
      e.progress_pct::integer
    from scan_events e
    join collections c on c.slug = e.slug and c.user_id = for_user
    left join auth.users u on u.id = e.user_id
    left join share_recipients r on r.code = e.recipient_code and r.collection_id = c.id
    where (e.user_id is null or e.user_id <> for_user)
      and e.event_type in ('scan_open', 'scan_start', 'target_found',
                           'video_play', 'video_play_tap', 'video_complete',
                           'audio_play', 'audio_complete', 'media_progress')
    order by e.created_at desc
    limit greatest(1, least(coalesce(max_rows, 5000), 20000));
end;
$$;
revoke all on function public.get_view_events_as(uuid, integer) from public, anon;
grant execute on function public.get_view_events_as(uuid, integer) to authenticated;

commit;
