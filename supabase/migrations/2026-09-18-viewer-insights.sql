-- Viewer insights: creators see who viewed their Popcodes on My Popcodes.
--
-- Additive. RUN IN THE SUPABASE SQL EDITOR (prod) BEFORE the code deploys:
-- api/log-event.js starts writing recipient_code / progress_pct, and an insert
-- naming a column that doesn't exist fails the whole row.
--
-- Two ways a view reaches the creator:
--   * Plain link (popcode.app/{slug}) — anonymous: city, device, what played.
--     If the viewer happens to be signed in, their name shows instead.
--   * Personal link (popcode.app/{slug}?r={code}) — the creator named the
--     recipient when they made the link, so views on it show that name.
--
-- Raw IP addresses never leave the database: the RPC returns a hash of
-- IP + user agent, used only to tell one anonymous viewer from another.

begin;

-- ── Personal links ──────────────────────────────────────────────────────────
create table if not exists public.share_recipients (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  code          text not null unique check (code ~ '^[a-z0-9]{6,16}$'),
  name          text not null check (char_length(btrim(name)) between 1 and 60),
  created_at    timestamptz not null default now()
);
create index if not exists share_recipients_collection_idx
  on public.share_recipients (collection_id);

alter table public.share_recipients enable row level security;

drop policy if exists "owner manages share_recipients" on public.share_recipients;
create policy "owner manages share_recipients" on public.share_recipients
  for all to authenticated
  using (exists (select 1 from public.collections c
                 where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.collections c
                      where c.id = collection_id and c.user_id = auth.uid()));

-- ── New event fields ────────────────────────────────────────────────────────
-- recipient_code: the ?r= code the viewer arrived with (null on the plain link).
-- progress_pct:   on 'media_progress', how far into the video/audio the viewer
--                 got before closing it (0–99; finishing logs *_complete).
alter table public.scan_events add column if not exists recipient_code text;
alter table public.scan_events add column if not exists progress_pct smallint;

-- ── Creator-facing read ─────────────────────────────────────────────────────
-- Every viewer event on the caller's OWN projects. The collections join on
-- auth.uid() is the access control, same as get_my_target_metrics().
-- The creator's own views (signed in) are left out so testing doesn't count.
-- A recipient_code only resolves to a name if it belongs to that project —
-- anyone can post a made-up code, and it must not borrow another link's name.
create or replace function public.get_my_view_events(max_rows integer default 5000)
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
      md5(c.id::text || '|' || coalesce(e.ip_address::text, '') || '|' || coalesce(e.user_agent::text, '')),
      case when e.user_id is not null
           then coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
                         nullif(btrim(u.raw_user_meta_data->>'name'), ''),
                         u.email::text)
      end,
      r.code,
      r.name,
      e.progress_pct::integer
    from scan_events e
    join collections c on c.slug = e.slug and c.user_id = auth.uid()
    left join auth.users u on u.id = e.user_id
    left join share_recipients r on r.code = e.recipient_code and r.collection_id = c.id
    where (e.user_id is null or e.user_id <> auth.uid())
      and e.event_type in ('scan_open', 'scan_start', 'target_found',
                           'video_play', 'video_play_tap', 'video_complete',
                           'audio_play', 'audio_complete', 'media_progress')
    order by e.created_at desc
    limit greatest(1, least(coalesce(max_rows, 5000), 20000));
end;
$$;

revoke all on function public.get_my_view_events(integer) from public, anon;
grant execute on function public.get_my_view_events(integer) to authenticated;

commit;
