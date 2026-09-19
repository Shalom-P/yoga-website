-- 0040_teacher_contact_email.sql
--
-- Teachers were never invited to their own sessions.
--
-- `createMeetEvent` builds the attendee list from the STUDENT's email only, on
-- every one of the five paths that provision a Meet link. The teacher appeared
-- nowhere on the calendar event except as text in the summary ("Yoga with
-- Dr X"), so no teacher has ever received a calendar invite and the session
-- never lands in their own Google Calendar. They can only find it by signing in
-- to /teacher.
--
-- There is also no email to invite them AT: `teachers` has no email column, and
-- every active teacher has profile_id IS NULL (no linked login), so
-- profiles.email resolves to nothing.
--
-- This adds `contact_email`: an address used ONLY for calendar invites and
-- operational mail. It is deliberately NOT an auth identity. Teacher logins are
-- still created exclusively through promote_to_teacher() via the admin invite
-- route, which sets profile_id; when that link exists, profiles.email wins and
-- this column is the fallback.
alter table public.teachers
  add column if not exists contact_email text;

comment on column public.teachers.contact_email is
  'Email used to send Google Calendar invites for this teacher''s sessions, and for operational mail. NOT an auth identity: logins are created via promote_to_teacher() and live on profiles. Resolution order is profiles.email (when profile_id is linked) then this column.';

-- Move misfiled addresses out of google_calendar_id.
--
-- google_calendar_id is the calendar the event is CREATED IN, which the
-- Workspace service account must be able to write to. Domain-wide delegation
-- only authorises accounts inside the Workspace domain, so a personal
-- @gmail.com address there is guaranteed to fail: every session for the one
-- active teacher configured this way came back meet_status='failed', while all
-- six sessions for teachers with a NULL calendar succeeded.
--
-- The address itself is still useful, just in the other field: inviting an
-- @gmail.com account as an ATTENDEE works fine, because that is not the same as
-- writing into their calendar.
-- Scoped to gmail.com because that is what is actually in the table today
-- (two rows). Any other consumer domain in this column has the same defect and
-- needs the same move; there is no way to detect it generically here, since the
-- Workspace domain is only known to the runtime via GOOGLE_IMPERSONATE_SUBJECT.
update public.teachers
   set contact_email = coalesce(contact_email, google_calendar_id),
       google_calendar_id = null
 where google_calendar_id like '%@gmail.com';

-- Re-arm the failed sessions so the meet-retry cron provisions them on the
-- system calendar. Only touches rows that never got a link.
update public.sessions
   set meet_status = 'pending'
 where meet_status = 'failed'
   and meet_link is null;
