-- Phase 5: per-handle cutover flag + audio support.
--
-- Additive. RUN IN THE `identification` BRANCH SQL EDITOR (and, at go-live,
-- in prod). Nothing here is destructive.

-- 1. Per-handle cutover flag. The new bare /{handle} experience only goes live
--    for a creator when this is true — so cutover is one creator at a time,
--    with legacy as the untouched fallback. /api/identify enforces it.
alter table creators
  add column if not exists new_identification_enabled boolean default false;

-- 2. Audio support. pop_images was video-only; mirror the media columns that
--    collection_items already has so audio-first projects play via the new path.
alter table pop_images
  add column if not exists media_type text default 'video',  -- 'video' | 'audio'
  add column if not exists audio_url  text,
  add column if not exists transcript text;

-- To turn the new experience on for a creator (e.g. @Curt) in this branch:
--   update creators set new_identification_enabled = true where handle = 'Curt';
