-- Book maker — additive columns on `collections`.
--
-- A "book" is just a collection with kind='book' plus a `book_layout` jsonb that
-- stores the page-by-page structure (pages, per-page layout template, photo slots,
-- and which slots are popcoded). Only popcoded photos become collection_items and
-- get compiled into the `.mind` target, so the existing viewer (view.html /
-- scan.html), download, and print flows keep working unchanged.
--
-- Run this in the Supabase SQL editor before deploying book.html. Additive only —
-- existing single-project ("standard") collections are unaffected (kind defaults
-- to 'standard', book_layout stays null).

alter table collections
  add column if not exists kind text default 'standard',
  add column if not exists book_layout jsonb;

update collections set kind = 'standard' where kind is null;

-- book_layout jsonb shape (documented here for future sessions):
-- {
--   "size": "square",                      -- book format key (maps to a print SKU later)
--   "pages": [
--     {
--       "id": "p_ab12",
--       "layout": "four",                  -- layout template key (see LAYOUTS in book.html)
--       "slots": [
--         { "photo_url": "https://…/{slug}/book/photo_x.jpg",
--           "target_index": 0 },           -- non-null = popcoded (a collection_items row); null = plain photo
--         { "photo_url": "https://…", "target_index": null },
--         null                             -- empty slot
--       ]
--     }
--   ]
-- }
--
-- No new RLS policies needed: owners already insert/update their own collections
-- rows, and these are ordinary columns on that row. The cover_config admin trigger
-- only fires when cover_config changes, so it does not affect book writes.
