// Pure helpers: no secrets, no network, no DB, so deliberately NOT `server-only`.
// That import is a bundler alias which does not resolve under vitest, and these
// are exactly the dependency-free helpers the test suite is meant to cover.
/**
 * Resolve the address a teacher should receive calendar invites at.
 *
 * Order matters. A linked login (`teachers.profile_id` -> `profiles.email`) is
 * the teacher's real identity in this system, created through
 * promote_to_teacher(), so it wins. `teachers.contact_email` is the fallback
 * for teachers who have a record but no login, which is currently all of them.
 *
 * Returns null when neither exists, and callers must treat that as "do not
 * invite" rather than an error: a missing invite is not a reason to fail a
 * booking, and Google rejects the whole event insert if an attendee address is
 * malformed.
 */
export function teacherInviteEmail(teacher: {
  contact_email?: string | null;
  profile?: { email?: string | null } | null;
}): string | null {
  const candidate = teacher.profile?.email ?? teacher.contact_email ?? null;
  if (!candidate) return null;
  const email = candidate.trim().toLowerCase();
  // Cheap shape check only. Google is the real validator; this exists so one
  // fat-fingered admin entry cannot 400 the entire event insert and leave the
  // session with no Meet link at all.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/**
 * Attendee list for a session: the student(s) plus the teacher, de-duplicated.
 *
 * The teacher used to be absent from every event, appearing only as text in the
 * summary, so sessions never reached their own calendar. Inviting them works
 * even on a personal @gmail.com address, which writing to their calendar does
 * not.
 */
export function sessionAttendees(
  studentEmails: (string | null | undefined)[],
  teacherEmail: string | null,
): string[] {
  const all = [...studentEmails, teacherEmail]
    .filter((e): e is string => typeof e === "string" && e.trim() !== "")
    .map((e) => e.trim().toLowerCase());
  return [...new Set(all)];
}
