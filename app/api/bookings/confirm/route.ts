import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { teacherInviteEmail, sessionAttendees } from "@/lib/google/teacherInvite";
import { provisionSessionMeet } from "@/lib/google/provisionMeet";
import { sendBookingConfirmation } from "@/lib/email";
import { trackServer } from "@/lib/analytics/server";
import { metaContextFromRequest, queueMetaEvent } from "@/lib/meta/capi";
import { DEFAULT_CUSTOMER_TZ } from "@/lib/timezone";
import {
  slotInsideAvailability,
  teacherDateISO,
} from "@/lib/booking/availability";

// Reaches lib/google/calendar.ts (Vercel OIDC / @vercel/oidc) via
// provisionSessionMeet — that dependency is Node-runtime only.
export const runtime = "nodejs";

const schema = z.object({
  teacherId: z.string().uuid(),
  startAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(15).max(180).default(60),
  isFreeTrial: z.boolean().default(true),
  // The booker's live browser timezone (IANA id). Retained for compatibility
  // with clients that still send it: the service-area gate it fed is gone (any
  // country can book), so nothing reads it here. Optional so an omitted value
  // is not a 400.
  clientTimezone: z.string().trim().min(1).max(64).optional(),
});

/**
 * When set, booking is performed by the `book-session` Supabase Edge Function
 * instead of inline here, and this route becomes a thin proxy.
 *
 * The point is to have ONE implementation of the booking rules once the native
 * client books directly. Leaving both paths live would mean two sets of
 * availability and overlap rules, and booking is the flow where a divergence
 * double-books a teacher and spends a credit twice.
 *
 * Unset by default, so nothing changes until the function is deployed.
 * e.g. https://<ref>.supabase.co/functions/v1/book-session
 */
const EDGE_URL = process.env.BOOKING_EDGE_FUNCTION_URL;

/**
 * Meet provisioning, confirmation email and analytics. Shared by both paths.
 *
 * These stay on the Node side even when the Edge Function does the booking:
 * provisionSessionMeet needs Vercel OIDC, and the email template lives in
 * lib/email. So a web booking still gets its Meet link synchronously, while a
 * booking made directly against the function relies on cron/meet-retry.
 */
async function finishBooking(args: {
  svc: ReturnType<typeof createSupabaseServiceClient>;
  sessionId: string;
  start: Date;
  end: Date;
  teacherId: string;
  teacherName: string;
  calendarId: string | null;
  /** Teacher's invite address, or null when unresolved (then only students are invited). */
  teacherEmail?: string | null;
  userId: string;
  userEmail: string | null;
  customerTz: string;
  isFreeTrial: boolean;
}) {
  const meetLink = await provisionSessionMeet(
    args.svc,
    { id: args.sessionId, start_at: args.start.toISOString(), end_at: args.end.toISOString() },
    {
      summary: `Yoga with ${args.teacherName}`,
      attendeeEmails: sessionAttendees([args.userEmail], args.teacherEmail ?? null),
      calendarId: args.calendarId,
    },
  );

  if (args.userEmail) {
    // Awaited, not fire-and-forget: in serverless, work started after the
    // response may not run. The helper never throws.
    await sendBookingConfirmation({
      to: args.userEmail,
      teacherName: args.teacherName,
      startUtc: args.start.toISOString(),
      customerTz: args.customerTz,
      meetLink,
    });
  }

  void trackServer(args.userId, args.isFreeTrial ? "trial_booked" : "session_booked", {
    teacher_id: args.teacherId,
    session_id: args.sessionId,
  });
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

  // Paid (non-trial) sessions spend one session-credit, reserved after the slot
  // is confirmed available (see below). The free 1:1 trial never spends credits.

  const customerTz = bookerProfile?.timezone ?? DEFAULT_CUSTOMER_TZ;

  if (EDGE_URL) {
    // The function authenticates from the JWT, so hand it this session's token
    // rather than the cookies it cannot read.
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (!authSession?.access_token) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const res = await fetch(EDGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authSession.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teacherId: parsed.data.teacherId,
        startAt: parsed.data.startAt,
        durationMinutes: parsed.data.durationMinutes,
        isFreeTrial: parsed.data.isFreeTrial,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      bookingId?: string;
      sessionId?: string;
      teacherName?: string;
      startAt?: string;
      error?: string;
    };
    // Error codes are identical on both sides, so pass them straight through:
    // every client already handles slot_taken, slot_unavailable and the rest.
    if (!res.ok || !body.sessionId || !body.bookingId) {
      return NextResponse.json({ error: body.error ?? "booking_failed" }, { status: res.status || 500 });
    }

    const bookedStart = new Date(body.startAt ?? parsed.data.startAt);
    const svcAfter = createSupabaseServiceClient();
    const { data: t } = await svcAfter
      .from("teachers")
      .select("google_calendar_id, contact_email, profile:profiles(email)")
      .eq("id", parsed.data.teacherId)
      .single();

    await finishBooking({
      svc: svcAfter,
      sessionId: body.sessionId,
      start: bookedStart,
      end: new Date(bookedStart.getTime() + parsed.data.durationMinutes * 60_000),
      teacherId: parsed.data.teacherId,
      teacherName: body.teacherName ?? "your teacher",
      calendarId: t?.google_calendar_id ?? null,
      // Invite the teacher too, so the session lands in their own calendar.
      teacherEmail: teacherInviteEmail({
        contact_email: t?.contact_email,
        profile: Array.isArray(t?.profile) ? t?.profile[0] : t?.profile,
      }),
      userId: user.id,
      userEmail: user.email ?? null,
      customerTz,
      isFreeTrial: parsed.data.isFreeTrial,
    });

    queueScheduleEvent(req, user, body.bookingId);
    return NextResponse.json({ bookingId: body.bookingId, sessionId: body.sessionId });
  }

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
    .select("id, display_name, timezone, is_active, is_public, google_calendar_id, contact_email, profile:profiles(email)")
    .eq("id", parsed.data.teacherId)
    .single();
  // is_public is enforced here, not just in the UI. A hidden teacher is absent
  // from the booking picker, but the picker is a list in a page: without this
  // check a customer who knows the id could still self-book, which is exactly
  // what hiding is meant to prevent. Admin-scheduled sessions do not come
  // through this route, so they are unaffected.
  if (!teacher || !teacher.is_active || !teacher.is_public) {
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
  const teacherDate = teacherDateISO(start, teacherTz);
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
    if (message.includes("slot_blocked")) {
      return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
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
      // Teacher included: the event used to invite the student only, so it
      // never reached the teacher's own calendar.
      attendeeEmails: sessionAttendees(
        [user.email],
        teacherInviteEmail({
          contact_email: teacher.contact_email,
          profile: Array.isArray(teacher.profile) ? teacher.profile[0] : teacher.profile,
        }),
      ),
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
      customerTz: bookerProfile?.timezone ?? DEFAULT_CUSTOMER_TZ,
      meetLink,
    });
  }

  void trackServer(user.id, parsed.data.isFreeTrial ? "trial_booked" : "session_booked", {
    teacher_id: teacher.id,
    session_id: session.id,
  });

  queueScheduleEvent(req, user, booking.id);
  return NextResponse.json({ bookingId: booking.id, sessionId: session.id });
}

// Meta "Schedule". Deliberately carries no teacher or class detail, and a fixed
// page path rather than the Referer (/dashboard/book/<teacher-slug>): which
// teacher someone booked can imply a health condition.
function queueScheduleEvent(req: Request, user: { id: string; email?: string }, bookingId: string) {
  queueMetaEvent({
    name: "Schedule",
    eventId: `schedule_${bookingId}`,
    context: metaContextFromRequest(req, "/dashboard/book"),
    user: { email: user.email, externalId: user.id },
  });
}
