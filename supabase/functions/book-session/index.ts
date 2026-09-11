// book-session: create a booking without Vercel.
//
// Exists so the native iOS client can book directly. `book_session` has EXECUTE
// revoked from `authenticated` (migration 0017), so no client may call it with a
// user token; this function holds the service-role key and is the only thing
// that does. The RPC keeps its boundary.
//
// WHAT THIS DELIBERATELY DOES NOT DO
//
// Google Meet provisioning. `provisionSessionMeet` authenticates through Vercel
// OIDC -> GCP Workload Identity Federation, which no Edge Function can mint.
// It is not needed here: `book_session` inserts sessions with
// meet_status='pending', and cron/meet-retry sweeps
// .in("meet_status", ["pending","failed"]) every 10 minutes and backfills the
// link. The dashboard already degrades to "Link available shortly", which is the
// shipped behaviour for provisioning failures. The link therefore arrives within
// a cron interval instead of synchronously.
//
// Confirmation email and analytics. Those live in lib/email and lib/analytics on
// the Node side, and forking the template into Deno would diverge the copy. The
// proxy route sends the email after a successful call. A native client calling
// this function DIRECTLY would not send one, so consolidating the template is a
// prerequisite before the iOS app stops going through the proxy.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  slotInsideAvailability,
  teacherDateISO,
  type AvailabilityWindow,
} from "../_shared/availability.ts";

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

type Payload = {
  teacherId: string;
  startAt: string;
  durationMinutes: number;
  isFreeTrial: boolean;
};

/** Hand-rolled rather than pulling zod into the bundle; the shape is four fields. */
function parsePayload(raw: unknown): Payload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const b = raw as Record<string, unknown>;

  if (typeof b.teacherId !== "string" || !UUID.test(b.teacherId)) return null;
  if (typeof b.startAt !== "string") return null;

  const duration = b.durationMinutes === undefined ? 60 : b.durationMinutes;
  if (typeof duration !== "number" || !Number.isInteger(duration)) return null;
  if (duration < 15 || duration > 180) return null;

  const isFreeTrial = b.isFreeTrial === undefined ? true : b.isFreeTrial;
  if (typeof isFreeTrial !== "boolean") return null;

  return { teacherId: b.teacherId, startAt: b.startAt, durationMinutes: duration, isFreeTrial };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  // Identity comes from the verified JWT only. A caller-supplied customer id
  // would let anyone book, and spend credits, as anyone else.
  const authHeader = req.headers.get("Authorization") ?? "";
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return fail("unauthenticated", 401);

  const parsed = parsePayload(await req.json().catch(() => null));
  if (!parsed) return fail("bad request", 400);

  const start = new Date(parsed.startAt);
  if (Number.isNaN(start.getTime())) return fail("bad request", 400);
  if (start.getTime() < Date.now() + 15 * 60_000) return fail("slot_in_past", 400);
  const end = new Date(start.getTime() + parsed.durationMinutes * 60_000);

  // sessions/bookings have admin-only INSERT RLS, and book_session is
  // service-role only, so the writes below need this client.
  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: teacher } = await svc
    .from("teachers")
    .select("id, display_name, timezone, is_active")
    .eq("id", parsed.teacherId)
    .single();
  if (!teacher || !teacher.is_active) return fail("teacher_not_found", 404);

  const teacherTz = teacher.timezone || "Asia/Kolkata";

  const { data: availability } = await svc
    .from("teacher_availability")
    .select("day_of_week, start_time, end_time, slot_duration_minutes")
    .eq("teacher_id", teacher.id);
  if (!availability || availability.length === 0) return fail("slot_unavailable", 409);

  if (
    !slotInsideAvailability(
      start,
      end,
      parsed.durationMinutes,
      teacherTz,
      availability as AvailabilityWindow[],
    )
  ) {
    return fail("slot_unavailable", 409);
  }

  // A blocked one-off date is never bookable, even when it matches the weekly
  // window above.
  const { data: overrides } = await svc
    .from("teacher_slot_overrides")
    .select("is_blocked")
    .eq("teacher_id", teacher.id)
    .eq("date", teacherDateISO(start, teacherTz));
  if (overrides?.some((o: { is_blocked: boolean }) => o.is_blocked)) {
    return fail("slot_unavailable", 409);
  }

  // One transaction: spend a credit (paid only), insert session, insert booking,
  // link the ledger. sessions_no_overlap (23P01) makes double-booking impossible
  // with no SELECT-then-INSERT window; 23505 is the one-free-trial index.
  const { data: booked, error: bookErr } = await svc
    .rpc("book_session", {
      p_customer: user.id,
      p_teacher: teacher.id,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
      p_is_free_trial: parsed.isFreeTrial,
    })
    .single();

  if (bookErr || !booked) {
    const code = (bookErr as { code?: string } | null)?.code;
    const message = (bookErr as { message?: string } | null)?.message ?? "";
    if (code === "23P01") return fail("slot_taken", 409);
    if (code === "23505") return fail("trial_already_claimed", 409);
    if (message.includes("insufficient_credits")) return fail("insufficient_credits", 402);
    if (message.includes("slot_blocked")) return fail("slot_unavailable", 409);
    console.error("[book-session] book_session failed:", message);
    return fail("booking_failed", 500);
  }

  const row = booked as { booking_id: string; session_id: string };
  // teacherName and startAt come back so the caller can send the confirmation
  // email without re-querying.
  return new Response(
    JSON.stringify({
      bookingId: row.booking_id,
      sessionId: row.session_id,
      teacherName: teacher.display_name,
      startAt: start.toISOString(),
    }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
