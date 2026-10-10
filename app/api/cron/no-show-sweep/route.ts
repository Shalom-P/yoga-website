import "server-only";

import { assertCron } from "@/lib/cron/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendReviewRequest } from "@/lib/email";

/**
 * Grace period after session end before a booking can be marked no_show.
 * 2 hours gives teachers time to manually mark attendance and avoids
 * incorrectly flagging sessions that ran long.
 */
const GRACE_PERIOD_MS = 2 * 60 * 60 * 1000;

// Maximum bookings updated per invocation — prevents runaway updates on the
// first run if there is a large backlog.
const BATCH_SIZE = 200;

// Review requests per run. Each one is an email send, so keep the batch small
// enough that a backlog cannot pin the function past its timeout.
const REVIEW_BATCH_SIZE = 50;

/**
 * POST /api/cron/no-show-sweep
 *
 * Marks bookings as `no_show` when:
 *   - The session ended more than GRACE_PERIOD_MS ago.
 *   - The booking status is still `confirmed` (i.e. not `attended`, `cancelled`,
 *     or already `no_show`).
 *   - The session itself is not cancelled.
 *
 * This relies on the `booking_status` enum value `no_show` defined in
 * 0003_classes_sessions.sql: ('confirmed', 'cancelled', 'attended', 'no_show').
 *
 * Schedule: run hourly. The 2-hour grace window means a booking that ended at
 * 10:00 will be swept at 12:xx at the earliest (the run after the grace period
 * elapses).
 */
export async function POST(req: Request): Promise<Response> {
  const authError = assertCron(req);
  if (authError) return authError;

  const svc = createSupabaseServiceClient();

  // Bookings still 'confirmed' whose session ended more than GRACE_PERIOD_MS ago.
  const cutoff = new Date(Date.now() - GRACE_PERIOD_MS).toISOString();

  // Review requests go out BEFORE the no-show flip below, on the same cutoff:
  // attendance is rarely marked, so a booking that is about to read `no_show`
  // was very likely attended, and the customer is the one person who can say.
  // Best-effort: a failure here never blocks the sweep.
  const reviewRequests = await requestReviews(svc, cutoff);

  // Select the bookings to flip directly (not the sessions): this way an
  // already-swept session whose bookings are all non-confirmed doesn't consume a
  // slot in the BATCH_SIZE cap, so a backlog always makes forward progress.
  // Ordered oldest-first for a deterministic, fair selection. The `!session_id`
  // hint is required: since 0039 bookings has a second key to sessions
  // (moved_from_session_id), and an unhinted embed fails the whole request.
  const { data: dueBookings, error: queryErr } = await svc
    .from("bookings")
    .select("id, sessions!session_id!inner(end_at, status, meet_status)")
    .eq("status", "confirmed")
    .lt("sessions.end_at", cutoff)
    .neq("sessions.status", "cancelled")
    // Only sweep sessions we actually provisioned a Meet link for. If meet_status
    // never reached 'created' (stuck pending/failed), the customer couldn't join
    // through us — don't auto-mark them no_show for our operational failure; leave
    // them for manual ops review instead.
    .eq("sessions.meet_status", "created")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (queryErr) {
    return Response.json({ ok: false, error: queryErr.message }, { status: 500 });
  }

  if (!dueBookings || dueBookings.length === 0) {
    return Response.json({ ok: true, processed: 0, reviewRequests });
  }

  const bookingIds = dueBookings.map((b) => b.id);

  // Re-assert status='confirmed' on the update to avoid racing a concurrent
  // attendance mark between the read and the write.
  const { data: updated, error: updateErr } = await svc
    .from("bookings")
    .update({ status: "no_show" })
    .in("id", bookingIds)
    .eq("status", "confirmed")
    .select("id");

  if (updateErr) {
    return Response.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  return Response.json({ ok: true, processed: updated?.length ?? 0, reviewRequests });
}

/**
 * Emails a review request for every finished, non-cancelled booking that has
 * not been asked yet. At-most-once per booking: `review_requested_at` (0043) is
 * claimed with a conditional UPDATE before the send, exactly like the reminder
 * columns, so overlapping runs cannot double-send. If the email throws after
 * the claim the request is simply lost, which beats asking twice.
 *
 * Only sessions whose Meet link was actually provisioned are asked, for the
 * same reason the no-show flip skips the others: a customer who could not join
 * through us has nothing to review.
 */
async function requestReviews(
  svc: ReturnType<typeof createSupabaseServiceClient>,
  cutoff: string,
): Promise<{ sent: number; skipped: number; error?: string }> {
  const { data: due, error } = await svc
    .from("bookings")
    .select("id, customer_id, sessions!session_id!inner(end_at, status, meet_status, teacher_id)")
    .in("status", ["confirmed", "attended"])
    .is("review_requested_at", null)
    .lt("sessions.end_at", cutoff)
    .neq("sessions.status", "cancelled")
    .eq("sessions.meet_status", "created")
    .order("created_at", { ascending: true })
    .limit(REVIEW_BATCH_SIZE);

  if (error) {
    console.error("[cron/no-show-sweep] review request query failed:", error.message);
    return { sent: 0, skipped: 0, error: error.message };
  }

  let sent = 0;
  let skipped = 0;
  for (const booking of due ?? []) {
    const { data: claimed, error: claimErr } = await svc
      .from("bookings")
      .update({ review_requested_at: new Date().toISOString() })
      .eq("id", booking.id)
      .is("review_requested_at", null)
      .select("id")
      .maybeSingle();
    if (claimErr || !claimed) {
      skipped += 1;
      continue;
    }

    const [{ data: profile }, { data: teacher }] = await Promise.all([
      svc.from("profiles").select("email").eq("id", booking.customer_id).maybeSingle(),
      svc.from("teachers").select("display_name").eq("id", booking.sessions.teacher_id).maybeSingle(),
    ]);
    if (!profile?.email) {
      skipped += 1;
      continue;
    }

    try {
      await sendReviewRequest({
        to: profile.email,
        teacherName: teacher?.display_name ?? "your teacher",
        bookingId: booking.id,
      });
      sent += 1;
    } catch (err) {
      console.error(`[cron/no-show-sweep] review request send failed for ${booking.id}:`, err);
      skipped += 1;
    }
  }
  return { sent, skipped };
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
