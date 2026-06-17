import "server-only";

import { assertCron } from "@/lib/cron/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { provisionSessionMeet } from "@/lib/google/provisionMeet";

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
 * Schedule: run every ~15–30 minutes so the customer receives their link well
 * before the session start.
 */
export async function POST(req: Request): Promise<Response> {
  const authError = assertCron(req);
  if (authError) return authError;

  const svc = createSupabaseServiceClient();

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

  if (!sessions || sessions.length === 0) {
    return Response.json({ ok: true, processed: 0 });
  }

  let processed = 0;

  for (const session of sessions) {
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
        recover: true, // retry path: adopt an orphaned event instead of duplicating
      },
    );
    if (meetLink) processed++;
  }

  return Response.json({ ok: true, processed });
}
