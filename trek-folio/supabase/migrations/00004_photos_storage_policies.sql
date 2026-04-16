-- Trek Folio — Phase 6 Photos: storage bucket + policies
--
-- Prerequisite: create the `trip-photos` bucket in the Supabase dashboard:
--   Storage → New bucket → name: trip-photos → toggle "Public bucket" ON → Save.
-- (The initial schema migration documents this, but it's easy to miss.)
--
-- Then run this file in the Supabase SQL Editor to apply the RLS policies
-- that let authenticated users upload/read/delete their own photo files.

-- Users can upload files under their own user id folder.
drop policy if exists "Users can upload trip photos" on storage.objects;
create policy "Users can upload trip photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone can read (bucket is public for display, object reads still go via
-- the public URL, but this is explicit for clarity).
drop policy if exists "Anyone can read trip photos" on storage.objects;
create policy "Anyone can read trip photos"
  on storage.objects for select
  using (bucket_id = 'trip-photos');

-- Users can update objects they own.
drop policy if exists "Users can update own trip photos" on storage.objects;
create policy "Users can update own trip photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete objects they own.
drop policy if exists "Users can delete own trip photos" on storage.objects;
create policy "Users can delete own trip photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
