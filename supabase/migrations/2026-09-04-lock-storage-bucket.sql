-- 2026-09-04 (second) — Remove anonymous access to the `experiences` storage bucket.
--
-- WHY
-- ---
-- The live policy was:
--
--   policyname: "Allow all on experiences"
--   cmd: ALL   roles: {public}   qual: (bucket_id = 'experiences')
--
-- In Postgres the `public` role means EVERYONE, anonymous included, and `ALL`
-- covers SELECT, INSERT, UPDATE and DELETE. So the anon key that ships in
-- public/config.js could upload, overwrite and delete any file in the bucket.
--
-- Verified 2026-09-04 from outside, with only the public key:
--   * listing the bucket returned all 52 project folders
--   * listing one folder returned photo_0.jpg / target.mind / video_0.mp4
--   * a DELETE of a non-existent path returned `NoSuchKey` (not a permission
--     error) — i.e. the policy permitted the delete, the object just wasn't there
--
-- That is worse than the database hole fixed earlier today. Overwriting
-- {slug}/video_0.mp4 repoints every printed copy of that book directly, with no
-- duplicate-row trick needed; deleting {slug}/target.mind stops it scanning at
-- all; and unlike a database row, deleted files are actually gone.
--
-- WHAT THIS DOES
-- --------------
-- Replaces that one policy with four scoped to `authenticated`. Anonymous
-- visitors keep exactly what the product needs and nothing else.
--
-- Public playback is NOT affected. Supabase serves a public bucket's
-- /object/public/... URLs without consulting RLS, so view.html keeps streaming
-- video and Prodigi keeps fetching print assets. What goes away is the
-- /object/list/... API and every anonymous write.
--
-- Verified no anonymous code path writes to or lists this bucket: every upload
-- (create, edit, book, boardbook, calendar, design, order) and every list
-- (analytics cost panel, manage delete, edit rename) happens while signed in.
--
-- NO DEPLOY ORDERING NEEDED — unlike the content-table migration, no shipped
-- code depends on this. Safe to run on its own, at any time.

begin;

drop policy if exists "Allow all on experiences" on storage.objects;

create policy "experiences read (signed in)"
  on storage.objects for select to authenticated
  using (bucket_id = 'experiences');

create policy "experiences insert (signed in)"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'experiences');

create policy "experiences update (signed in)"
  on storage.objects for update to authenticated
  using      (bucket_id = 'experiences')
  with check (bucket_id = 'experiences');

create policy "experiences delete (signed in)"
  on storage.objects for delete to authenticated
  using (bucket_id = 'experiences');

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK, if uploads break unexpectedly (restores the old wide-open rule):
--
--   create policy "Allow all on experiences" on storage.objects
--     for all to public using (bucket_id = 'experiences');
--
-- ─────────────────────────────────────────────────────────────────────────────
-- KNOWN LIMIT — this closes ANONYMOUS access, not cross-account access.
-- Any signed-in user can still write to any {slug}/ folder. Scoping storage per
-- owner needs a code change first: create.html uploads the files (lines
-- ~1141-1185) BEFORE inserting the collections row (~line 1199), so a policy
-- joining name -> collections.slug -> user_id would block project creation
-- outright. Fixing it properly means reserving the collections row before the
-- uploads, then tightening these four policies. Worth doing, but it is a
-- product change, not a policy change.
