import { NextResponse } from "next/server";
import { z } from "zod";

import type { AdminEnrolResponse, AdminWarning, EnrolResultRow } from "@/lib/admin/contracts";
import { attendeeEmailsForSession } from "@/lib/admin/meet";
import { requireAdminApi } from "@/lib/auth/apiGuards";
import { slotInsideAvailability, teacherDateISO } from "@/lib/booking/availability";
import { patchMeetEventAttendees } from "@/lib/google/calendar";
import { provisionSessionMeet } from "@/lib/google/provisionMeet";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// provisionSessionMeet -> lib/google/calendar.ts uses @vercel/oidc (Node only).
export const runtime = "nodejs";

/**
 * POST /api/admin/bookings — put existing customers into existing sessions.
 *
 * This is the studio's front-desk path: someone paid over the counter, or a
 * class was rebuilt after a mix-up, and the roster has to say what actually
 * happened. It is deliberately more permissive than /api/bookings/confirm,
 * which is the CUSTOMER's path: no availability gate, no blocked-date gate, and
 * an explicit "add without charging a prepaid session" escape hatch. Those
 * overrides are the feature. What it does NOT relax is capacity, the one
 * prepaid-session-per-booking arithmetic, or the single introductory 1:1, all
 * of which are enforced inside admin_enrol_booking's transaction.
 */
const enrolSchema = z
  .object({
    sessionIds: z.array(z.string().uuid()).min(1).max(12),
    customerIds: z.array(z.string().uuid()).min(1).max(25),
    isFreeTrial: z.boolean().default(false),
    chargeCredit: z.boolean().default(true),
    reason: z.string().trim().max(500).optional(),
  })
  // The introductory 1:1 is one booking for one person by definition, and the
  // partial unique index behind it (0007) would reject the rest of the batch
  // one row at a time anyway. Refuse the shape instead of half-applying it.
  .refine((v) => !v.isFreeTrial || v.customerIds.length === 1, {
    message: "free_trial_single_only",
  })
  .refine((v) => !v.isFreeTrial || v.sessionIds.length === 1, {
    message: "free_trial_single_only",
  });

/** P0001 messages admin_enrol_booking raises, all of which are AdminErrorCodes. */
const ENROL_CODES = new Set([
  "admin_only",
  "session_not_found",
  "session_not_open",
  "customer_not_eligible",
  "already_enrolled",
  "trial_already_claimed",
  "session_full",
  "insufficient_credits",
]);

/** The batch cap, over and above the per-array caps in the schema. */
const MAX_PAIRS = 50;

export async function POST(req: Request): Promise<Response> {
  // Auth first, service client second: middleware does not run on /api/*, so
  // this gate is the whole authorization boundary.
  const gate = await requireAdminApi();
  if (gate instanceof NextResponse) return gate;

  const parsed = enrolSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { sessionIds, customerIds, isFreeTrial, chargeCredit, reason } = parsed.data;
  if (sessionIds.length * customerIds.length > MAX_PAIRS) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const svc = createSupabaseServiceClient();

  // Sequential, never Promise.all. Each call takes a FOR UPDATE lock on its
  // session to count the roster, so firing them concurrently would just make
  // them queue behind each other with a deadlock risk between two sessions.
  const results: EnrolResultRow[] = [];
  const enrolledSessionIds = new Set<string>();
  for (const sessionId of sessionIds) {
    for (const customerId of customerIds) {
      const { data, error } = await svc
        .rpc("admin_enrol_booking", {
          p_session: sessionId,
          p_customer: customerId,
          p_is_free_trial: isFreeTrial,
          p_charge_credit: chargeCredit,
          p_acting_admin: gate.userId,
          p_reason: reason ?? null,
        })
        .single();

      if (error || !data) {
        results.push({
          customerId,
          bookingId: null,
          charged: false,
          comped: false,
          error: translateEnrolError(error),
        });
        continue;
      }

      results.push({
        customerId,
        bookingId: data.booking_id,
        charged: data.charged,
        comped: data.comped,
        error: null,
      });
      enrolledSessionIds.add(sessionId);
    }
  }

  const warnings = new Set<AdminWarning>();

  // Everything below is reporting and Google. A failure here must never undo an
  // enrolment that already committed, so nothing after this point returns non-200.
  const { data: sessions } = await svc
    .from("sessions")
    .select(
      "id, teacher_id, start_at, end_at, status, meet_link, meet_status, meet_event_id, meet_calendar_id",
    )
    .in("id", sessionIds);

  const teacherIds = [...new Set((sessions ?? []).map((s) => s.teacher_id))];
  const { data: teachers } = await svc
    .from("teachers")
    .select("id, display_name, timezone, google_calendar_id")
    .in("id", teacherIds);
  const teacherById = new Map((teachers ?? []).map((t) => [t.id, t]));

  const { data: availability } = await svc
    .from("teacher_availability")
    .select("teacher_id, day_of_week, start_time, end_time, slot_duration_minutes")
    .in("teacher_id", teacherIds);

  const { data: overrides } = await svc
    .from("teacher_slot_overrides")
    .select("teacher_id, date, is_blocked")
    .in("teacher_id", teacherIds)
    .eq("is_blocked", true);

  for (const session of sessions ?? []) {
    const teacher = teacherById.get(session.teacher_id);
    const tz = teacher?.timezone || "Asia/Kolkata";
    const start = new Date(session.start_at);
    const end = new Date(session.end_at);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);

    // Reported, never enforced. An admin putting somebody into a class that
    // sits outside the teacher's published hours is exactly what this endpoint
    // is for; the operator just needs to know they are doing it.
    const windows = (availability ?? []).filter((a) => a.teacher_id === session.teacher_id);
    if (!slotInsideAvailability(start, end, minutes, tz, windows)) {
      warnings.add("outside_availability");
    }
    const dateISO = teacherDateISO(start, tz);
    if ((overrides ?? []).some((o) => o.teacher_id === session.teacher_id && o.date === dateISO)) {
      warnings.add("blocked_date");
    }
  }

  // Only meaningful when the whole batch went into ONE class, which is the case
  // the roster dialog actually shows a link for. A multi-session batch has no
  // single link to report, so it stays null rather than picking an arbitrary one.
  let meetLink: string | null = null;
  for (const session of sessions ?? []) {
    if (!enrolledSessionIds.has(session.id)) continue;
    if (session.status === "cancelled") continue;
    if (new Date(session.start_at).getTime() <= Date.now()) continue;

    const teacher = teacherById.get(session.teacher_id);
    const attendeeEmails = await attendeeEmailsForSession(svc, session.id);

    if (session.meet_status === "created" && session.meet_event_id) {
      // The link already exists and other people are holding it, so re-creating
      // the event would change the join URL for everybody. Merge the newcomers
      // into the invite instead.
      const invited = await patchMeetEventAttendees(
        session.meet_event_id,
        session.meet_calendar_id,
        attendeeEmails,
      );
      if (!invited) warnings.add("attendee_not_invited");
      if (sessionIds.length === 1) meetLink = session.meet_link;
      continue;
    }

    // No link yet, or the last attempt failed, or the session was emptied and
    // cleared to NULL by a previous cancel. Re-arm the forward cron sweep first
    // so a crash between here and Google still ends with a link.
    //
    // `.is.null` OR `.neq`, never `.neq` alone: PostgREST renders .neq as
    // `meet_status <> 'created'`, which is UNKNOWN (not TRUE) for a NULL row, so
    // a session cleared to NULL by clearReleasedMeet would match ZERO rows here
    // AND in provisionSessionMeet's identical compare-and-set below. The Google
    // event gets created and invites go out, but nothing is ever written back:
    // no link on the dashboard, no link in the reminder emails, and no
    // meet_event_id to delete the event by later.
    await svc
      .from("sessions")
      .update({ meet_status: "pending" })
      .eq("id", session.id)
      .or("meet_status.is.null,meet_status.neq.created");

    // recover:true is right here and not on a reschedule: the session's TIME has
    // not moved, so an event already tagged with this session id is still the
    // correct event and adopting it beats creating a duplicate.
    const link = await provisionSessionMeet(
      svc,
      { id: session.id, start_at: session.start_at, end_at: session.end_at },
      {
        summary: `Yoga${teacher?.display_name ? ` with ${teacher.display_name}` : ""}`,
        attendeeEmails,
        calendarId: teacher?.google_calendar_id,
        recover: true,
      },
    );
    if (sessionIds.length === 1) meetLink = link;
  }

  const { data: credits } = await svc
    .from("customer_credits")
    .select("customer_id, balance")
    .in("customer_id", customerIds);
  const balances: Record<string, number> = {};
  for (const customerId of customerIds) balances[customerId] = 0;
  for (const row of credits ?? []) balances[row.customer_id] = row.balance;

  const enrolled = results.filter((r) => r.bookingId !== null).length;

  // 200 even when every row failed. The per-row errors are the answer, and the
  // UI renders them next to each name; a blanket 4xx would throw away the rows
  // that did succeed in a mixed batch.
  const body: AdminEnrolResponse = {
    ok: true,
    results,
    enrolled,
    failed: results.length - enrolled,
    balances,
    meetLink,
    warnings: [...warnings],
  };
  return NextResponse.json(body);
}

/**
 * One RPC failure to one AdminErrorCode. A 23505 that reaches here can only be
 * bookings_one_free_trial_per_customer: the session/customer pair is caught by
 * the RPC's own already_enrolled pre-check and by bookings_one_live_per_session.
 */
function translateEnrolError(error: { code?: string; message?: string } | null): string {
  if (error?.code === "23505") return "trial_already_claimed";
  if (error?.code === "P0001" && error.message && ENROL_CODES.has(error.message)) {
    return error.message;
  }
  console.error("[admin/bookings] enrol failed:", error?.message);
  return "enrol_failed";
}
