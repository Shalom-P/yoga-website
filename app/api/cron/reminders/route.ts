import "server-only";

import { assertCron } from "@/lib/cron/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendBookingReminder } from "@/lib/email";
import { DEFAULT_CUSTOMER_TZ } from "@/lib/timezone";

// ---------------------------------------------------------------------------
// Duplicate-send safety
// ---------------------------------------------------------------------------
// Idempotent at the DB level (migration 0016): each window claims a booking with
// a conditional UPDATE (set reminded_at_24h / reminded_at_1h WHERE it IS NULL)
// before sending. The claim is atomic, so overlapping ±10-min bands between
// consecutive 15-min runs — or a re-fire of the same band after a restart — send
// at most once. At-most-once by design: if the email throws after the claim,
// that single reminder is skipped (and logged), which beats duplicates.

/** Half-width of the reminder time window in milliseconds. */
const WINDOW_MS = 10 * 60 * 1000; // ±10 minutes

// The Database type carries empty Relationships, so embedded selects resolve to
// an error type at compile time (they work fine at runtime). Cast to this shape.
type SessionLite = {
  start_at: string;
  end_at: string;
  meet_link: string | null;
  status: string;
  teacher_id: string;
};
type ReminderBooking = {
  id: string;
  customer_id: string;
  session_id: string;
  sessions: SessionLite | SessionLite[] | null;
};

/**
 * POST /api/cron/reminders
 *
 * Sends session reminder emails to customers whose bookings start in ~24 h or
 * ~1 h. Each invocation handles both windows in a single pass so a single
 * schedule (e.g. every 15 min) covers both.
 *
 * Schedule: run every 15 minutes. Each window is ±10 min wide so a 15-min
 * cadence guarantees every session is caught by exactly one pass per window
 * (with a small overlap buffer).
 */
export async function POST(req: Request): Promise<Response> {
  const authError = assertCron(req);
  if (authError) return authError;

  const svc = createSupabaseServiceClient();
  const now = Date.now();

  // Define the two reminder windows.
  const windows: Array<{ label: "24 hours" | "1 hour"; center: number }> = [
    { label: "24 hours", center: now + 24 * 60 * 60 * 1000 },
    { label: "1 hour",   center: now +  1 * 60 * 60 * 1000 },
  ];

  let processed = 0;

  for (const window of windows) {
    const lo = new Date(window.center - WINDOW_MS).toISOString();
    const hi = new Date(window.center + WINDOW_MS).toISOString();

    // Find confirmed, non-cancelled bookings for sessions starting in the band.
    // Service-role so we can join sessions (bypasses RLS).
    const { data: bookings, error: bookingsErr } = await svc
      .from("bookings")
      .select(
        "id, customer_id, session_id, " +
        "sessions!inner(start_at, end_at, meet_link, status, teacher_id)"
      )
      .eq("status", "confirmed")
      .filter("sessions.status", "neq", "cancelled")
      .gte("sessions.start_at", lo)
      .lte("sessions.start_at", hi);

    if (bookingsErr) {
      // Log but continue to the next window; don't abort the whole run.
      console.error(`[cron/reminders] bookings query error (${window.label}):`, bookingsErr.message);
      continue;
    }

    const list = (bookings ?? []) as unknown as ReminderBooking[];
    if (list.length === 0) continue;

    for (const booking of list) {
      // Narrow the join result — Supabase returns the related row as an object
      // or array depending on the relationship; sessions!inner returns a single object.
      const session = Array.isArray(booking.sessions)
        ? booking.sessions[0]
        : booking.sessions;
      if (!session) continue;

      // Idempotency claim: stamp this (booking, window) before any send work.
      // The conditional UPDATE (... WHERE stamp IS NULL) is atomic, so an
      // overlapping band or a re-fire can't double-send. Skips if already sent.
      const nowIso = new Date().toISOString();
      const claimQuery =
        window.label === "24 hours"
          ? svc.from("bookings").update({ reminded_at_24h: nowIso }).is("reminded_at_24h", null)
          : svc.from("bookings").update({ reminded_at_1h: nowIso }).is("reminded_at_1h", null);
      const { data: claimed, error: claimErr } = await claimQuery
        .eq("id", booking.id)
        .select("id")
        .maybeSingle();
      if (claimErr) {
        // Idempotency unavailable (e.g. migration 0016 not yet applied) — fall
        // back to a best-effort send rather than silently dropping the reminder.
        console.error(`[cron/reminders] claim failed for booking ${booking.id}:`, claimErr.message);
      } else if (!claimed) {
        continue; // already reminded for this window
      }

      // Fetch customer profile for email + timezone.
      const { data: profile } = await svc
        .from("profiles")
        .select("email, timezone")
        .eq("id", booking.customer_id)
        .maybeSingle();

      if (!profile?.email) continue;

      // Fetch teacher name.
      const { data: teacher } = await svc
        .from("teachers")
        .select("display_name")
        .eq("id", session.teacher_id)
        .maybeSingle();

      try {
        await sendBookingReminder({
          to: profile.email,
          teacherName: teacher?.display_name ?? "your teacher",
          startUtc: session.start_at,
          customerTz: profile.timezone ?? DEFAULT_CUSTOMER_TZ,
          meetLink: session.meet_link ?? null,
          when: window.label,
        });
        processed++;
      } catch (err) {
        // Fire-and-forget errors are logged but never surface to the caller.
        console.error(`[cron/reminders] sendBookingReminder failed for booking ${booking.id}:`, err);
      }
    }
  }

  return Response.json({ ok: true, processed });
}
