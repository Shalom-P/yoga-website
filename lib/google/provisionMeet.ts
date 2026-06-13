// Single, idempotent entry point for attaching/removing a Google Meet link on a
// session. Every write path (booking confirm, admin session create, meet-retry
// cron, on-demand create-link) routes through here so the per-teacher-calendar
// and idempotency logic lives in exactly one place. Server-only.

import "server-only";

import * as Sentry from "@sentry/nextjs";
import {
  createMeetEvent,
  deleteMeetEvent,
  findMeetEventBySession,
} from "@/lib/google/calendar";
import type { createSupabaseServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

// Minimal session shape needed to provision a Meet link.
type ProvisionSession = {
  id: string;
  start_at: string;
  end_at: string;
};

type ProvisionOptions = {
  summary: string;
  attendeeEmails?: string[];
  // The teacher's own calendar id, when set. Falls back (in the Calendar client)
  // to GOOGLE_SYSTEM_CALENDAR_ID. The resolved value is recorded on the session
  // so cancellation deletes from the right calendar.
  calendarId?: string | null;
  // Look up an existing event for this session before creating (idempotent
  // recovery). Only meaningful for retry paths — on first creation there is
  // never a prior event, so the lookup is pure overhead. Defaults to false.
  recover?: boolean;
};

/**
 * Ensure `session` has a Meet link, hosted on `calendarId` (teacher calendar) or
 * the system calendar. Idempotent: if an event already exists for this session
 * (tagged with its id), it is adopted instead of creating a duplicate — this
 * covers the "Google created the event but the DB write failed" partial-failure
 * window that the previous inline code could double-fire.
 *
 * Persists meet_link / meet_event_id / meet_calendar_id / meet_status='created'
 * with a compare-and-set on meet_event_id IS NULL so a concurrent writer is not
 * clobbered. On any failure, sets meet_status='failed' (the cron sweeper and the
 * manual "Generate link" button will retry). Returns the link, or null on failure.
 */
export async function provisionSessionMeet(
  svc: ServiceClient,
  session: ProvisionSession,
  opts: ProvisionOptions,
): Promise<string | null> {
  const calendarId = opts.calendarId || undefined;
  try {
    // Only retry/recovery paths (cron sweep, manual "Get link") look up an
    // existing event — on first creation there is never one, so the lookup would
    // be a guaranteed-empty Google round-trip on the booking hot path.
    const existing = opts.recover
      ? await findMeetEventBySession(session.id, calendarId)
      : null;
    const result =
      existing ??
      (await createMeetEvent({
        summary: opts.summary,
        startUtc: session.start_at,
        endUtc: session.end_at,
        attendeeEmails: opts.attendeeEmails,
        calendarId,
        sessionId: session.id,
      }));

    await svc
      .from("sessions")
      .update({
        meet_link: result.meetLink,
        meet_event_id: result.eventId,
        meet_calendar_id: calendarId ?? null,
        meet_status: "created",
      })
      .eq("id", session.id)
      // Compare-and-set on status, NOT on meet_event_id IS NULL: a recover/retry
      // run may have a stale meet_event_id from an attempt that set it then
      // failed — gating on null would match zero rows and wedge the session in
      // 'pending'/'failed' forever. Gating on "not already created" both adopts
      // the recovered event and still refuses to clobber a concurrent winner.
      .neq("meet_status", "created");

    return result.meetLink;
  } catch (err) {
    // Surface the cause (bad/unshared teacher calendar, Google quota, etc.) —
    // otherwise this is an invisible 'failed' with no diagnostics. Then leave
    // the 'failed' marker for the retry sweep / manual button.
    console.error(`[provisionMeet] session ${session.id} failed:`, err);
    Sentry.captureException(err, {
      tags: { module: "provisionMeet" },
      extra: { sessionId: session.id },
    });
    await svc
      .from("sessions")
      .update({ meet_status: "failed" })
      .eq("id", session.id);
    return null;
  }
}

/**
 * Best-effort removal of a session's Meet event from the calendar it actually
 * lives on (meet_calendar_id). Never throws. Legacy rows have a null
 * meet_calendar_id and were created on the system calendar, which is the delete
 * default — so they remain correct.
 */
export async function releaseSessionMeet(
  session: { meet_event_id: string | null; meet_calendar_id: string | null },
): Promise<void> {
  if (!session.meet_event_id) return;
  await deleteMeetEvent(session.meet_event_id, session.meet_calendar_id ?? undefined).catch(
    () => {},
  );
}
