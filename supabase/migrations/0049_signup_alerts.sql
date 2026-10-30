-- 0049_signup_alerts.sql
--
-- "New sign-up" email to the owner.
--
-- The owner wants an email every time someone signs up, naming who it was.
-- The reminders cron (every 15 min) sends it, so it covers every way an
-- account is created (email code, Google, Apple, the iOS app) without a hook
-- in each flow. This column is the at-most-once guard, claimed with a
-- conditional UPDATE before the send, in the same shape as 0016 and 0048.
--
-- Every existing profile is stamped so the first run does not email the whole
-- back catalogue of old sign-ups.
--
-- A customer can write this on their own row (profiles has a self-update
-- policy and no column grants). The worst they can do is suppress the alert
-- about themselves, so it is not added to tg_profiles_lock_sensitive.
--
-- Additive and nullable, safe to apply before the code that reads it deploys.
alter table public.profiles
  add column if not exists signup_alert_sent_at timestamptz;

update public.profiles
   set signup_alert_sent_at = now()
 where signup_alert_sent_at is null;

comment on column public.profiles.signup_alert_sent_at is
  'When the owner''s "new sign-up" email was claimed for this profile (0049). NULL = not sent yet. Claimed via conditional UPDATE so it is sent at most once.';
