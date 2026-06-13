-- Phase 4: richer identify_events logging for threshold tuning + agreement.
--
-- Adds columns to the existing identify_events table (created in Phase 0) so
-- every /api/identify call records enough to (a) tune the production threshold
-- from real score distributions and (b) measure agreement between what the new
-- CLIP identify guessed and what MindAR actually tracked on the same scan.
--
-- RUN IN THE `identification` BRANCH SQL EDITOR (not production). Additive.

alter table identify_events
  add column if not exists handle               text,
  add column if not exists reason               text,            -- matched | low_confidence | no_candidates
  add column if not exists matched_target_ref   text,            -- page the new identify chose
  add column if not exists tracked_target_ref   text,            -- page MindAR actually locked (from feedback)
  add column if not exists runner_up_confidence double precision, -- 2nd-best score (margin = confidence - this)
  add column if not exists threshold            double precision; -- cutoff applied for this call

-- `confidence` (top-1) + `matched_image` + `collection_id` + `matched_by` +
-- `agreed` already exist from the Phase 0 scaffold.
