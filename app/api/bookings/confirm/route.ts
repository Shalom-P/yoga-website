import { NextResponse } from "next/server";
import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { provisionSessionMeet } from "@/lib/google/provisionMeet";
import { sendBookingConfirmation } from "@/lib/email";
import { trackServer } from "@/lib/analytics/server";

const schema = z.object({
  teacherId: z.string().uuid(),
  startAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(15).max(180).default(60),
  isFreeTrial: z.boolean().default(true),
});

// Postgres day_of_week is 0=Sun..6=Sat; date-fns "i" returns 1=Mon..7=Sun.
function teacherDayOfWeek(startUtc: Date, tz: string): number {
  const iso = Number(formatInTimeZone(startUtc, tz, "i"));
  return iso === 7 ? 0 : iso;
}

function slotInsideAvailability(
  start: Date,
  end: Date,
  tz: string,
  windows: { day_of_week: number; start_time: string; end_time: string }[],
): boolean {
  const dow = teacherDayOfWeek(start, tz);
  const endDow = teacherDayOfWeek(end, tz);
  // Reject slots that cross midnight in the teacher TZ for v1.
  if (dow !== endDow) return false;
  const startHms = formatInTimeZone(start, tz, "HH:mm:ss");
  const endHms = formatInTimeZone(end, tz, "HH:mm:ss");
  return windows.some(
    (w) =>
      w.day_of_week === dow &&
      startHms >= w.start_time &&
      endHms <= w.end_time,
  );
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  // Load the booker's timezone for the confirmation email below.
  const { data: bookerProfile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();

  // Paid (non-trial) sessions spend one session-credit, reserved after the slot
  // is confirmed available (see below). The free 1:1 trial never spends credits.

  const start = new Date(parsed.data.startAt);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  // At least 15 minutes in the future.
  if (start.getTime() < Date.now() + 15 * 60_000) {
    return NextResponse.json({ error: "slot_in_past" }, { status: 400 });
  }
  const end = new Date(start.getTime() + parsed.data.durationMinutes * 60_000);

  // Service-role for sessions/bookings writes (sessions has admin-only INSERT RLS).
  const svc = createSupabaseServiceClient();

  const { data: teacher } = await svc
    .from("teachers")
    .select("id, display_name, timezone, is_active, google_calendar_id")
    .eq("id", parsed.data.teacherId)
    .single();
  if (!teacher || !teacher.is_active) {
    return NextResponse.json({ error: "teacher_not_found" }, { status: 404 });
  }

  const teacherTz = teacher.timezone || "Asia/Kolkata";

  const { data: availability } = await svc
    .from("teacher_availability")
    .select("day_of_week, start_time, end_time")
    .eq("teacher_id", teacher.id);
  if (!availability || availability.length === 0) {
    return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
  }
  if (!slotInsideAvailability(start, end, teacherTz, availability)) {
    return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
  }

  // Reject double-booking on the teacher's calendar.
  const { data: overlap } = await svc
    .from("sessions")
    .select("id")
    .eq("teacher_id", teacher.id)
    .neq("status", "cancelled")
    .lt("start_at", end.toISOString())
    .gt("end_at", start.toISOString())
    .limit(1);
  if (overlap && overlap.length > 0) {
    return NextResponse.json({ error: "slot_taken" }, { status: 409 });
  }

  // Paid booking: reserve one session-credit now that the slot is free. Atomic
  // (UPDATE ... WHERE balance > 0), so two concurrent bookings can't both spend
  // the last credit. Refunded below if the session/booking insert fails.
  if (!parsed.data.isFreeTrial) {
    const { data: spent, error: spendErr } = await svc.rpc("spend_session_credit", {
      p_customer: user.id,
    });
    if (spendErr) {
      return NextResponse.json({ error: "credit_error" }, { status: 500 });
    }
    if (!spent) {
      return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
    }
  }

  // Create the session — meet_status='pending' marks it for a Meet-link retry sweep
  // if the Google call below fails.
  const { data: session, error: sessionErr } = await svc
    .from("sessions")
    .insert({
      teacher_id: teacher.id,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      capacity: 1,
      status: "scheduled",
      is_free_trial: parsed.data.isFreeTrial,
      meet_status: "pending",
    })
    .select("id")
    .single();
  if (sessionErr || !session) {
    if (!parsed.data.isFreeTrial) {
      await svc.rpc("grant_session_credits", { p_customer: user.id, p_delta: 1, p_reason: "refund" });
    }
    return NextResponse.json({ error: "session_create_failed" }, { status: 500 });
  }

  // Create booking. The partial unique index `bookings_one_free_trial_per_customer`
  // makes a duplicate trial claim raise 23505.
  const { data: booking, error: bookingErr } = await svc
    .from("bookings")
    .insert({
      session_id: session.id,
      customer_id: user.id,
      is_free_trial: parsed.data.isFreeTrial,
      status: "confirmed",
    })
    .select("id")
    .single();
  if (bookingErr || !booking) {
    // Roll back the session so the slot isn't orphaned, and refund the credit.
    await svc.from("sessions").delete().eq("id", session.id);
    if (!parsed.data.isFreeTrial) {
      await svc.rpc("grant_session_credits", { p_customer: user.id, p_delta: 1, p_reason: "refund" });
    }
    const code = (bookingErr as { code?: string } | null)?.code;
    if (code === "23505") {
      return NextResponse.json({ error: "trial_already_claimed" }, { status: 409 });
    }
    return NextResponse.json({ error: bookingErr?.message ?? "booking_failed" }, { status: 500 });
  }

  // Awaited Meet provisioning. On failure we keep the booking; meet_status is set
  // to 'failed' so the cron sweeper / manual "Generate link" button can retry,
  // and the dashboard shows a "Link soon" state. Hosted on the teacher's own
  // calendar when they have one, else the system calendar.
  const meetLink = await provisionSessionMeet(
    svc,
    { id: session.id, start_at: start.toISOString(), end_at: end.toISOString() },
    {
      summary: `Yoga with ${teacher.display_name}`,
      attendeeEmails: user.email ? [user.email] : [],
      calendarId: teacher.google_calendar_id,
    },
  );

  // Fire-and-forget confirmation email. No-ops if Resend isn't configured and
  // never throws, so it can't break a committed booking.
  if (user.email) {
    // Awaited (not fire-and-forget): in serverless, work started after the
    // response may not run. The helper never throws, so this can't break the
    // committed booking. ~one HTTP call; no-ops instantly without Resend.
    await sendBookingConfirmation({
      to: user.email,
      teacherName: teacher.display_name,
      startUtc: start.toISOString(),
      customerTz: bookerProfile?.timezone ?? "Australia/Sydney",
      meetLink,
    });
  }

  void trackServer(user.id, parsed.data.isFreeTrial ? "trial_booked" : "session_booked", {
    teacher_id: teacher.id,
    session_id: session.id,
  });

  return NextResponse.json({ bookingId: booking.id, sessionId: session.id });
}
