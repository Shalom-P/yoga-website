-- 0014_session_meet_calendar.sql
-- Records which Google Calendar a session's Meet event was created on, so that
-- cancellation deletes the event from the correct calendar.
--
-- Background: sessions can now be hosted on a teacher's own calendar
-- (teachers.google_calendar_id) instead of the single system calendar. The
-- event id alone is not enough to delete it — the Calendar API delete is scoped
-- to a calendar — so we persist the calendar id used at create time. Legacy rows
-- have NULL here and were all created on GOOGLE_SYSTEM_CALENDAR_ID, which is the
-- delete default, so they remain correct.
--
-- IMPORTANT: apply this to the live DB before deploying the per-teacher-calendar
-- change. Run in the Supabase SQL editor or via psql:
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0014_session_meet_calendar.sql

alter table public.sessions
  add column if not exists meet_calendar_id text;
