-- 2026-09-09 — creator-side activity events
--
-- The analytics dashboard only ever saw consumption (scan_open, target_found,
-- video_play …) because scan_events was written exclusively by view.html. We
-- now also log creation-side events through the same table and the same
-- /api/log-event endpoint:
--
--   signup            an account was created
--   create_project    a Popcode was made in create.html
--   create_book       photo book saved for the first time
--   create_boardbook  board book saved for the first time
--   create_calendar   calendar saved for the first time
--   create_montage    a montage video was rendered in create.html
--   save_design       a print design was saved to My Designs
--
-- Reusing scan_events (rather than a new activity_events table) means these
-- inherit session grouping, geo and device parsing for free, and the Activity
-- Log renders them with no new plumbing. The cost is that the table name is
-- now a misnomer — mild, next to `collections` meaning Projects.
--
-- The ONLY schema change needed is below: `signup` and `create_montage` happen
-- before any project row exists, so they have no slug.

alter table public.scan_events alter column slug drop not null;

-- Verify:
--   select column_name, is_nullable
--   from information_schema.columns
--   where table_name = 'scan_events' and column_name = 'slug';
--   -> is_nullable = YES

-- NOTE on the existing get_events_with_users RPC: it does not need dropping and
-- recreating here, because no column was added — only a null constraint
-- relaxed. (Contrast with the 2026-04-15 lesson, where adding a column DID
-- require recreating the function.) Rows with a null slug flow through it
-- unchanged; analytics.html renders them as "Account".
