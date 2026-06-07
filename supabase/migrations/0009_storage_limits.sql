-- 0009_storage_limits.sql
-- Raise per-bucket upload size limits so teacher intro videos and marketing
-- hero videos can actually be uploaded.
--
-- WHY: 0008 created both buckets without a `file_size_limit`, so they inherit
-- the PROJECT-WIDE default (50 MB on a fresh Supabase project). A typical
-- 30–60s phone MP4 is 50–150 MB, so intro-video uploads fail with HTTP 413
-- ("The object exceeded the maximum allowed size") — which previously surfaced
-- as a cryptic "Upload failed" in the admin TeacherFormDialog.
--
-- IMPORTANT: a per-bucket `file_size_limit` can NEVER exceed the global limit.
-- Set the project-wide cap too: Supabase Dashboard → Project Settings → Storage
-- → "Upload file size limit" → at least 200 MB. Without that, the values below
-- are silently capped at the global default and large videos still fail.

update storage.buckets
  set file_size_limit = 104857600   -- 100 MB: teacher avatars/covers + intro videos
  where id = 'teacher-media';

update storage.buckets
  set file_size_limit = 209715200   -- 200 MB: hero videos, banners, testimonial media
  where id = 'promotional-media';
