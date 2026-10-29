-- 0048_first_booking_nudges.sql
--
-- "Book your first session" follow-up emails.
--
-- A customer who signs up, finishes onboarding and then never books hears
-- nothing from us: the only customer emails are booking confirmations,
-- reminders and review requests. The October Google Ads review found every ad
-- sign-up stopped at exactly that point (3 complete profiles, 0 bookings).
-- The reminders cron now sends up to two nudges to such customers, ~1 hour and
-- ~24 hours after sign-up, and these columns are the at-most-once guards, in
-- the same shape as the reminder columns from 0016: the cron claims a profile
-- with a conditional UPDATE (set ... where ... is null) before sending, so
-- overlapping runs cannot double-send.
--
-- A customer can technically write these on their own row (profiles has a
-- self-update policy and no column grants). The worst they can do is stop
-- their own nudge, so they are not added to tg_profiles_lock_sensitive.
--
-- Additive and nullable, safe to apply before the code that writes it deploys.
alter table public.profiles
  add column if not exists booking_nudge_1h_at timestamptz,
  add column if not exists booking_nudge_24h_at timestamptz;

comment on column public.profiles.booking_nudge_1h_at is
  'When the ~1h "book your first session" email was claimed for this customer (0048). NULL = not sent. Claimed via conditional UPDATE so it is sent at most once.';
comment on column public.profiles.booking_nudge_24h_at is
  'When the ~24h "book your first session" email was claimed for this customer (0048). NULL = not sent. Claimed via conditional UPDATE so it is sent at most once.';
