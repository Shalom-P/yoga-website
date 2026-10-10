-- 0043_review_requests.sql
--
-- Post-session review requests.
--
-- /reviews is honestly empty: there is no path that asks a customer for a
-- review after a session, so the `reviews` table (0005) has never had a row
-- written by a customer. The no-show sweep now emails a review request once a
-- session has ended, and this column is the at-most-once guard for it, in the
-- same shape as the reminder columns from 0016: the sweep claims a booking
-- with a conditional UPDATE (set ... where review_requested_at is null) before
-- sending, so overlapping runs cannot double-send.
--
-- Additive and nullable, safe to apply before the code that writes it deploys.
alter table public.bookings
  add column if not exists review_requested_at timestamptz;

comment on column public.bookings.review_requested_at is
  'When the post-session review request email was claimed for this booking (0043). NULL = not yet asked. Claimed via conditional UPDATE so it is sent at most once.';

-- The sweep selects on (status, review_requested_at IS NULL) and joins sessions
-- by end_at; a partial index keeps that scan cheap once the backlog grows.
create index if not exists bookings_review_request_pending_idx
  on public.bookings (session_id)
  where review_requested_at is null and status <> 'cancelled';
