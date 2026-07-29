import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { MEDICAL_DOCS_BUCKET } from "@/lib/medical/constants";
import { releaseSessionMeet } from "@/lib/google/provisionMeet";

// Node runtime: uses the service role + Supabase Admin API.
export const runtime = "nodejs";

/**
 * POST /api/account/delete — permanently delete the signed-in customer's account.
 *
 * Required by App Store Guideline 5.1.1(v) for any app with account creation.
 * Order matters:
 *   1. Refuse teacher/admin accounts — deleting a teacher login leaves the live
 *      `teachers` record dangling (profile_id SET NULL keeps it listed and its
 *      future sessions RESTRICT-blocked) and fires the 0028 trigger that revokes
 *      every student's medical-document share. Those roles go through the admin
 *      demote path instead.
 *   2. Cancel the customer's FUTURE sessions the same way admin-cancel does.
 *      `sessions` has no customer FK, so without this the session row survives
 *      the cascade as 'scheduled': the teacher's slot stays EXCLUDE-blocked and
 *      the Meet event stays on their calendar for a customer who no longer exists.
 *   3. Settle in-flight bank transfers: reject still-`pending` rows (mirroring
 *      admin reject, including releasing any promo reservation). After 0035 a
 *      detached pending row could never be verified (grant needs a customer) and
 *      its payment-linked promo reservation is exempt from the stale sweep, so it
 *      would hold a max_uses / per_email slot forever.
 *   4. `auth.admin.deleteUser` — cascades profiles → medical_documents, bookings,
 *      credits, shares… Financial records (payments, discount_redemptions) are
 *      deliberately NOT cascaded since migration 0035: they detach (customer_id
 *      SET NULL) because UAE VAT / India GST require retaining transaction
 *      records for years. 5.1.1(v) explicitly allows keeping data required by law.
 *   5. Purge private health documents from Storage — Storage objects are NOT
 *      FK-cascaded. This runs AFTER deleteUser on purpose: the irreversible PHI
 *      purge must sit behind the point of no return, otherwise a deleteUser
 *      failure leaves an account whose medical_documents rows point at deleted
 *      bytes (broken downloads for the owner and every shared teacher, and
 *      nothing ever cleans the rows up). In this order a failed purge leaves
 *      only orphaned OBJECTS, which the medical-orphan-sweep cron collects.
 */
export async function POST(): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();

  // 1. Customers only. Teacher/admin identities are entangled with live
  //    operations and must be demoted/unlinked through the admin path first.
  //    FAIL CLOSED: if the role can't be established (query error, missing
  //    profile row), refuse to delete rather than risk deleting a teacher —
  //    which would unlink the live teachers record and fire the 0028 trigger
  //    revoking every student's medical-document share.
  const { data: profile, error: profileError } = await svc
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profileError || !profile) {
    console.error("[account/delete] role lookup failed:", profileError?.message);
    return NextResponse.json({ error: "role_check_failed" }, { status: 500 });
  }
  if (profile.role === "teacher" || profile.role === "admin") {
    return NextResponse.json(
      {
        error: "role_managed_account",
        message:
          "Teacher and admin accounts can't self-delete. Contact hello@myyogaclasses.fit and we'll take care of it.",
      },
      { status: 403 },
    );
  }

  // 2. Cancel future sessions this customer holds a live booking on, mirroring
  //    the admin cancel cascade (session → bookings → Meet cleanup). Bookings
  //    would cascade away with the profile anyway; the session rows would not.
  try {
    const nowIso = new Date().toISOString();
    const { data: futureBookings } = await svc
      .from("bookings")
      .select("session_id, sessions!inner(id, status, start_at, meet_event_id, meet_calendar_id)")
      .eq("customer_id", user.id)
      .neq("status", "cancelled")
      .gt("sessions.start_at", nowIso);

    for (const row of futureBookings ?? []) {
      const session = (row as unknown as {
        sessions: {
          id: string;
          status: string;
          start_at: string;
          meet_event_id: string | null;
          meet_calendar_id: string | null;
        };
      }).sessions;
      if (!session || session.status === "cancelled") continue;

      await svc.from("sessions").update({ status: "cancelled" }).eq("id", session.id);
      await svc
        .from("bookings")
        .update({
          status: "cancelled",
          cancellation_reason: "account_deleted",
          cancelled_at: nowIso,
        })
        .eq("session_id", session.id)
        .neq("status", "cancelled");
      if (session.meet_event_id) {
        // Best-effort: remove the Calendar/Meet event so it disappears from the
        // teacher's schedule too.
        await releaseSessionMeet(session).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[account/delete] future-session cleanup failed:", err);
    // Continue — an orphaned scheduled session is recoverable by an admin,
    // and blocking deletion on it would fail 5.1.1(v).
  }

  // 3. Reject still-pending bank transfers, mirroring the admin reject path
  //    (status → failed + release the promo reservation). A pending row that
  //    detaches via 0035 could never complete (verify grants credits to a
  //    customer that no longer exists), and its payment-linked promo
  //    reservation is exempt from the stale-reservation sweep.
  try {
    const { data: pendingTransfers } = await svc
      .from("payments")
      .select("id")
      .eq("customer_id", user.id)
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
    console.error("[account/delete] bank-transfer settlement failed:", err);
    // Continue — an admin can still reject the detached row by hand.
  }

  // 4. Best-effort device-token cleanup (push_tokens not in generated types yet).
  try {
    await (svc as unknown as SupabaseClient)
      .from("push_tokens")
      .delete()
      .eq("user_id", user.id);
  } catch {
    /* table may not exist yet (migration 0034) */
  }

  // 5. Delete the auth user; cascading FKs remove the rest of their data
  //    (including medical_documents rows). payments / discount_redemptions
  //    detach instead of deleting (0035).
  const { error } = await svc.auth.admin.deleteUser(user.id);
  if (error) {
    // Nothing irreversible has happened to the user's documents yet; they can
    // simply retry. Don't leak the Admin API error text to the caller.
    console.error("[account/delete] deleteUser failed:", error.message);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  // 6. Purge the private health documents from Storage — after the point of no
  //    return (see header). The metadata rows are already gone via the cascade;
  //    remove the bytes by owner-folder prefix. Best-effort: anything left
  //    behind is exactly what the medical-orphan-sweep cron collects.
  try {
    const { data: listed } = await svc.storage.from(MEDICAL_DOCS_BUCKET).list(user.id);
    if (listed && listed.length > 0) {
      await svc.storage
        .from(MEDICAL_DOCS_BUCKET)
        .remove(listed.map((o) => `${user.id}/${o.name}`));
    }
  } catch (err) {
    console.error("[account/delete] storage cleanup failed:", err);
    // Continue — orphaned bytes are GC'd by the medical-orphan-sweep cron.
  }

  return NextResponse.json({ ok: true });
}
