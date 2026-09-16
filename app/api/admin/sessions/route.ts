import { NextResponse } from "next/server";
import { z } from "zod";
import type {
  AdminWarning,
  SessionCancelResponse,
  SessionPatchResponse,
} from "@/lib/admin/contracts";
import { reissueSessionMeet } from "@/lib/admin/meet";
import { slotInsideAvailability, teacherDateISO } from "@/lib/booking/availability";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { provisionSessionMeet, releaseSessionMeet } from "@/lib/google/provisionMeet";

// provisionSessionMeet -> lib/google/calendar.ts uses @vercel/oidc (Node only).
export const runtime = "nodejs";

const schema = z.object({
  teacherId: z.string().uuid(),
  classCategoryId: z.string().uuid().nullable().optional(),
  startAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(15).max(240).default(60),
  capacity: z.number().int().min(1).max(50).default(1),
  isFreeTrial: z.boolean().default(false),
  notes: z.string().max(2000).optional(),
});

const patchSchema = z
  .object({
    sessionId: z.string().uuid(),
    teacherId: z.string().uuid().optional(),
    classCategoryId: z.string().uuid().nullable().optional(),
    // An absolute UTC instant. The client builds it from an IST wall clock, not
    // with new Date(<datetime-local value>): the create dialog reads the ADMIN's
    // browser zone and renders back in Asia/Kolkata, so an admin outside IST
    // would type one time and read another.
    startAt: z.string().datetime({ offset: true }).optional(),
    durationMinutes: z.number().int().min(15).max(240).optional(),
    capacity: z.number().int().min(1).max(50).optional(),
    notes: z.string().max(2000).nullable().optional(),
    revokePhiShares: z.boolean().default(false),
    // true returns the PHI impact count and changes nothing.
    dryRun: z.boolean().default(false),
    reason: z.string().trim().max(500).optional(),
  })
  // A duration on its own is ambiguous: it would silently move end_at while the
  // admin believes they are only editing the length of an unchanged slot.
  .refine((v) => v.durationMinutes === undefined || v.startAt !== undefined, {
    message: "durationMinutes requires startAt",
  })
  .refine(
    (v) =>
      v.teacherId !== undefined ||
      v.classCategoryId !== undefined ||
      v.startAt !== undefined ||
      v.durationMinutes !== undefined ||
      v.capacity !== undefined ||
      v.notes !== undefined,
    { message: "no_changes" },
  );

const cancelSchema = z.object({
  sessionId: z.string().uuid(),
  refundCredits: z.boolean().default(true),
  reason: z.string().trim().max(500).optional(),
});

/** P0001 messages admin_update_session raises, and the status each deserves. */
const PATCH_STATUS: Record<string, number> = {
  session_not_found: 404,
  teacher_not_found: 404,
  category_not_found: 404,
  session_cancelled: 409,
  session_not_reschedulable: 409,
  capacity_below_enrolled: 409,
  bad_time_range: 400,
};

async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return data?.role === "admin";
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const start = new Date(parsed.data.startAt);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const end = new Date(start.getTime() + parsed.data.durationMinutes * 60_000);

  const svc = createSupabaseServiceClient();

  const { data: teacher } = await svc
    .from("teachers")
    .select("id, display_name, google_calendar_id")
    .eq("id", parsed.data.teacherId)
    .single();
  if (!teacher) {
    return NextResponse.json({ error: "teacher_not_found" }, { status: 404 });
  }

  // Reject overlapping non-cancelled sessions for the same teacher.
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

  const { data: session, error: sessionErr } = await svc
    .from("sessions")
    .insert({
      teacher_id: teacher.id,
      class_category_id: parsed.data.classCategoryId ?? null,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      capacity: parsed.data.capacity,
      is_free_trial: parsed.data.isFreeTrial,
      notes: parsed.data.notes ?? null,
      status: "scheduled",
      meet_status: "pending",
    })
    .select("id")
    .single();
  if (sessionErr || !session) {
    console.error("[admin/sessions] create failed:", sessionErr?.message);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }

  // Best-effort Meet provisioning. Failure leaves meet_status='failed' for the
  // cron sweeper to retry. Hosted on the teacher's own calendar when set.
  await provisionSessionMeet(
    svc,
    { id: session.id, start_at: start.toISOString(), end_at: end.toISOString() },
    { summary: `Yoga with ${teacher.display_name}`, calendarId: teacher.google_calendar_id },
  );

  return NextResponse.json({ sessionId: session.id });
}

/**
 * PATCH /api/admin/sessions — edit a class that already exists.
 *
 * Sessions were write-once until now (this file exported only POST and DELETE),
 * so every correction meant cancelling the class and rebuilding it, which
 * refunds nobody and destroys the roster. This moves the time, the teacher, the
 * class type, the capacity and the internal notes in place.
 *
 * Everything that has to be consistent with the change happens inside
 * admin_update_session's transaction: the reminder claims are released when the
 * time moves (or the 0016 cron, which claims each window exactly once, stays
 * silent forever), capacity cannot drop below the people already booked, and the
 * old Calendar event is parked in meet_orphan_events so a reschedule can never
 * strand a live join link at the old time.
 */
export async function PATCH(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const raw = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!raw.success) {
    // "nothing was changed" is a different sentence from "that form is invalid",
    // and the admin needs to be told which one it was.
    const noChanges = raw.error.issues.some((i) => i.message === "no_changes");
    return NextResponse.json({ error: noChanges ? "no_changes" : "bad request" }, { status: 400 });
  }
  const input = raw.data;

  const svc = createSupabaseServiceClient();
  const { data: session } = await svc
    .from("sessions")
    .select(
      "id, teacher_id, class_category_id, start_at, end_at, capacity, status, notes, meet_status, meet_event_id, meet_calendar_id",
    )
    .eq("id", input.sessionId)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  // The duration is only ever applied to a start the admin actually sent; with
  // no startAt both ends stay null and the RPC coalesces to what is on the row.
  let startIso: string | null = null;
  let endIso: string | null = null;
  if (input.startAt !== undefined) {
    const start = new Date(input.startAt);
    const currentMinutes = Math.round(
      (Date.parse(session.end_at) - Date.parse(session.start_at)) / 60_000,
    );
    const minutes = input.durationMinutes ?? currentMinutes;
    // A few minutes of slack: admins legitimately nudge a start that is about to
    // happen, and only a genuinely past start is a typo worth refusing.
    if (start.getTime() < Date.now() - 15 * 60_000) {
      return NextResponse.json({ error: "start_in_past" }, { status: 400 });
    }
    startIso = start.toISOString();
    endIso = new Date(start.getTime() + minutes * 60_000).toISOString();
  }

  const newTeacherId = input.teacherId ?? session.teacher_id;
  const teacherMoved = newTeacherId !== session.teacher_id;

  const { data: teacher } = await svc
    .from("teachers")
    .select("id, display_name, timezone, is_active, google_calendar_id")
    .eq("id", newTeacherId)
    .maybeSingle();
  if (!teacher) {
    return NextResponse.json({ error: "teacher_not_found" }, { status: 404 });
  }

  const warnings = await windowWarnings(svc, {
    teacher,
    startIso: startIso ?? session.start_at,
    endIso: endIso ?? session.end_at,
  });

  const { count: enrolledCount } = await svc
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id)
    .neq("status", "cancelled");
  const enrolled = enrolledCount ?? 0;

  if (input.dryRun) {
    // Nothing is written. The point of the preview is the PHI number: moving the
    // teacher silently strips the premise (customer_booked_teacher) from every
    // medical-document share the outgoing teacher holds, and the admin has to
    // see how many people that is before choosing to revoke them.
    const phiSharesAffected = teacherMoved
      ? await countOrphanedPhiShares(svc, session.id, session.teacher_id)
      : 0;
    const preview: SessionPatchResponse = {
      ok: true,
      sessionId: session.id,
      meetAction: "none",
      meetReissued: false,
      phiSharesAffected,
      phiSharesRevoked: 0,
      remindersReset: 0,
      enrolled,
      warnings,
    };
    return NextResponse.json(preview);
  }

  const { data: result, error } = await svc
    .rpc("admin_update_session", {
      p_session: session.id,
      p_teacher: input.teacherId ?? null,
      p_class_category_id: input.classCategoryId ?? null,
      p_clear_category: input.classCategoryId === null,
      p_start: startIso,
      p_end: endIso,
      p_capacity: input.capacity ?? null,
      p_notes: input.notes ?? null,
      // notes is nullable AND optional, so "clear the notes" and "leave them
      // alone" both arrive as a null p_notes. This flag is what separates them.
      p_set_notes: input.notes !== undefined,
      p_revoke_phi_shares: input.revokePhiShares,
      p_acting_admin: user.id,
      p_reason: input.reason ?? null,
    })
    .single();
  if (error || !result) {
    const message = error?.message ?? "";
    // 23P01 is the sessions_no_overlap EXCLUDE constraint (0017) firing on the
    // UPDATE. It is not a unique index, so ON CONFLICT cannot swallow it, and
    // the POST handler above does not translate it at all. This one must: the
    // admin has hit a real double-booking, not a server fault.
    if (error?.code === "23P01") {
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    }
    if (error?.code === "P0001" && PATCH_STATUS[message]) {
      return NextResponse.json(
        message === "capacity_below_enrolled"
          ? { error: message, enrolled }
          : { error: message },
        { status: PATCH_STATUS[message] },
      );
    }
    console.error("[admin/sessions] patch failed:", message);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  // The RPC has already parked the old event and set meet_status='pending', so
  // a failure from here on leaves the cron sweep able to finish the job.
  let meetReissued = false;
  if (result.meet_action === "reprovision") {
    const link = await reissueSessionMeet(svc, session.id, {
      display_name: teacher.display_name,
      google_calendar_id: teacher.google_calendar_id,
    });
    meetReissued = link !== null;
  }

  const response: SessionPatchResponse = {
    ok: true,
    sessionId: session.id,
    meetAction: result.meet_action === "reprovision" ? "reprovision" : "none",
    meetReissued,
    phiSharesAffected: result.phi_shares_affected,
    phiSharesRevoked: result.phi_shares_revoked,
    remindersReset: result.reminders_reset,
    enrolled: result.enrolled,
    warnings,
  };
  return NextResponse.json(response);
}

/**
 * DELETE /api/admin/sessions — cancel a whole class, refunding everybody on it.
 *
 * The previous implementation mass-cancelled the bookings with a single UPDATE
 * and never called a refund at all, so cancelling a full class destroyed every
 * attendee's prepaid session. The cascade now lives in admin_cancel_session, so
 * the cancels, the refunds and the audit row commit together, and the reminder
 * claims are cleared on the way out.
 */
export async function DELETE(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = cancelSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const svc = createSupabaseServiceClient();
  const { data: result, error } = await svc
    .rpc("admin_cancel_session", {
      p_session: parsed.data.sessionId,
      p_refund: parsed.data.refundCredits,
      p_acting_admin: user.id,
      p_reason: parsed.data.reason ?? null,
    })
    .single();

  if (error || !result) {
    const message = error?.message ?? "";
    if (error?.code === "P0001" && message === "session_not_found") {
      return NextResponse.json({ error: "session_not_found" }, { status: 404 });
    }
    if (error?.code === "P0001" && message === "already_cancelled") {
      // Preserves the endpoint's existing idempotent answer: a second cancel is
      // a no-op, not an error, because the admin table can double-submit.
      const idempotent: SessionCancelResponse = {
        ok: true,
        sessionId: parsed.data.sessionId,
        cancelledBookings: 0,
        refundedBookings: 0,
        meetReleased: false,
      };
      return NextResponse.json(idempotent);
    }
    console.error("[admin/sessions] cancel failed:", message);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // The RPC set meet_status='release_pending' when there was an event to tear
  // down on a class that has not started yet. Delete it and clear the row to
  // NULL, guarded on that value. NULL and never 'failed': 'failed' would make
  // the forward cron sweep provision a fresh link for a cancelled class, forever.
  // If this process dies here, the row stays marked and cron/meet-retry finishes.
  let meetReleased = false;
  if (result.meet_event_id && result.starts_in_future) {
    await releaseSessionMeet({
      meet_event_id: result.meet_event_id,
      meet_calendar_id: result.meet_calendar_id,
    });
    const { data: cleared } = await svc
      .from("sessions")
      .update({ meet_status: null, meet_link: null, meet_event_id: null })
      .eq("id", parsed.data.sessionId)
      .eq("meet_status", "release_pending")
      .select("id");
    meetReleased = (cleared?.length ?? 0) > 0;
  }

  const response: SessionCancelResponse = {
    ok: true,
    sessionId: parsed.data.sessionId,
    cancelledBookings: result.cancelled_bookings,
    refundedBookings: result.refunded_bookings,
    meetReleased,
  };
  return NextResponse.json(response);
}

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

/**
 * The non-blocking observations about a class's new window. An admin is allowed
 * to schedule outside a teacher's published hours and on a date they blocked
 * off, because an override is the whole point of this surface; they just have to
 * be told they are doing it.
 */
async function windowWarnings(
  svc: ServiceClient,
  args: {
    teacher: { id: string; timezone: string; is_active: boolean; google_calendar_id: string | null };
    startIso: string;
    endIso: string;
  },
): Promise<AdminWarning[]> {
  const warnings = new Set<AdminWarning>();
  if (!args.teacher.is_active) warnings.add("teacher_inactive");
  if (!args.teacher.google_calendar_id) warnings.add("teacher_has_no_calendar");

  const tz = args.teacher.timezone || "Asia/Kolkata";
  const start = new Date(args.startIso);
  const end = new Date(args.endIso);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);

  const { data: availability } = await svc
    .from("teacher_availability")
    .select("day_of_week, start_time, end_time, slot_duration_minutes")
    .eq("teacher_id", args.teacher.id);
  if (!slotInsideAvailability(start, end, minutes, tz, availability ?? [])) {
    warnings.add("outside_availability");
  }

  const { data: overrides } = await svc
    .from("teacher_slot_overrides")
    .select("is_blocked")
    .eq("teacher_id", args.teacher.id)
    .eq("date", teacherDateISO(start, tz));
  if (overrides?.some((o) => o.is_blocked)) warnings.add("blocked_date");

  return [...warnings];
}

/**
 * How many live medical-document shares would lose their premise if this class
 * changed teacher, mirroring the two-CTE query inside admin_update_session.
 *
 * "Orphaned" means a student in this class who, after the move, has no other
 * live booking left with the OUTGOING teacher. Only those students lose what
 * customer_booked_teacher (0027) checks, so only their shares are in scope: a
 * student who also attends that teacher's Tuesday class keeps the relationship
 * and must keep the share.
 *
 * Read-only, and used only by the dry run. The authoritative count comes back
 * from the RPC, which recomputes it inside the same transaction as the move.
 */
async function countOrphanedPhiShares(
  svc: ServiceClient,
  sessionId: string,
  fromTeacherId: string,
): Promise<number> {
  const { data: roster } = await svc
    .from("bookings")
    .select("customer_id")
    .eq("session_id", sessionId)
    .neq("status", "cancelled");
  const customerIds = [...new Set((roster ?? []).map((b) => b.customer_id))];
  if (customerIds.length === 0) return 0;

  const { data: otherBookings } = await svc
    .from("bookings")
    .select("customer_id, session_id")
    .in("customer_id", customerIds)
    .neq("status", "cancelled")
    .neq("session_id", sessionId);
  const otherSessionIds = [...new Set((otherBookings ?? []).map((b) => b.session_id))];

  const { data: keptSessions } = otherSessionIds.length
    ? await svc
        .from("sessions")
        .select("id")
        .in("id", otherSessionIds)
        .eq("teacher_id", fromTeacherId)
    : { data: null };
  const keptSessionIds = new Set((keptSessions ?? []).map((s) => s.id));
  const stillWithTeacher = new Set(
    (otherBookings ?? [])
      .filter((b) => keptSessionIds.has(b.session_id))
      .map((b) => b.customer_id),
  );

  const orphaned = customerIds.filter((id) => !stillWithTeacher.has(id));
  if (orphaned.length === 0) return 0;

  const { data: documents } = await svc
    .from("medical_documents")
    .select("id")
    .in("customer_id", orphaned);
  const documentIds = (documents ?? []).map((d) => d.id);
  if (documentIds.length === 0) return 0;

  const { count } = await svc
    .from("medical_document_shares")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", fromTeacherId)
    .is("revoked_at", null)
    .in("document_id", documentIds);
  return count ?? 0;
}
