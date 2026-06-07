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

  // Sessions that ended more than GRACE_PERIOD_MS ago and are not cancelled.
  const cutoff = new Date(Date.now() - GRACE_PERIOD_MS).toISOString();

  // Find overdue sessions in a single query, then batch-update the bookings.
  // We use a join via select so this stays within the svc (service-role) client.
  const { data: eligibleSessions, error: sessionErr } = await svc
    .from("sessions")
    .select("id")
    .lt("end_at", cutoff)
    .neq("status", "cancelled")
    .limit(BATCH_SIZE);

  if (sessionErr) {
    return Response.json({ ok: false, error: sessionErr.message }, { status: 500 });
  }

  if (!eligibleSessions || eligibleSessions.length === 0) {
    return Response.json({ ok: true, processed: 0 });
  }

  const sessionIds = eligibleSessions.map((s) => s.id);

  // Update only bookings that are still 'confirmed' — leave attended/cancelled/no_show alone.
  const { data: updated, error: updateErr } = await svc
    .from("bookings")
    .update({ status: "no_show" })
    .in("session_id", sessionIds)
    .eq("status", "confirmed")
    .select("id");

  if (updateErr) {
    return Response.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  return Response.json({ ok: true, processed: updated?.length ?? 0 });
}
