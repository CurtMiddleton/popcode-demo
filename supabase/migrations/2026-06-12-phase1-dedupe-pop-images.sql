-- Phase 1 cleanup: de-duplicate pop_images and prevent future dupes.
--
-- Context: an early, pre-resumable seed run inserted one row per
-- collection_items row, and that table has duplicate target_index rows, so
-- pop_images ended up with many identical-embedding rows per page. This keeps
-- exactly one row per (collection_id, target_ref) and adds a unique index so
-- re-seeding can never duplicate a page again.
--
-- RUN IN THE `identification` BRANCH SQL EDITOR (not production).

-- 1. Drop duplicate rows, keeping one arbitrary row per (collection_id, target_ref).
delete from pop_images a
using pop_images b
where a.collection_id = b.collection_id
  and a.target_ref   = b.target_ref
  and a.ctid < b.ctid;

-- 2. Enforce one row per page going forward.
create unique index if not exists pop_images_collection_target_uniq
  on pop_images (collection_id, target_ref);
