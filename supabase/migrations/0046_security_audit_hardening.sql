-- 0046_security_audit_hardening.sql
-- Fixes from the October 2026 security audit. Each section is independent and
-- idempotent (safe to re-run).
--
-- APPLY ORDER: deploy the matching app release FIRST, then run this file. The
-- app code is written to work against both the old and the new schema:
--   * lib/data/landing.ts selects explicit public columns (needed by §5)
--   * /api/newsletter/subscribe calls the RPC on the service role (needed by §8)
--   * lib/security/rateLimit.ts fails open until §9 exists
-- Running this before that release makes the anon teacher/review queries fail
-- with 42501: lib/data/landing.ts then silently shows the MOCK placeholder
-- teachers and an empty testimonial wall, and newsletter signup fails, until
-- the release ships.
--
-- Apply: psql "$SUPABASE_DB_URL" -f supabase/migrations/0046_security_audit_hardening.sql
-- Then:  psql "$SUPABASE_DB_URL" -f verify-launch.sql

begin;

-- ── 1. reviews: no client INSERT/UPDATE ──────────────────────────────────────
-- reviews_self_insert (0005) only checked customer_id, so any signed-in user
-- could insert is_approved = true, is_featured = true with any text, teacher and
-- display name, straight onto the homepage testimonial wall. /api/reviews
-- inserts on the service role with is_approved = false, so neither self policy
-- is used by the app.
drop policy if exists "reviews_self_insert" on public.reviews;
drop policy if exists "reviews_self_update" on public.reviews;

-- One review per customer per session (the route's check-then-insert is racy).
-- Created only if no duplicates exist yet; otherwise left for the admin to tidy.
do $$
begin
  if not exists (
    select 1 from public.reviews where session_id is not null
    group by customer_id, session_id having count(*) > 1
  ) then
    create unique index if not exists reviews_one_per_customer_session
      on public.reviews (customer_id, session_id) where session_id is not null;
  else
    raise notice 'reviews_one_per_customer_session NOT created: duplicate (customer_id, session_id) rows exist; delete them and re-run';
  end if;
end $$;

-- Public readers never need customer_id / session_id (reviewer auth uuids).
revoke select on public.reviews from anon;
grant select (id, teacher_id, rating, body, is_featured, is_approved,
              display_name_override, display_location, created_at, updated_at)
  on public.reviews to anon;

-- ── 2. bookings: drop the customer self-UPDATE ───────────────────────────────
-- bookings_self_update_cancel (0018) pinned only status, so a customer could
-- "cancel" their own booking while changing session_id to any session. The
-- capacity trigger skips cancelled rows and sessions_booked_customer_read has no
-- status filter, so they could then read that session's Meet link. Every cancel
-- now goes through /api/bookings/cancel or the cancel-booking Edge Function on
-- the service role; no browser code updates bookings.
drop policy if exists "bookings_self_update_cancel" on public.bookings;

-- ── 3. teachers: a teacher may edit ONLY their profile copy ─────────────────
-- The 0026 trigger pinned a deny-list that predates is_public (0041),
-- contact_email (0040) and the admin-managed media columns, so a hidden teacher
-- could un-hide themselves and swap their photo/video. Switch to an allow-list
-- matching components/teacher/TeacherProfileForm.tsx. The auth.uid() IS NULL
-- carve-out stays: promote_to_teacher depends on it (see 0026).
create or replace function public.tg_teachers_lock_admin_cols()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r public.teachers;
begin
  if auth.uid() is null or public.is_admin(auth.uid()) then
    return new;
  end if;
  r := old;
  r.display_name     := new.display_name;
  r.headline         := new.headline;
  r.bio              := new.bio;
  r.specialties      := new.specialties;
  r.languages        := new.languages;
  r.years_experience := new.years_experience;
  r.updated_at       := new.updated_at;
  return r;
end $$;

-- ── 4. teachers: anon sees public teachers and public columns only ──────────
-- teachers_public_read (0002) let anon read every column (contact_email, which
-- 0040 filled with personal addresses; google_calendar_id; profile_id) of every
-- active teacher, hidden ones included.
drop policy if exists "teachers_public_read" on public.teachers;
create policy "teachers_public_read" on public.teachers
  for select to anon using (is_active = true and is_public = true);
-- Signed-in users keep the old row visibility (booking flows, admin UI).
drop policy if exists "teachers_authenticated_read" on public.teachers;
create policy "teachers_authenticated_read" on public.teachers
  for select to authenticated using (is_active = true);

revoke select on public.teachers from anon;
grant select (id, slug, display_name, headline, bio, avatar_url, cover_image_url,
              intro_video_url, specialties, languages, years_experience,
              certifications, rating_avg, rating_count, timezone, is_active,
              is_public, sort_order, created_at, updated_at)
  on public.teachers to anon;

-- Blocked-day reasons are free text; nothing anonymous reads overrides.
revoke select on public.teacher_slot_overrides from anon;

-- ── 5. medical_documents: path must be exactly {customer_id}/{one safe file} ─
-- The 0027 policies checked storage_path LIKE uid || '/%', which
-- '{uid}/../{victim}/{file}' satisfies; storage-js does not encode the path, so
-- the service-role download/delete routes would act on the victim's object.
-- Mirrors isSafeMedicalPath in lib/medical/constants.ts.
drop policy if exists "medical_documents_owner_insert" on public.medical_documents;
create policy "medical_documents_owner_insert" on public.medical_documents
  for insert with check (
    auth.uid() = customer_id
    and storage_path ~ ('^' || auth.uid()::text || '/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,199}$')
    and position('..' in storage_path) = 0
  );

drop policy if exists "medical_documents_owner_update" on public.medical_documents;
create policy "medical_documents_owner_update" on public.medical_documents
  for update using (auth.uid() = customer_id)
  with check (
    auth.uid() = customer_id
    and storage_path ~ ('^' || auth.uid()::text || '/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,199}$')
    and position('..' in storage_path) = 0
  );

-- Table-level backstop for every writer, service role included. NOT VALID so a
-- legacy odd row can't block the migration; validate after the check below.
alter table public.medical_documents
  drop constraint if exists medical_documents_path_shape;
alter table public.medical_documents
  add constraint medical_documents_path_shape check (
    split_part(storage_path, '/', 1) = customer_id::text
    and storage_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,199}$'
    and position('..' in storage_path) = 0
  ) not valid;

-- Owners cannot move a row's path, re-home it, or un-delete a tombstone.
create or replace function public.tg_medical_documents_lock_cols()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;  -- service-role routes
  new.customer_id  := old.customer_id;
  new.storage_path := old.storage_path;
  if old.deleted_at is not null then new.deleted_at := old.deleted_at; end if;
  return new;
end $$;
drop trigger if exists medical_documents_lock_cols on public.medical_documents;
create trigger medical_documents_lock_cols
  before update on public.medical_documents
  for each row execute function public.tg_medical_documents_lock_cols();

-- ── 6. Public media buckets: no anonymous listing; images/video only ────────
-- Public URLs don't need a SELECT policy; it only let anyone .list() the
-- buckets (drafts, unreferenced files). Admins keep it (needed for upsert).
drop policy if exists "promotional_media_public_read" on storage.objects;
drop policy if exists "teacher_media_public_read" on storage.objects;
drop policy if exists "public_media_admin_read" on storage.objects;
create policy "public_media_admin_read" on storage.objects
  for select using (
    bucket_id in ('promotional-media', 'teacher-media')
    and public.is_admin(auth.uid())
  );

-- No SVG/HTML on the public Storage origin.
update storage.buckets
   set allowed_mime_types = array[
     'image/jpeg','image/png','image/webp','image/avif','image/gif',
     'image/heic','image/heif',
     'video/mp4','video/webm','video/quicktime'
   ]
 where id in ('promotional-media', 'teacher-media');

-- ── 7. Lock down helper functions anon/authenticated never need ─────────────
-- customer_booked_teacher is only called inside SECURITY DEFINER RPCs; exposed,
-- it answers "has customer X booked teacher T" for anyone. is_teacher is unused
-- by policies and the app. validate_discount_code belongs to the retired rail
-- and was an unthrottled promo-code oracle for signed-in users.
revoke execute on function public.customer_booked_teacher(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.is_teacher(uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'validate_discount_code') then
    execute 'revoke execute on function public.validate_discount_code(text, uuid) from public, anon, authenticated';
  end if;
end $$;

-- ── 8. Newsletter RPC: only via the (rate-limited) route ────────────────────
revoke execute on function public.subscribe_newsletter(text, text) from public, anon, authenticated;
grant execute on function public.subscribe_newsletter(text, text) to service_role;

-- ── 9. Rate limiting (lib/security/rateLimit.ts) ─────────────────────────────
create table if not exists public.rate_limit_hits (
  key          text        not null,
  window_start timestamptz not null,
  hits         int         not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limit_hits enable row level security;  -- no policies: service role only
revoke all on public.rate_limit_hits from anon, authenticated;

create or replace function public.rate_limit_hit(p_key text, p_window_seconds int, p_max int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz;
  v_hits   int;
begin
  if p_key is null or length(p_key) > 200 or p_window_seconds < 1 or p_max < 1 then
    return false;
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limit_hits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  -- Opportunistic cleanup of this key's expired windows.
  delete from public.rate_limit_hits where key = p_key and window_start < v_window;
  return v_hits <= p_max;
end $$;
revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

commit;

-- ── After applying ───────────────────────────────────────────────────────────
-- 1. Any medical rows that fail the new path rule? (expect zero rows)
--      select id, customer_id, storage_path from public.medical_documents
--       where not (split_part(storage_path,'/',1) = customer_id::text
--                  and storage_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,199}$'
--                  and position('..' in storage_path) = 0);
--    If none: alter table public.medical_documents validate constraint medical_documents_path_shape;
-- 2. Any reviews published without moderation through the old self-insert?
--      select id, customer_id, created_at, body from public.reviews
--       where is_approved and session_id is null order by created_at desc;
