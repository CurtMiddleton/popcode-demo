-- Impact dashboard, phase 1: the event fields the dashboard will need that
-- can't be recovered later (docs/impact-dashboard-handoff.md §3–§4).
--
-- Additive. RUN IN THE SUPABASE SQL EDITOR (prod). Deploy order doesn't
-- matter: api/log-event.js retries without these columns if the insert names
-- one that doesn't exist yet — events are kept, just without the new fields.
--
-- The handoff's `events` table is NOT created: scan_events already carries it
-- under other names (page_view = scan_open, camera_start = scan_start,
-- recognized = target_found, video_progress = media_progress/video_complete
-- with progress_pct, button_tap = cta_tap_1..3, platform = device_type,
-- image_id = target_index). Only these three were missing:
--
-- device_id      Random ID the viewer's browser makes and keeps in
--                localStorage (view.html). Counts "about N different phones"
--                without leaning on IP + user agent. Not a fingerprint; iOS
--                may clear it, so it's an estimate.
-- entry          'custom' when the visit arrived via the org's own address
--                (redirected to popcode.app/{slug}?via=org), else 'popcode'.
--                Null on non-viewer events and on events from before this.
-- collection_id  The project, looked up from the slug when the event is
--                logged. Slugs can be renamed (edit.html renameProjectSlug)
--                and old events keep the old slug; this survives the rename.
--                No foreign key on purpose: a bad id must never make the
--                insert fail and lose the event.

begin;

alter table public.scan_events add column if not exists device_id     text;
alter table public.scan_events add column if not exists entry         text;
alter table public.scan_events add column if not exists collection_id uuid;

-- Dashboard reads are per campaign (= collection) over a date range.
create index if not exists scan_events_collection_created_idx
  on public.scan_events (collection_id, created_at)
  where collection_id is not null;

commit;

-- Check:
--   select column_name, data_type from information_schema.columns
--   where table_name = 'scan_events'
--     and column_name in ('device_id', 'entry', 'collection_id');
