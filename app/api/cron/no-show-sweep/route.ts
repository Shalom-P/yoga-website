import "server-only";

import { assertCron } from "@/lib/cron/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Grace period after session end before a booking can be marked no_show.
 * 2 hours gives teachers time to manually mark attendance and avoids
 * incorrectly flagging sessions that ran long.
 */
const GRACE_PERIOD_MS = 2 * 60 * 60 * 1000;

// Maximum bookings updated per invocation — prevents runaway updates on the
// first run if there is a large backlog.
const BATCH_SIZE = 200;

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

  // Select the bookings to flip directly (not the sessions): this way an
  // already-swept session whose bookings are all non-confirmed doesn't consume a
  // slot in the BATCH_SIZE cap, so a backlog always makes forward progress.
  // Ordered oldest-first for a deterministic, fair selection.
  const { data: dueBookings, error: queryErr } = await svc
    .from("bookings")
    .select("id, sessions!inner(end_at, status)")
    .eq("status", "confirmed")
    .lt("sessions.end_at", cutoff)
    .neq("sessions.status", "cancelled")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (queryErr) {
    return Response.json({ ok: false, error: queryErr.message }, { status: 500 });
  }

  if (!dueBookings || dueBookings.length === 0) {
    return Response.json({ ok: true, processed: 0 });
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

  return Response.json({ ok: true, processed: updated?.length ?? 0 });
}
