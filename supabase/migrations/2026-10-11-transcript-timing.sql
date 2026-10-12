-- Word timings for an audio page's transcript, so the viewer's "Follow along"
-- lights each word as it is spoken instead of guessing from word length.
--
-- Additive. RUN IN THE SUPABASE SQL EDITOR (prod).
--
-- Shape: [[start, end], ...] in seconds, one pair per word of `transcript`
-- (words = the non-whitespace runs of the text, in order). Written by
-- create.html / edit.html from /api/align-transcript (ElevenLabs forced
-- alignment). Null = no timings; the viewer falls back to proportional timing.
alter table collection_items add column if not exists transcript_timing jsonb;
