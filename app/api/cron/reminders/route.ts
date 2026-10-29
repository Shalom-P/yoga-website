import "server-only";

import { assertCron } from "@/lib/cron/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { hasMedicalDocuments } from "@/lib/medical/documents";
import { sendBookingReminder, sendFirstBookingNudge } from "@/lib/email";
import { notifyUser } from "@/lib/push/notify";
import { DEFAULT_CUSTOMER_TZ } from "@/lib/timezone";
import {
  FIRST_BOOKING_NUDGE_STAGES,
  nudgeSignupWindow,
} from "@/lib/booking/firstBookingNudge";

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
  // Push notifications collected during the email loops, flushed at the end
  // under PUSH_FLUSH_BUDGET_MS so APNs can never starve the email sends.
  const PUSH_FLUSH_BUDGET_MS = 20_000;
  const pushJobs: Array<{ customerId: string; body: string }> = [];

  for (const window of windows) {
    const lo = new Date(window.center - WINDOW_MS).toISOString();
    const hi = new Date(window.center + WINDOW_MS).toISOString();

    // Find confirmed, non-cancelled bookings for sessions starting in the band.
    // Service-role so we can join sessions (bypasses RLS).
    const { data: bookings, error: bookingsErr } = await svc
      .from("bookings")
      .select(
        "id, customer_id, session_id, sessions!session_id!inner(start_at, end_at, meet_link, status, teacher_id)"
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

    const list = bookings ?? [];
    if (list.length === 0) continue;

    for (const booking of list) {
      // `sessions!session_id!inner` resolves to a single related row.
      const session = booking.sessions;
      if (!session) continue;

      // Fetch the customer's email + timezone FIRST. No recipient means nothing
      // to send, so we must not burn the idempotency claim on it — otherwise a
      // reminder added after the email is populated would be permanently
      // suppressed for this window.
      const { data: profile } = await svc
        .from("profiles")
        .select("email, timezone")
        .eq("id", booking.customer_id)
        .maybeSingle();

      if (!profile?.email) continue;

      // Idempotency claim, now that we know there's a recipient. The conditional
      // UPDATE (... WHERE stamp IS NULL) is atomic, so an overlapping band or a
      // re-fire can't double-send. On a claim error (e.g. migration 0016 not
      // applied) SKIP rather than send unguarded — a duplicate storm is worse
      // than a missed reminder.
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
        console.error(
          `[cron/reminders] claim failed for booking ${booking.id}; skipping to avoid duplicates:`,
          claimErr.message,
        );
        continue;
      }
      if (!claimed) continue; // already reminded for this window

      // Fetch teacher name.
      const { data: teacher } = await svc
        .from("teachers")
        .select("display_name")
        .eq("id", session.teacher_id)
        .maybeSingle();

      // On the day-before reminder, nudge customers who haven't uploaded any
      // health documents yet. Skipped for the 1h window (too late to be useful).
      const needsHealthDocs =
        window.label === "24 hours"
          ? !(await hasMedicalDocuments(svc, booking.customer_id))
          : false;

      try {
        await sendBookingReminder({
          to: profile.email,
          teacherName: teacher?.display_name ?? "your teacher",
          startUtc: session.start_at,
          customerTz: profile.timezone ?? DEFAULT_CUSTOMER_TZ,
          meetLink: session.meet_link ?? null,
          when: window.label,
          needsHealthDocs,
        });
        processed++;
      } catch (err) {
        // Fire-and-forget errors are logged but never surface to the caller.
        console.error(`[cron/reminders] sendBookingReminder failed for booking ${booking.id}:`, err);
      }

      // Best-effort native push alongside the email (no-op unless APNs is set
      // up). Deliberately NOT sent inline: a hanging APNs connection between two
      // emails could push the run past the function deadline and abort the
      // remaining reminder emails, which the ±10-min bands would never retry.
      // Collected here, flushed after every email has gone out.
      pushJobs.push({
        customerId: booking.customer_id,
        body: `Your 1:1 with ${teacher?.display_name ?? "your teacher"} starts in ${window.label}.`,
      });
    }
  }

  // Sign-ups who never booked. Runs after the session reminders so a slow
  // batch here can never delay an email about a class that is about to start.
  const firstBookingNudges = await sendFirstBookingNudges(svc);

  // Flush pushes only after ALL emails are sent, bounded by a hard wall-clock
  // budget so APNs latency can never blow the function deadline. Awaited (not
  // fire-and-forget) because serverless runtimes may freeze pending work once
  // the response returns.
  if (pushJobs.length > 0) {
    await Promise.race([
      Promise.allSettled(
        pushJobs.map((j) =>
          notifyUser(j.customerId, { title: "Your yoga session", body: j.body }).catch((err) =>
            console.error(`[cron/reminders] push failed for customer ${j.customerId}:`, err),
          ),
        ),
      ),
      new Promise((resolve) => setTimeout(resolve, PUSH_FLUSH_BUDGET_MS)),
    ]);
  }

  return Response.json({ ok: true, processed, firstBookingNudges });
}

// Nudges per stage per run. Each is an email send, so keep a backlog from
// pinning the function past its timeout; the windows are wide enough that the
// rest go out on the next 15-minute run.
const NUDGE_BATCH_SIZE = 50;

/**
 * Emails customers who finished onboarding but have never booked, ~1h and
 * ~24h after sign-up (windows in lib/booking/firstBookingNudge.ts). At most
 * once per stage: `booking_nudge_1h_at` / `booking_nudge_24h_at` (0048) are
 * claimed with a conditional UPDATE before the send, like the reminder
 * columns above. If the email throws after the claim that nudge is lost,
 * which beats sending it twice.
 *
 * Only complete profiles (name, phone, experience level, the same test as
 * isProfileComplete) are nudged: an incomplete one cannot book until it
 * finishes onboarding, so a "book now" link would only bounce. Any booking
 * row, cancelled ones included, counts as having booked.
 */
async function sendFirstBookingNudges(
  svc: ReturnType<typeof createSupabaseServiceClient>,
): Promise<{ sent: number; error?: string }> {
  const now = new Date();
  let sent = 0;

  for (const { stage } of FIRST_BOOKING_NUDGE_STAGES) {
    const column = stage === "1h" ? "booking_nudge_1h_at" : "booking_nudge_24h_at";
    const { from, to } = nudgeSignupWindow(stage, now);

    const { data: candidates, error } = await svc
      .from("profiles")
      .select("id, email, full_name")
      .eq("role", "customer")
      .is(column, null)
      .gte("created_at", from)
      .lte("created_at", to)
      .not("email", "is", null)
      .not("full_name", "is", null)
      .not("phone", "is", null)
      .not("experience_level", "is", null)
      .order("created_at", { ascending: true })
      .limit(NUDGE_BATCH_SIZE);

    if (error) {
      // Most likely 0048 not applied yet. Skip quietly rather than fail the
      // session reminders that already went out in this run.
      console.error(`[cron/reminders] first-booking nudge query failed (${stage}):`, error.message);
      return { sent, error: error.message };
    }
    if (!candidates || candidates.length === 0) continue;

    const { data: booked, error: bookedErr } = await svc
      .from("bookings")
      .select("customer_id")
      .in("customer_id", candidates.map((c) => c.id));
    if (bookedErr) {
      console.error("[cron/reminders] first-booking nudge bookings lookup failed:", bookedErr.message);
      return { sent, error: bookedErr.message };
    }
    const hasBooked = new Set((booked ?? []).map((b) => b.customer_id));

    for (const customer of candidates) {
      if (hasBooked.has(customer.id) || !customer.email) continue;

      const claimQuery =
        stage === "1h"
          ? svc.from("profiles").update({ booking_nudge_1h_at: new Date().toISOString() }).is("booking_nudge_1h_at", null)
          : svc.from("profiles").update({ booking_nudge_24h_at: new Date().toISOString() }).is("booking_nudge_24h_at", null);
      const { data: claimed, error: claimErr } = await claimQuery
        .eq("id", customer.id)
        .select("id")
        .maybeSingle();
      if (claimErr || !claimed) continue;

      try {
        await sendFirstBookingNudge({ to: customer.email, fullName: customer.full_name, stage });
        sent++;
      } catch (err) {
        console.error(`[cron/reminders] first-booking nudge failed for ${customer.id}:`, err);
      }
    }
  }

  return { sent };
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
