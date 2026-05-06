-- Adds audio support to collection_items.
--
-- Run this in the Supabase SQL editor before deploying the audio feature.
-- After running, drop+recreate any RPC functions that select from
-- collection_items so the new columns appear in their return types
-- (see CLAUDE.md "RPC functions don't auto-update" lesson).

alter table collection_items
  add column if not exists media_type text default 'video',
  add column if not exists audio_url text,
  add column if not exists transcript text;

-- Backfill existing rows so the not-null-ish default is consistent.
update collection_items set media_type = 'video' where media_type is null;
