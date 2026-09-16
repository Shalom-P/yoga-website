import "server-only";

import { assertCron } from "@/lib/cron/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { deleteMeetEvent } from "@/lib/google/calendar";
import { provisionSessionMeet, releaseSessionMeet } from "@/lib/google/provisionMeet";

// provisionSessionMeet -> lib/google/calendar.ts uses @vercel/oidc (Node only).
export const runtime = "nodejs";

// Maximum number of sessions to process per cron invocation.
// Keeps each run short and avoids Google Calendar rate-limit bursts.
const BATCH_SIZE = 50;

/**
 * POST /api/cron/meet-retry
 *
 * Sweeps sessions where meet_status is 'pending' or 'failed' and the session
 * hasn't started yet (i.e. there is still time to send a useful Meet link).
 * For each, attempts to create a Google Calendar event with a Meet link.
 *
 * On success  → meet_link, meet_event_id, meet_status='created' are written.
 * On failure  → meet_status stays 'failed'; the next run will retry.
 *
 * The booked customer's email is added as a Calendar attendee so they receive
 * a Google Calendar invite (same behaviour as the booking confirm handler).
 *
 * Two teardown sweeps run alongside it: sweepReleases() for sessions marked
 * 'release_pending', and sweepOrphans() for events parked by a reschedule.
 *
 * ORDER MATTERS: sweepOrphans() runs BEFORE the forward pass, not after. A
 * reschedule parks the OLD event in meet_orphan_events and puts the session back
 * to 'pending', and the forward pass provisions with recover:true, whose lookup
 * (findMeetEventBySession) matches on the session id with NO time check. Run the
 * other way round, the forward pass adopts the parked event and writes
 * meet_status='created' with its link, and then the orphan sweep deletes that
 * very event in the same request — leaving a dead join link that nothing
 * revisits, because the forward pass only selects 'pending'/'failed'.
 *
 * Schedule: run every ~15–30 minutes so the customer receives their link well
 * before the session start.
 */
export async function POST(req: Request): Promise<Response> {
  const authError = assertCron(req);
  if (authError) return authError;

  const svc = createSupabaseServiceClient();

  // Teardown first, for the reason in the docblock above.
  const { orphansDeleted, orphansRemaining } = await sweepOrphans(svc);

  // Sessions that need a Meet link and haven't started yet, bounded by BATCH_SIZE.
  const { data: sessions, error: sessionsErr } = await svc
    .from("sessions")
    .select("id, teacher_id, start_at, end_at, meet_status")
    .in("meet_status", ["pending", "failed"])
    .gt("start_at", new Date().toISOString())
    .neq("status", "cancelled")
    .order("start_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (sessionsErr) {
    return Response.json({ ok: false, error: sessionsErr.message }, { status: 500 });
  }

  // No early return when this set is empty. The sweeps sharing this run are
  // separate jobs, and "nothing needs a link right now" is the normal state, so
  // returning here would have left teardown work undone on almost every
  // invocation.
  let processed = 0;
  let skippedParked = 0;

  // Belt and braces for the adopt-then-delete cycle the docblock describes. The
  // sweep above is bounded and best effort, so a parked event whose delete just
  // failed (Google outage, rate limit) is still live on the calendar and still
  // adoptable by recover:true. Leave those sessions for a later run, once the
  // old event is actually gone.
  const parkedSessionIds = await sessionIdsWithLiveOrphans(
    svc,
    (sessions ?? []).map((s) => s.id),
  );

  for (const session of sessions ?? []) {
    if (parkedSessionIds.has(session.id)) {
      skippedParked++;
      continue;
    }

    // Look up the teacher for the calendar event summary + their own calendar.
    const { data: teacher } = await svc
      .from("teachers")
      .select("display_name, google_calendar_id")
      .eq("id", session.teacher_id)
      .maybeSingle();

    // Find all confirmed bookings for this session to collect attendee emails.
    const { data: bookings } = await svc
      .from("bookings")
      .select("customer_id")
      .eq("session_id", session.id)
      .eq("status", "confirmed");

    const attendeeEmails: string[] = [];
    if (bookings && bookings.length > 0) {
      const customerIds = bookings.map((b) => b.customer_id);
      const { data: profiles } = await svc
        .from("profiles")
        .select("email")
        .in("id", customerIds);
      if (profiles) {
        for (const p of profiles) {
          if (p.email) attendeeEmails.push(p.email);
        }
      }
    }

    // Idempotent: adopts an existing event for this session if one is already on
    // the calendar, else creates one. On failure, meet_status stays 'failed' so
    // the next run picks it up again.
    const meetLink = await provisionSessionMeet(
      svc,
      { id: session.id, start_at: session.start_at, end_at: session.end_at },
      {
        summary: `Yoga${teacher?.display_name ? ` with ${teacher.display_name}` : ""}`,
        attendeeEmails,
        calendarId: teacher?.google_calendar_id,
        // Retry path: adopt this session's own earlier event instead of minting
        // a duplicate. Safe here because any event parked by a reschedule has
        // either been deleted above or excluded this session from the loop.
        recover: true,
      },
    );
    if (meetLink) processed++;
  }

  const released = await sweepReleases(svc);

  return Response.json({
    ok: true,
    processed,
    skippedParked,
    released,
    orphansDeleted,
    orphansRemaining,
  });
}

/**
 * Which of these sessions still has an un-deleted meet_orphan_events row, i.e. a
 * pre-reschedule event that is still live on the calendar and would be adopted
 * by a recover:true provision.
 */
async function sessionIdsWithLiveOrphans(
  svc: ReturnType<typeof createSupabaseServiceClient>,
  sessionIds: string[],
): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set();
  const { data } = await svc
    .from("meet_orphan_events")
    .select("session_id")
    .is("deleted_at", null)
    .in("session_id", sessionIds);
  return new Set(
    (data ?? [])
      .map((row) => row.session_id)
      .filter((id): id is string => Boolean(id)),
  );
}

/**
 * The other direction: tear down Meet events whose bookings were all cancelled.
 *
 * `/api/bookings/cancel` deletes the event inline, because it runs on Node and
 * has the Google credentials. The `cancel-booking` Edge Function, which is what
 * the native iOS client calls, does not and cannot — Vercel OIDC is not
 * mintable from Deno — so it marks the session `meet_status='release_pending'`
 * (migration 0038) and leaves the deletion here.
 *
 * Without this, a customer cancelling from the app would leave the teacher a
 * dead hour on their calendar and keep a live join link to a class that is not
 * happening.
 *
 * The set is normally empty and is indexed (`sessions_meet_release_idx`).
 */
async function sweepReleases(
  svc: ReturnType<typeof createSupabaseServiceClient>,
): Promise<number> {
  const { data: sessions } = await svc
    .from("sessions")
    .select("id, meet_event_id, meet_calendar_id")
    .eq("meet_status", "release_pending")
    .limit(BATCH_SIZE);

  if (!sessions || sessions.length === 0) return 0;

  let released = 0;
  for (const session of sessions) {
    // Swallows its own errors, so a Google outage leaves the row marked and the
    // next run retries rather than losing the intent.
    await releaseSessionMeet(session);

    // The link is gone whether or not Google agreed, so it must stop being
    // shown. Clearing meet_event_id also stops the retry pass above from
    // adopting the deleted event via `recover: true`.
    //
    // meet_status goes to NULL, not 'failed': the retry pass selects
    // .in("meet_status", ["pending","failed"]), so 'failed' would make it
    // immediately provision a fresh link for a session with no attendees, and
    // this sweep would then have nothing to release it again. NULL means "no
    // link, and none wanted", which is exactly the state a session with no live
    // bookings should be in.
    const { error } = await svc
      .from("sessions")
      .update({ meet_status: null, meet_link: null, meet_event_id: null })
      .eq("id", session.id)
      .eq("meet_status", "release_pending"); // idempotent against a concurrent run
    if (!error) released++;
  }

  return released;
}

/**
 * The third direction: Calendar events that outlived the session row pointing at
 * them.
 *
 * When an admin reschedules a class, `admin_update_session` parks the old event
 * in `meet_orphan_events` inside its transaction and clears the session's meet_*
 * columns, because Postgres has no Google credentials and the session row is
 * about to describe a different time. The route normally drains that row
 * immediately; this sweep is what catches the ones it could not, which is any
 * run where Google was down, the request was cut short, or the delete returned
 * an error worth retrying.
 *
 * Without it a student holds a join link to a class at the old time, and the
 * teacher keeps a phantom hour on their calendar.
 */
async function sweepOrphans(
  svc: ReturnType<typeof createSupabaseServiceClient>,
): Promise<{ orphansDeleted: number; orphansRemaining: number }> {
  const { data: orphans } = await svc
    .from("meet_orphan_events")
    .select("id, event_id, calendar_id, attempts")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (!orphans || orphans.length === 0) {
    return { orphansDeleted: 0, orphansRemaining: 0 };
  }

  let orphansDeleted = 0;
  for (const orphan of orphans) {
    try {
      // deleteMeetEvent treats 410 (already gone) as success, so an event some
      // other path already removed still closes its row rather than retrying
      // forever.
      await deleteMeetEvent(orphan.event_id, orphan.calendar_id ?? undefined);
      await svc
        .from("meet_orphan_events")
        .update({ deleted_at: new Date().toISOString(), attempts: orphan.attempts + 1 })
        .eq("id", orphan.id)
        .is("deleted_at", null); // idempotent against a concurrent run
      orphansDeleted++;
    } catch (err) {
      // Count the attempt and leave deleted_at null so the next run tries again.
      console.error(`[cron/meet-retry] orphan ${orphan.event_id} delete failed:`, err);
      await svc
        .from("meet_orphan_events")
        .update({ attempts: orphan.attempts + 1 })
        .eq("id", orphan.id);
    }
  }

  return { orphansDeleted, orphansRemaining: orphans.length - orphansDeleted };
}

/**
 * Vercel Cron issues a **GET**, and these handlers only exported POST, so every
 * scheduled run would have returned 405 and the job would have looked healthy
 * while doing nothing. GET simply delegates.
 *
 * This widens the method, not the access: `assertCron` still requires
 * `Authorization: Bearer <CRON_SECRET>` and fails closed when the secret is
 * unset, so an unauthenticated GET is rejected exactly as an unauthenticated
 * POST is. Vercel injects that header automatically when CRON_SECRET is set as
 * an environment variable.
 */
export async function GET(req: Request): Promise<Response> {
  return POST(req);
}
