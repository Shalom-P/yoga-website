-- 0008_storage_buckets.sql
-- Provision the Storage buckets the admin tools upload to, and the RLS
-- policies that let admins write while everyone else reads.
--
-- The two buckets:
--   promotional-media — hero videos, banners, testimonial photos, class
--                       thumbnails (the /admin/media tab).
--   teacher-media     — per-teacher avatars, cover images, intro videos
--                       (TeacherFormDialog uploads).
--
-- Both are public-read (rendered on the marketing site) and admin-write only.
-- Without these policies, uploads fail with "new row violates row-level
-- security policy" — the Storage row insert is blocked by RLS on
-- storage.objects.

-- 1. Create the buckets if they don't already exist.
insert into storage.buckets (id, name, public)
values
  ('promotional-media', 'promotional-media', true),
  ('teacher-media',     'teacher-media',     true)
on conflict (id) do nothing;

-- 2. Public read for both buckets. The bucket flag above already serves
--    files publicly, but RLS on storage.objects still gates SELECT for
--    listing — this policy makes signed-in and anon clients able to enumerate.
drop policy if exists "promotional_media_public_read" on storage.objects;
create policy "promotional_media_public_read"
  on storage.objects for select
  using (bucket_id = 'promotional-media');

drop policy if exists "teacher_media_public_read" on storage.objects;
create policy "teacher_media_public_read"
  on storage.objects for select
  using (bucket_id = 'teacher-media');

-- 3. Admin-only INSERT / UPDATE / DELETE on both buckets. Uses the same
--    public.is_admin(auth.uid()) helper that gates admin policies on app tables.
drop policy if exists "promotional_media_admin_write" on storage.objects;
create policy "promotional_media_admin_write"
  on storage.objects for insert
  with check (bucket_id = 'promotional-media' and public.is_admin(auth.uid()));

drop policy if exists "promotional_media_admin_update" on storage.objects;
create policy "promotional_media_admin_update"
  on storage.objects for update
  using (bucket_id = 'promotional-media' and public.is_admin(auth.uid()))
  with check (bucket_id = 'promotional-media' and public.is_admin(auth.uid()));

drop policy if exists "promotional_media_admin_delete" on storage.objects;
create policy "promotional_media_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'promotional-media' and public.is_admin(auth.uid()));

drop policy if exists "teacher_media_admin_write" on storage.objects;
create policy "teacher_media_admin_write"
  on storage.objects for insert
  with check (bucket_id = 'teacher-media' and public.is_admin(auth.uid()));

drop policy if exists "teacher_media_admin_update" on storage.objects;
create policy "teacher_media_admin_update"
  on storage.objects for update
  using (bucket_id = 'teacher-media' and public.is_admin(auth.uid()))
  with check (bucket_id = 'teacher-media' and public.is_admin(auth.uid()));

drop policy if exists "teacher_media_admin_delete" on storage.objects;
create policy "teacher_media_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'teacher-media' and public.is_admin(auth.uid()));
