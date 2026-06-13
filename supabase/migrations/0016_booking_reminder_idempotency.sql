-- 0016_booking_reminder_idempotency.sql
-- Makes /api/cron/reminders idempotent at the DB level so the every-15-min
-- schedule cannot double-send.
--
-- The handler emails a ±10-minute band around now+24h and now+1h. At a 15-min
-- cadence those bands overlap between consecutive runs (and a restart can
-- re-fire the same band), so without a sent-marker a customer can receive
-- duplicate reminders. The handler now claims each (booking, window) pair via a
-- conditional UPDATE on these columns before sending.
--
-- Apply:  psql "$SUPABASE_DB_URL" -f supabase/migrations/0016_booking_reminder_idempotency.sql

alter table public.bookings
  add column if not exists reminded_at_24h timestamptz,
  add column if not exists reminded_at_1h  timestamptz;
