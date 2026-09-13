// delete-account: the customer's own App Store Guideline 5.1.1(v) self-delete,
// without Vercel.
//
// Exists for the same reason `book-session` and `cancel-booking` do: the native
// iOS client cannot call /api/account/delete. That route authenticates with
// `createSupabaseServerClient()`, which is cookie-bound, so a native Bearer
// token gets a 401. The app used to hand off to the hosted profile page in a
// WebView; it now has a native screen that calls this instead.
//
// ============================================================================
// THIS IS A SECOND COPY OF lib/account/deleteAccount.ts. KEEP THEM IN STEP.
// ============================================================================
// The ordering below is load-bearing and was worked out once, over there. It is
// duplicated here rather than shared because Deno cannot import the Next.js
// module (server-only, @/ aliases, the Vercel-OIDC Google client), and the
// admin delete path still calls the TypeScript one. If you change the cascade in
// either place, change it in both. The differences that are deliberate are
// marked `DIVERGES:` below; everything else must match.
//
// WHAT THIS DELIBERATELY DOES NOT DO
//
// Delete the Google Calendar event for sessions it cancels. `releaseSessionMeet`
// authenticates through Vercel OIDC -> GCP Workload Identity Federation, which
// no Edge Function can mint. So each affected session is marked
// meet_status='release_pending' and cron/meet-retry, which runs on Node with
// those credentials every few minutes, performs the deletion. Same trade-off
// `cancel-booking` already makes, and the same migration (0038) backs it.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Mirrors MEDICAL_DOCS_BUCKET in lib/medical/constants.ts. */
const MEDICAL_DOCS_BUCKET = "medical-documents";

/** Stamped on bookings cancelled by the deletion, matching /api/account/delete. */
const CANCELLATION_REASON = "account_deleted";

const TAG = "[delete-account]";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("BOOKING_ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function fail(error: string, status: number, message?: string) {
  return new Response(JSON.stringify(message ? { error, message } : { error }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  // Identity comes from the verified JWT ONLY. There is deliberately no user id
  // in the request body: this endpoint can delete the caller and nobody else.
  // Deleting somebody else is the admin path, which is a different surface with
  // a different role check.
  const authHeader = req.headers.get("Authorization") ?? "";
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return fail("unauthenticated", 401);

  const userId = user.id;

  // The Admin API, the storage purge and every write below are service-role
  // only. Each read is still filtered by the caller's own verified id.
  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Customers only. Teacher/admin identities are entangled with live
  //    operations and must be demoted/unlinked through the admin path first.
  //    FAIL CLOSED: if the role cannot be established (query error, missing
  //    profile row), refuse rather than risk deleting a teacher, which would
  //    unlink the live teachers record and fire the 0028 trigger revoking every
  //    student's medical-document share.
  const { data: profile, error: profileError } = await svc
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile) {
    console.error(`${TAG} role lookup failed:`, profileError?.message);
    return fail("role_check_failed", 500);
  }
  if (profile.role === "teacher" || profile.role === "admin") {
    return fail(
      "role_managed_account",
      403,
      "Teacher and admin accounts can't self-delete. Contact hello@myyogaclasses.fit and we'll take care of it.",
    );
  }

  // 2. Cancel FUTURE sessions this customer holds a live booking on. Bookings
  //    cascade away with the profile; the session rows do not, so without this
  //    the session survives as 'scheduled', the teacher's slot stays
  //    EXCLUDE-blocked and the Meet event stays on their calendar for a customer
  //    who no longer exists.
  await cancelFutureSessions(svc, userId);

  // 3. Settle in-flight bank transfers: reject still-pending rows, mirroring the
  //    admin reject path. After 0035 a detached pending row could never be
  //    verified (the grant needs a customer) and its payment-linked promo
  //    reservation is exempt from the stale sweep, so it would hold a max_uses /
  //    per_email slot forever.
  await settlePendingTransfers(svc, userId);

  // 4. Best-effort device-token cleanup.
  try {
    await svc.from("push_tokens").delete().eq("user_id", userId);
  } catch {
    /* table may not exist yet (migration 0034) */
  }

  // 5. Delete the auth user; cascading FKs remove the rest of their data
  //    (including medical_documents rows). payments / discount_redemptions
  //    detach instead of deleting (0035) because UAE VAT / India GST require
  //    retaining transaction records for years. 5.1.1(v) explicitly allows
  //    keeping data required by law.
  const { error: deleteErr } = await svc.auth.admin.deleteUser(userId);
  if (deleteErr) {
    // Nothing irreversible has happened to the documents yet; the customer can
    // simply retry. Don't leak the Admin API error text to the caller.
    console.error(`${TAG} deleteUser failed:`, deleteErr.message);
    return fail("delete_failed", 500);
  }

  // 6. Purge the private health documents from Storage. Storage objects are NOT
  //    FK-cascaded. This runs AFTER deleteUser on purpose: the irreversible PHI
  //    purge must sit behind the point of no return, otherwise a deleteUser
  //    failure leaves an account whose medical_documents rows point at deleted
  //    bytes. In this order a failed purge leaves only orphaned OBJECTS, which
  //    the medical-orphan-sweep cron collects.
  await purgeDocuments(svc, userId);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

/**
 * Cancel every not-yet-started session the customer still holds a live booking
 * on, mirroring the admin cancel cascade (session -> bookings -> Meet cleanup).
 *
 * Never throws. An orphaned scheduled session is recoverable by an admin, and
 * blocking the deletion on it would fail 5.1.1(v).
 */
async function cancelFutureSessions(svc: ReturnType<typeof createClient>, userId: string): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    const { data: futureBookings } = await svc
      .from("bookings")
      .select("session_id, sessions!inner(id, status, start_at, meet_event_id)")
      .eq("customer_id", userId)
      .neq("status", "cancelled")
      .gt("sessions.start_at", nowIso);

    for (const row of futureBookings ?? []) {
      const session = (row as unknown as {
        sessions: {
          id: string;
          status: string;
          start_at: string;
          meet_event_id: string | null;
        };
      }).sessions;
      if (!session || session.status === "cancelled") continue;

      await svc.from("sessions").update({ status: "cancelled" }).eq("id", session.id);
      await svc
        .from("bookings")
        .update({
          status: "cancelled",
          cancellation_reason: CANCELLATION_REASON,
          cancelled_at: nowIso,
        })
        .eq("session_id", session.id)
        .neq("status", "cancelled");

      // DIVERGES: the TypeScript cascade calls releaseSessionMeet() here and
      // deletes the Calendar event synchronously. Deno cannot mint Vercel OIDC,
      // so the event is flagged for cron/meet-retry instead. See the header.
      if (session.meet_event_id) {
        const { error } = await svc
          .from("sessions")
          .update({ meet_status: "release_pending" })
          .eq("id", session.id);
        if (error) {
          // Most likely the 0038 check constraint is not applied yet. Best
          // effort on purpose: a deletion that succeeded must not be reported as
          // failed because a calendar tidy-up could not be scheduled.
          console.error(`${TAG} could not flag Meet release:`, error.message);
        }
      }
    }
  } catch (err) {
    console.error(`${TAG} future-session cleanup failed:`, err);
  }
}

/**
 * Reject still-pending bank transfers (status -> failed, then release the promo
 * reservation), mirroring the admin reject path.
 *
 * Never throws. An admin can still reject the detached row by hand.
 */
async function settlePendingTransfers(svc: ReturnType<typeof createClient>, userId: string): Promise<void> {
  try {
    const { data: pendingTransfers } = await svc
      .from("payments")
      .select("id")
      .eq("customer_id", userId)
      .eq("method", "bank_transfer")
      .eq("status", "pending");

    for (const p of pendingTransfers ?? []) {
      await svc
        .from("payments")
        .update({ status: "failed" })
        .eq("id", p.id)
        .eq("status", "pending");
      await svc.rpc("release_discount_redemption", { p_payment_id: p.id });
    }
  } catch (err) {
    console.error(`${TAG} bank-transfer settlement failed:`, err);
  }
}

/**
 * Remove the customer's health-document bytes, addressed by owner-folder prefix.
 *
 * Never throws. Anything left behind is exactly what the medical-orphan-sweep
 * cron collects, and the metadata rows are already gone via the cascade.
 */
async function purgeDocuments(svc: ReturnType<typeof createClient>, userId: string): Promise<void> {
  try {
    const { data: listed } = await svc.storage.from(MEDICAL_DOCS_BUCKET).list(userId);
    if (listed && listed.length > 0) {
      await svc.storage
        .from(MEDICAL_DOCS_BUCKET)
        .remove(listed.map((o) => `${userId}/${o.name}`));
    }
  } catch (err) {
    console.error(`${TAG} storage cleanup failed:`, err);
  }
}
