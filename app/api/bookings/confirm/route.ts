import { NextResponse } from "next/server";
import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { provisionSessionMeet } from "@/lib/google/provisionMeet";
import { sendBookingConfirmation } from "@/lib/email";
import { trackServer } from "@/lib/analytics/server";
import { canTransactFromTimezone, OUTSIDE_AUSTRALIA_ERROR } from "@/lib/geo/australia";

// Reaches lib/google/calendar.ts (Vercel OIDC / @vercel/oidc) via
// provisionSessionMeet — that dependency is Node-runtime only.
export const runtime = "nodejs";

const schema = z.object({
  teacherId: z.string().uuid(),
  startAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(15).max(180).default(60),
  isFreeTrial: z.boolean().default(true),
  // The booker's live browser timezone (IANA id), for the Australia-only
  // free-trial gate below.
  clientTimezone: z.string().trim().min(1).max(64),
});

// Postgres day_of_week is 0=Sun..6=Sat; date-fns "i" returns 1=Mon..7=Sun.
function teacherDayOfWeek(startUtc: Date, tz: string): number {
  const iso = Number(formatInTimeZone(startUtc, tz, "i"));
  return iso === 7 ? 0 : iso;
}

// Postgres `time` columns can serialize as "06:00", "06:00:00", or "06:00:00.000".
// Normalize to "HH:mm:ss" so the lexical string comparison below is sound — the
// client slot picker pads identically (TeacherSlotPicker.padHms).
function padHms(hms: string): string {
  const [h = "00", m = "00", s = "00"] = hms.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.slice(0, 2).padStart(2, "0")}`;
}

type AvailabilityWindow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
};

function slotInsideAvailability(
  start: Date,
  end: Date,
  durationMinutes: number,
  tz: string,
  windows: AvailabilityWindow[],
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
      // The requested duration must match the window's slot granularity — a
      // client can't book a longer-than-offered slot that merely fits the end.
      durationMinutes === (w.slot_duration_minutes || 60) &&
      startHms >= padHms(w.start_time) &&
      endHms <= padHms(w.end_time),
  );
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  // Load the booker's timezone (confirmation email) and role (trial gate below).
  const { data: bookerProfile } = await supabase
    .from("profiles")
    .select("timezone, role")
    .eq("id", user.id)
    .maybeSingle();

  // Australia-only free-trial gate. Non-admin customers must be in an Australian
  // timezone to claim the free 1:1; admins may book from anywhere. Paid bookings
  // (spending already-purchased credits) are intentionally not gated here.
  if (
    parsed.data.isFreeTrial &&
    !canTransactFromTimezone({
      isAdmin: bookerProfile?.role === "admin",
      timezone: parsed.data.clientTimezone,
    })
  ) {
    return NextResponse.json({ error: OUTSIDE_AUSTRALIA_ERROR }, { status: 403 });
  }

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
    .select("day_of_week, start_time, end_time, slot_duration_minutes")
    .eq("teacher_id", teacher.id);
  if (!availability || availability.length === 0) {
    return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
  }
  if (!slotInsideAvailability(start, end, parsed.data.durationMinutes, teacherTz, availability)) {
    return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
  }

  // Honor one-off date overrides: a blocked date is never bookable, even when it
  // matches the recurring weekly availability above.
  const teacherDate = formatInTimeZone(start, teacherTz, "yyyy-MM-dd");
  const { data: overrides } = await svc
    .from("teacher_slot_overrides")
    .select("is_blocked")
    .eq("teacher_id", teacher.id)
    .eq("date", teacherDate);
  if (overrides?.some((o) => o.is_blocked)) {
    return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
  }

  // Atomic booking: spend a credit (paid only) + insert the session + insert the
  // booking + link the credit ledger, all in ONE transaction (book_session RPC).
  //  - The `sessions_no_overlap` EXCLUDE constraint (23P01) makes double-booking
  //    impossible — no SELECT-then-INSERT TOCTOU window.
  //  - `bookings_one_free_trial_per_customer` (23505) blocks a duplicate trial.
  //  - If any step fails, the credit spend rolls back too — no orphaned debit.
  const { data: booked, error: bookErr } = await svc
    .rpc("book_session", {
      p_customer: user.id,
      p_teacher: teacher.id,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
      p_is_free_trial: parsed.data.isFreeTrial,
    })
    .single();
  if (bookErr || !booked) {
    const code = (bookErr as { code?: string } | null)?.code;
    const message = (bookErr as { message?: string } | null)?.message ?? "";
    if (code === "23P01") {
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    }
    if (code === "23505") {
      return NextResponse.json({ error: "trial_already_claimed" }, { status: 409 });
    }
    if (message.includes("insufficient_credits")) {
      return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
    }
    console.error("[bookings/confirm] book_session failed:", bookErr?.message);
    return NextResponse.json({ error: "booking_failed" }, { status: 500 });
  }
  const session = { id: booked.session_id };
  const booking = { id: booked.booking_id };

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
