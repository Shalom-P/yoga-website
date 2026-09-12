// cancel-booking: cancel a booking without Vercel.
//
// Exists for the same reason `book-session` does: the native iOS client cannot
// call /api/bookings/cancel. That route authenticates with
// `createSupabaseServerClient()`, which is cookie-bound, so a native Bearer
// token gets a 401. The app used to work around it by running the fetch inside
// its Capacitor WebView, which meant the app could only cancel while the hosted
// site was reachable. This removes that.
//
// The rules are NOT reimplemented loosely — they are the same four the route
// applies, in the same order:
//
//   1. the booking must belong to the caller (checked against the verified JWT,
//      never a caller-supplied customer id),
//   2. it must still be 'confirmed',
//   3. the flip to 'cancelled' carries .eq('status','confirmed') so two
//      concurrent cancels cannot both win and refund twice,
//   4. a paid booking is refunded through refund_session_credit, which is
//      idempotent on booking_id (credit_ledger_refund_once, migration 0021).
//
// WHAT THIS DELIBERATELY DOES NOT DO
//
// Delete the Google Calendar event. `releaseSessionMeet` -> lib/google/calendar.ts
// authenticates through Vercel OIDC -> GCP Workload Identity Federation, which
// no Edge Function can mint. So the session is marked meet_status='release_pending'
// and cron/meet-retry, which already runs on Node with those credentials every
// few minutes, performs the deletion. The event therefore disappears within a
// cron interval instead of synchronously, which is the same trade-off the link
// already makes on the way in.
//
// That mark is best-effort on purpose. A cancellation that succeeded must not be
// reported as failed because a calendar tidy-up could not be scheduled: the
// customer's credit is back and their slot is free either way. It also means
// this function keeps working if it is deployed before migration 0038.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("BOOKING_ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function fail(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Payload = { bookingId: string; reason: string | null };

/** Hand-rolled rather than pulling zod into the bundle; the shape is two fields. */
function parsePayload(raw: unknown): Payload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const b = raw as Record<string, unknown>;

  if (typeof b.bookingId !== "string" || !UUID.test(b.bookingId)) return null;

  if (b.reason === undefined || b.reason === null) return { bookingId: b.bookingId, reason: null };
  if (typeof b.reason !== "string" || b.reason.length > 500) return null;
  return { bookingId: b.bookingId, reason: b.reason };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  // Identity comes from the verified JWT only.
  const authHeader = req.headers.get("Authorization") ?? "";
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return fail("unauthenticated", 401);

  const parsed = parsePayload(await req.json().catch(() => null));
  if (!parsed) return fail("bad request", 400);

  // bookings has admin-only write RLS and refund_session_credit is service-role
  // only, so the work below needs this client. Every read is filtered by the
  // caller's own id regardless.
  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: booking } = await svc
    .from("bookings")
    .select("id, session_id, customer_id, status, is_free_trial")
    .eq("id", parsed.bookingId)
    .maybeSingle();

  // Someone else's booking is "not found", not "forbidden": a distinct 403 would
  // confirm the id exists.
  if (!booking || booking.customer_id !== user.id) return fail("not_found", 404);
  if (booking.status !== "confirmed") return fail("not_cancellable", 409);

  const { data: cancelled, error: updateErr } = await svc
    .from("bookings")
    .update({
      status: "cancelled",
      cancellation_reason: parsed.reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .eq("status", "confirmed") // optimistic guard against double-cancel races
    .select("id");
  if (updateErr) {
    console.error("[cancel-booking] cancel failed:", updateErr.message);
    return fail("db_error", 500);
  }
  // A concurrent request already cancelled this booking — don't refund twice.
  if (!cancelled || cancelled.length === 0) return fail("not_cancellable", 409);

  // Refund the session credit for a paid booking (the free trial never spent
  // one). Idempotent, so even reached twice the credit is granted once.
  if (!booking.is_free_trial) {
    const { error: refundErr } = await svc.rpc("refund_session_credit", {
      p_customer: user.id,
      p_booking_id: booking.id,
    });
    if (refundErr) {
      // The booking is already cancelled. Surface the failure so a lost credit
      // can be reconciled rather than swallowing it, but do not fail the
      // request: the customer's slot is released either way, and telling them
      // the cancel failed would invite a second attempt that cannot succeed.
      console.error("[cancel-booking] credit refund failed:", refundErr.message);
    }
  }

  await markMeetForRelease(svc, booking.session_id);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

/**
 * Flags the session's Meet event for teardown by cron/meet-retry.
 *
 * Only when the session has not started — killing the link to a class already
 * running would be worse than leaving it — and only when no non-cancelled
 * booking remains on it, so a group class does not lose its link the moment the
 * first attendee drops out. Both conditions are the hosted route's.
 *
 * Never throws. See the header.
 */
async function markMeetForRelease(
  svc: ReturnType<typeof createClient>,
  sessionId: string,
): Promise<void> {
  try {
    const { data: session } = await svc
      .from("sessions")
      .select("meet_event_id, start_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session?.meet_event_id || !session.start_at) return;
    if (new Date(session.start_at as string).getTime() <= Date.now()) return;

    const { count: remaining } = await svc
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .neq("status", "cancelled");
    if ((remaining ?? 0) > 0) return;

    const { error } = await svc
      .from("sessions")
      .update({ meet_status: "release_pending" })
      .eq("id", sessionId);
    if (error) {
      // Most likely the 0038 check constraint is not applied yet.
      console.error("[cancel-booking] could not flag Meet release:", error.message);
    }
  } catch (err) {
    console.error("[cancel-booking] could not flag Meet release:", err);
  }
}
