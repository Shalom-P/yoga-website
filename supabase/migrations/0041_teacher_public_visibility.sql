-- 0041_teacher_public_visibility.sql
--
-- Let an admin take a teacher off the public site without retiring them.
--
-- Until now `is_active` was the only lever and it conflated two things:
-- "this teacher can be scheduled at all" and "this teacher is advertised".
-- Turning it off removed them from every listing AND made them unbookable,
-- with app/api/bookings/confirm rejecting the teacher outright, so there was
-- no way to keep a teacher working with their existing students while hiding
-- them from new ones.
--
-- Splitting it:
--   is_active = false                 retired. Not listed, not schedulable.
--   is_active = true,  is_public = false
--                                     hidden. Absent from every public page,
--                                     the sitemap and the customer's own
--                                     booking picker, and not self-bookable,
--                                     but an admin can still schedule sessions
--                                     with them and those sessions work
--                                     normally for the students in them.
--   is_active = true,  is_public = true
--                                     normal.
--
-- Defaults to true so every existing teacher keeps its current behaviour.
alter table public.teachers
  add column if not exists is_public boolean not null default true;

comment on column public.teachers.is_public is
  'Whether this teacher is advertised publicly: listings, teacher detail page, sitemap, and the customer booking picker. false hides them everywhere public while leaving them schedulable by an admin. Retiring a teacher entirely is is_active = false.';

-- Partial index: every public listing query filters on both flags, and the
-- hidden set is expected to stay small.
create index if not exists teachers_public_listing_idx
  on public.teachers (sort_order)
  where is_active and is_public;
