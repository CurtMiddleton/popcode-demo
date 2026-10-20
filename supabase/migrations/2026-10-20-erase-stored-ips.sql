-- Erase the IP addresses still stored on old events (2026-10-20).
--
-- RUN ONCE IN THE SUPABASE SQL EDITOR (prod). Safe to run again: rows already
-- replaced are skipped.
--
-- api/log-event.js stopped writing ip_address on 2026-09-26 (eb81c4c), but
-- every event before that still held the viewer's real IP — so "Popcode
-- doesn't keep IP addresses" (impact dashboard, privacy page) wasn't true of
-- history. 2026-09-26-no-ip-addresses.sql left them in place on purpose; the
-- user changed that decision on 2026-10-02 and confirmed it 2026-10-20.
--
-- Each IP becomes a keyed one-way code: 'x' + 16 hex chars of
-- md5(secret || ip). The secret is random, exists only inside this
-- statement, and is never stored, so no one — Popcode included — can turn a
-- code back into an IP (an unkeyed hash of an IPv4 address could simply be
-- brute-forced). The same IP still becomes the same code, so everything that
-- told old viewers apart (md5(ip_address || user_agent) in get_reach_events,
-- get_my_view_events, get_impact_dashboard and friends) keeps counting the
-- same unique viewers. Every RPC already casts ip_address::text, so changing
-- the column to text below breaks none of them.

begin;

-- An inet column can't hold a code; make it text first if it isn't.
do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'scan_events'
        and column_name = 'ip_address') <> 'text' then
    alter table public.scan_events alter column ip_address type text using ip_address::text;
  end if;
end $$;

do $$
declare
  secret text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  update public.scan_events
     set ip_address = 'x' || left(md5(secret || ip_address), 16)
   where ip_address is not null
     and ip_address !~ '^x[0-9a-f]{16}$';
end $$;

commit;

-- Check afterwards (should return 0):
--   select count(*) from scan_events
--   where ip_address is not null and ip_address !~ '^x[0-9a-f]{16}$';
