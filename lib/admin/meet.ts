// Meet handling for the admin override surface: what has to happen to a Google
// Calendar event when an admin moves a class, empties it, or cancels it.
//
// Server-only AND Node-runtime only, because everything here eventually reaches
// lib/google/calendar.ts (@vercel/oidc is not Edge-safe). Any route importing
// this must declare `export const runtime = "nodejs"`.

import "server-only";

import { deleteMeetEvent } from "@/lib/google/calendar";
import { provisionSessionMeet } from "@/lib/google/provisionMeet";
import type { createSupabaseServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

/** How many parked events one drain pass will try to delete. */
const ORPHAN_DRAIN_LIMIT = 25;

/**
 * Re-issue a session's Meet link after its time or teacher changed.
 *
 * The caller (admin_update_session) has ALREADY, inside its transaction, parked
 * the old event in meet_orphan_events and set meet_status='pending' with the
 * meet_* columns cleared. This function drains the parked event and provisions
 * a fresh one.
 *
 * `recover` is FALSE and must stay false: findMeetEventBySession matches on
 * extendedProperties.private.sessionId (lib/google/calendar.ts), which is keyed
 * on the SESSION and not on the time, so recover:true would re-adopt the stale
 * event at the OLD time and write its link back as if nothing had moved.
 *
 * Returns the new link, or null. provisionSessionMeet never throws: on failure
 * it marks meet_status='failed' and cron/meet-retry retries within 15 to 30 min,
 * so a Google outage delays the link rather than failing the reschedule.
 */
export async function reissueSessionMeet(
  svc: ServiceClient,
  sessionId: string,
  teacher: { display_name: string; google_calendar_id: string | null },
): Promise<string | null> {
  // Delete the old event first. Doing it before the create keeps at most one
  // event per session visible on the teacher's calendar at any moment; if this
  // fails, the row stays parked and cron/meet-retry finishes the job.
  await drainMeetOrphans(svc, sessionId);

  const { data: session } = await svc
    .from("sessions")
    .select("id, start_at, end_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return null;

  const attendeeEmails = await attendeeEmailsForSession(svc, sessionId);

  return provisionSessionMeet(
    svc,
    { id: session.id, start_at: session.start_at, end_at: session.end_at },
    {
      summary: `Yoga with ${teacher.display_name}`,
      attendeeEmails,
      calendarId: teacher.google_calendar_id,
      recover: false,
    },
  );
}

/**
 * Delete every un-deleted meet_orphan_events row (optionally only this
 * session's) from Google and stamp deleted_at. Best effort: a row left behind
 * keeps its attempts count and is swept again by cron/meet-retry, which is why
 * the table exists at all. Returns how many events were actually deleted.
 */
export async function drainMeetOrphans(
  svc: ServiceClient,
  sessionId?: string,
  limit: number = ORPHAN_DRAIN_LIMIT,
): Promise<number> {
  let query = svc
    .from("meet_orphan_events")
    .select("id, event_id, calendar_id, attempts")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (sessionId) query = query.eq("session_id", sessionId);

  const { data: orphans } = await query;
  if (!orphans || orphans.length === 0) return 0;

  let deleted = 0;
  for (const orphan of orphans) {
    try {
      // deleteMeetEvent treats 410 (already gone) as success and only warns on
      // anything else, so a failure here surfaces as a thrown auth/network error.
      await deleteMeetEvent(orphan.event_id, orphan.calendar_id ?? undefined);
      await svc
        .from("meet_orphan_events")
        .update({ deleted_at: new Date().toISOString(), attempts: orphan.attempts + 1 })
        .eq("id", orphan.id)
        .is("deleted_at", null);
      deleted++;
    } catch (err) {
      console.error(`[admin/meet] orphan ${orphan.event_id} delete failed:`, err);
      await svc
        .from("meet_orphan_events")
        .update({ attempts: orphan.attempts + 1 })
        .eq("id", orphan.id);
    }
  }
  return deleted;
}

/**
 * Mark a session's event for teardown (meet_status='release_pending'), guarded
 * on the current value so a concurrent writer is not clobbered. This is the
 * same marker the Deno cancel-booking function writes (0038), so the reverse
 * cron sweep is the backstop when an inline delete fails.
 *
 * Returns true when this call set the marker.
 */
export async function markMeetForRelease(
  svc: ServiceClient,
  sessionId: string,
): Promise<boolean> {
  const { data } = await svc
    .from("sessions")
    .update({ meet_status: "release_pending" })
    .eq("id", sessionId)
    .not("meet_event_id", "is", null)
    // `.is.null` OR `.neq`, never `.neq` alone: `meet_status <> 'release_pending'`
    // is UNKNOWN (not TRUE) for a NULL row, so a session carrying an event id
    // with a NULL status (rows that predate 0007's meet_status column) would
    // silently fail to be marked and its event would never be torn down.
    .or("meet_status.is.null,meet_status.neq.release_pending")
    .select("id");
  return (data?.length ?? 0) > 0;
}

/**
 * Clear a released session to meet_status NULL, guarded on 'release_pending'.
 * NULL, never 'failed': 'failed' would make the forward sweep immediately
 * provision a fresh link for a class nobody is attending, forever.
 */
export async function clearReleasedMeet(
  svc: ServiceClient,
  sessionId: string,
): Promise<void> {
  await svc
    .from("sessions")
    .update({ meet_link: null, meet_event_id: null, meet_calendar_id: null, meet_status: null })
    .eq("id", sessionId)
    .eq("meet_status", "release_pending");
}

/**
 * The confirmed attendees' emails for a session, for a Calendar invite. Uses the
 * service client because it reads profiles, which is self/admin-only under RLS.
 * Mirrors the collection in cron/meet-retry.
 */
export async function attendeeEmailsForSession(
  svc: ServiceClient,
  sessionId: string,
): Promise<string[]> {
  const { data: bookings } = await svc
    .from("bookings")
    .select("customer_id")
    .eq("session_id", sessionId)
    .eq("status", "confirmed");
  if (!bookings || bookings.length === 0) return [];

  const { data: profiles } = await svc
    .from("profiles")
    .select("email")
    .in(
      "id",
      bookings.map((b) => b.customer_id),
    );
  if (!profiles) return [];

  return profiles
    .map((p) => p.email)
    .filter((email): email is string => Boolean(email));
}
