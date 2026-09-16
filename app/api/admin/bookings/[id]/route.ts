import { NextResponse } from "next/server";
import { z } from "zod";

import type { BookingActionResponse } from "@/lib/admin/contracts";
import {
  attendeeEmailsForSession,
  clearReleasedMeet,
  markMeetForRelease,
} from "@/lib/admin/meet";
import { requireAdminApi } from "@/lib/auth/apiGuards";
import { patchMeetEventAttendees, setMeetEventAttendees } from "@/lib/google/calendar";
import { provisionSessionMeet, releaseSessionMeet } from "@/lib/google/provisionMeet";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// provisionSessionMeet / releaseSessionMeet -> @vercel/oidc (Node only).
export const runtime = "nodejs";

/**
 * POST /api/admin/bookings/[id] — the three things a studio does to one student's
 * place in a class: record whether they turned up, take them out, or put them in
 * a different class.
 *
 * All three go through a 0039 RPC, because all three used to be raw browser
 * UPDATEs from the admin table. Those could not refund a prepaid session, could
 * not see a concurrent cron write, and left no audit row.
 */
const bookingActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("attendance"),
    status: z.enum(["attended", "no_show", "confirmed"]),
    // Echoed from the row the admin was looking at. Without it this races
    // cron/no-show-sweep, which flips confirmed -> no_show 2h after end_at: the
    // admin marks "attended", the sweep lands a second later, and the studio
    // has a no-show on a student who was in the room.
    expectedStatus: z.enum(["confirmed", "attended", "no_show"]).optional(),
    reason: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal("cancel"),
    // No default, on purpose. The UI preselects true for a future class and
    // false for a past one, but the admin's actual choice is what lands in
    // audit_log and on bookings.credit_refunded. A silent default is how a
    // prepaid session goes missing with nobody able to say when.
    refundCredit: z.boolean(),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("move"),
    targetSessionId: z.string().uuid(),
    reason: z.string().trim().max(500).optional(),
  }),
]);

/** P0001 message -> HTTP status, per action. Anything unlisted is a 500. */
const ATTENDANCE_STATUS: Record<string, number> = {
  booking_not_found: 404,
  booking_cancelled: 409,
  status_changed: 409,
};
const CANCEL_STATUS: Record<string, number> = {
  booking_not_found: 404,
  already_cancelled: 409,
};
const MOVE_STATUS: Record<string, number> = {
  booking_not_found: 404,
  target_not_found: 404,
  booking_cancelled: 409,
  target_not_open: 409,
  session_full: 409,
  already_enrolled: 409,
  same_session: 400,
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const gate = await requireAdminApi();
  if (gate instanceof NextResponse) return gate;

  const parsed = bookingActionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const svc = createSupabaseServiceClient();
  const body = parsed.data;

  if (body.action === "attendance") {
    // Credit-neutral in both directions: attended and no_show both mean the seat
    // was consumed, and walking a mistaken no_show back to confirmed must not
    // hand out a session either. Only a cancel moves credits.
    const { error } = await svc.rpc("admin_set_booking_attendance", {
      p_booking: id,
      p_status: body.status,
      p_expected_status: body.expectedStatus ?? null,
      p_acting_admin: gate.userId,
      p_reason: body.reason ?? null,
    });
    if (error) {
      // bad_status is the RPC refusing 'cancelled' through this door; cancelling
      // is the other branch, and it has to decide about the refund.
      if (error.code === "P0001" && error.message === "bad_status") {
        return NextResponse.json({ error: "bad request" }, { status: 400 });
      }
      return rpcFailure("attendance", error, ATTENDANCE_STATUS);
    }

    const response: BookingActionResponse = {
      ok: true,
      action: "attendance",
      bookingId: id,
      status: body.status,
    };
    return NextResponse.json(response);
  }

  if (body.action === "cancel") {
    const { data, error } = await svc
      .rpc("admin_cancel_booking", {
        p_booking: id,
        p_refund: body.refundCredit,
        p_acting_admin: gate.userId,
        p_reason: body.reason,
      })
      .single();
    if (error || !data) return rpcFailure("cancel", error, CANCEL_STATUS);

    // Meet teardown happens AFTER the refund has committed, and keeps both of
    // the guards /api/bookings/cancel has: the class has not started (so a live
    // class does not lose its link mid-flow) AND nobody is left on the roster
    // (so a group class does not lose its link when one person drops out).
    const meetReleased = data.session_now_empty
      ? await releaseSessionIfEmptyAndFuture(svc, data.session_id)
      : false;

    // The class keeps running, so the event survives and the person who just
    // left has to come off its attendee list. Nothing else does this: teardown
    // only fires on the LAST booking, and patchMeetEventAttendees can only add.
    // Skipped when the event was released, because there is nothing left to
    // re-sync.
    if (!meetReleased) await resyncSessionAttendees(svc, data.session_id);

    const { data: credits } = await svc
      .from("customer_credits")
      .select("balance")
      .eq("customer_id", data.customer_id)
      .maybeSingle();

    const response: BookingActionResponse = {
      ok: true,
      action: "cancel",
      bookingId: id,
      refunded: data.refunded,
      balance: credits?.balance ?? null,
      meetReleased,
    };
    return NextResponse.json(response);
  }

  // move. One row repointed at another session: no refund, no re-spend, no
  // ledger rows at all, so a student with zero prepaid sessions left can still
  // be moved out of a class the studio is rearranging.
  const { data, error } = await svc
    .rpc("admin_move_booking", {
      p_booking: id,
      p_target_session: body.targetSessionId,
      p_acting_admin: gate.userId,
      p_reason: body.reason ?? null,
    })
    .single();
  if (error || !data) return rpcFailure("move", error, MOVE_STATUS);

  const meetReleased = data.source_now_empty
    ? await releaseSessionIfEmptyAndFuture(svc, data.source_session)
    : false;

  // Off the invite of the class they left (unless it was torn down entirely),
  // then onto the invite of the class they joined. Without the first half they
  // hold live links to BOTH classes.
  if (!meetReleased) await resyncSessionAttendees(svc, data.source_session);
  await inviteToTargetSession(svc, body.targetSessionId);

  const response: BookingActionResponse = {
    ok: true,
    action: "move",
    bookingId: id,
    fromSessionId: data.source_session,
    toSessionId: body.targetSessionId,
    meetReleased,
  };
  return NextResponse.json(response);
}

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

/**
 * Tear down the Meet event of a session that just lost its last live booking.
 *
 * The caller has already established from the RPC that the roster is empty; this
 * adds the second guard (the class is still in the future) and then runs the
 * mark -> delete -> clear sequence. If the process dies between the mark and the
 * clear, the row sits at 'release_pending' and cron/meet-retry's reverse sweep
 * finishes it, which is the whole reason the marker exists.
 *
 * Returns whether an event was actually released.
 */
async function releaseSessionIfEmptyAndFuture(
  svc: ServiceClient,
  sessionId: string,
): Promise<boolean> {
  const { data: session } = await svc
    .from("sessions")
    .select("id, start_at, meet_event_id, meet_calendar_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session?.meet_event_id) return false;
  if (new Date(session.start_at).getTime() <= Date.now()) return false;

  await markMeetForRelease(svc, sessionId);
  await releaseSessionMeet(session);
  await clearReleasedMeet(svc, sessionId);
  return true;
}

/**
 * Re-sync a session's Calendar invite to its CURRENT confirmed roster, for a
 * session that keeps its event.
 *
 * Only the attendee list changes: the event, and with it the join URL everybody
 * else is already holding, is left exactly as it is. This is what takes a
 * removed or moved-out student off the invite, which nothing else does.
 *
 * Best effort and deliberately silent. The booking change has already committed,
 * so a Google failure here must not turn a successful cancel or move into an
 * error; the stale invite is the cost, and it is smaller than an admin retrying
 * a cancel that already happened.
 */
async function resyncSessionAttendees(svc: ServiceClient, sessionId: string): Promise<void> {
  const { data: session } = await svc
    .from("sessions")
    .select("id, start_at, status, meet_status, meet_event_id, meet_calendar_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.status === "cancelled") return;
  if (session.meet_status !== "created" || !session.meet_event_id) return;
  // Same guard teardown uses: a class that has already started keeps its invite
  // untouched rather than mailing everyone mid-class.
  if (new Date(session.start_at).getTime() <= Date.now()) return;

  const attendeeEmails = await attendeeEmailsForSession(svc, sessionId);
  await setMeetEventAttendees(session.meet_event_id, session.meet_calendar_id, attendeeEmails);
}

/**
 * Make sure the session a student was just moved INTO has a link, and that they
 * are on its invite.
 *
 * Best effort throughout: the move itself has already committed, and the student
 * can always read the join link from their dashboard, so a Google failure here
 * is left to cron/meet-retry rather than reported as a failed move.
 */
async function inviteToTargetSession(svc: ServiceClient, sessionId: string): Promise<void> {
  const { data: session } = await svc
    .from("sessions")
    .select("id, teacher_id, start_at, end_at, status, meet_status, meet_event_id, meet_calendar_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.status === "cancelled") return;
  if (new Date(session.start_at).getTime() <= Date.now()) return;

  const attendeeEmails = await attendeeEmailsForSession(svc, sessionId);

  if (session.meet_status === "created" && session.meet_event_id) {
    // Merge into the existing invite. Re-creating the event would change the
    // join link for everybody already in this class.
    await patchMeetEventAttendees(session.meet_event_id, session.meet_calendar_id, attendeeEmails);
    return;
  }

  const { data: teacher } = await svc
    .from("teachers")
    .select("display_name, google_calendar_id")
    .eq("id", session.teacher_id)
    .maybeSingle();

  // `.is.null` OR `.neq`, never `.neq` alone: `meet_status <> 'created'` is
  // UNKNOWN (not TRUE) for a NULL row, so a session cleared to NULL when its
  // last attendee left — exactly the session somebody is now being moved into —
  // would match zero rows and stay unarmed, and provisionSessionMeet's identical
  // compare-and-set would then drop the link it just created on the floor.
  await svc
    .from("sessions")
    .update({ meet_status: "pending" })
    .eq("id", sessionId)
    .or("meet_status.is.null,meet_status.neq.created");

  // recover:true: this session's time has not moved, so an event already tagged
  // with its id is still the right event. It also covers a session whose link
  // was cleared to NULL when its last attendee left and is now filling again.
  await provisionSessionMeet(
    svc,
    { id: session.id, start_at: session.start_at, end_at: session.end_at },
    {
      summary: `Yoga${teacher?.display_name ? ` with ${teacher.display_name}` : ""}`,
      attendeeEmails,
      calendarId: teacher?.google_calendar_id,
      recover: true,
    },
  );
}

/**
 * One RPC error to one typed response. Raw Postgres text never leaves here: an
 * unrecognised message is logged and answered with db_error, because a policy
 * or constraint string in a toast is both unreadable and a disclosure.
 */
function rpcFailure(
  action: string,
  error: { code?: string; message?: string } | null,
  statuses: Record<string, number>,
): NextResponse {
  const message = error?.message ?? "";
  if (error?.code === "P0001" && message === "admin_only") {
    // Unreachable behind requireAdminApi, but the RPC gates itself too and its
    // answer should not read as a server fault if the two ever disagree.
    return NextResponse.json({ error: "admin_only" }, { status: 403 });
  }
  if (error?.code === "P0001" && statuses[message]) {
    return NextResponse.json({ error: message }, { status: statuses[message] });
  }
  console.error(`[admin/bookings] ${action} failed:`, message);
  return NextResponse.json({ error: "db_error" }, { status: 500 });
}
