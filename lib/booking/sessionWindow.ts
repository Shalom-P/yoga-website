/**
 * Which bucket a booked session sits in for the customer's dashboard.
 *
 * A session is upcoming until it ENDS, not until it starts: 7:01 PM for a
 * 7:00 PM class is exactly when a customer opens the dashboard to join, and
 * keying on the start time dropped a live class into Past, where the row has
 * no Join link. Cancelling stops at the start, matching
 * `/api/bookings/cancel` (`session_started`).
 *
 * Pure and dependency-free so it can be unit-tested. The iOS app applies the
 * same rule (`isUpcoming` in NativeData.swift).
 */

type SessionTimes = { start_at: string; end_at: string };

/** Not yet ended. Includes a class in progress. */
export function isSessionUpcoming(session: SessionTimes, nowMs: number): boolean {
  return new Date(session.end_at).getTime() > nowMs;
}

/** Started and not yet ended. */
export function isSessionInProgress(session: SessionTimes, nowMs: number): boolean {
  return new Date(session.start_at).getTime() <= nowMs && isSessionUpcoming(session, nowMs);
}

/** Still before the start, the only time the cancel route accepts. */
export function isSessionCancellable(session: SessionTimes, nowMs: number): boolean {
  return new Date(session.start_at).getTime() > nowMs;
}
