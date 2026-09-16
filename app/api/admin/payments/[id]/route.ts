import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { PaymentActionResponse } from "@/lib/admin/contracts";
import { writeAuditLog } from "@/lib/admin/audit";
import { requireAdminApi } from "@/lib/auth/apiGuards";
import { getRazorpayClient, isRazorpayConfigured } from "@/lib/razorpay/client";
import { reverseRazorpayPayment } from "@/lib/razorpay/fulfillment";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// grant_session_credits + service-role client + the Razorpay SDK; Node runtime.
export const runtime = "nodejs";

/**
 * POST /api/admin/payments/[id] — admin actions on a single payment row.
 * Middleware does not run on /api/*, so this authes itself and re-checks the
 * admin role inline (requireAdminApi does both on the cookie-bound client).
 *
 *   action: "verify" → grant the pack's credits, then mark the payment
 *            completed. The grant runs FIRST and ALWAYS (it's purchase-once on
 *            the payment id, so a re-verify is a no-op and a verify whose grant
 *            previously failed self-heals); ordering it before the conditional
 *            status flip means a grant failure leaves the row retryable, never
 *            stranded 'completed' with no credits.
 *   action: "reject" → mark a still-pending transfer failed (no credits).
 *   action: "resync" → ask Razorpay what actually happened to this payment and
 *            reconcile the row to that answer. The manual backstop while
 *            RAZORPAY_WEBHOOK_SECRET is unset in production, which is why
 *            refunds are not reconciling automatically today.
 *   action: "record_refund" → the studio refunded out of band. Claw the granted
 *            sessions back and mark the row refunded. Only a 'completed' row,
 *            and only once: 'refunded' is terminal.
 *
 * verify and reject are restricted to rows an admin owns (bank_transfer or
 * admin_manual); resync and record_refund are not, because they only reconcile
 * the row to what Razorpay reports. See the adminActionable comment below.
 */
const schema = z.object({
  action: z.enum(["verify", "reject", "resync", "record_refund"]),
  // record_refund only. The REAL Razorpay refund id, never synthesised:
  // clawback_session_credits dedupes on external_ref (0019), so a made-up ref
  // would let a later genuine refund webhook claw back a SECOND time.
  refundReference: z.string().trim().min(3).max(64).optional(),
  reason: z.string().trim().max(500).optional(),
});

/** Razorpay SDK errors are plain objects with a string-or-number statusCode. */
function razorpayStatus(err: unknown): number | null {
  if (!err || typeof err !== "object" || !("statusCode" in err)) return null;
  const raw = (err as { statusCode: unknown }).statusCode;
  const code = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(code) ? code : null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const gate = await requireAdminApi();
  if (gate instanceof NextResponse) return gate;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { action, refundReference, reason } = parsed.data;

  const svc = createSupabaseServiceClient();
  const { data: payment } = await svc
    .from("payments")
    .select("id, customer_id, plan_id, method, status, entry_source, razorpay_payment_id, paid_at")
    .eq("id", id)
    .maybeSingle();
  if (!payment) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // A provenance guard, not a rail guard. The old check was
  // `method !== "bank_transfer"`, which locked an admin out of the very rows
  // they had just created by hand: a manual row stranded at 'pending' by a
  // grant failure was recoverable only from psql. What must stay untouchable is
  // an AUTOMATICALLY fulfilled Razorpay row, whose credits and status the
  // webhook owns, and entry_source is what distinguishes the two.
  //
  // It gates only the two actions that hand-write an outcome. verify and reject
  // decide, from nothing but the operator's say-so, whether money counts and
  // whether sessions are released. resync and record_refund decide nothing: both
  // reconcile the row to what Razorpay already reports, which is exactly what an
  // automatically fulfilled row needs while RAZORPAY_WEBHOOK_SECRET is unset in
  // production and refunds are therefore not reconciling on their own. Applying
  // this guard to all four shut the backstop out of the entire population it was
  // written for, while the UI went on offering Resync on those rows.
  const adminActionable =
    payment.method === "bank_transfer" || payment.entry_source === "admin_manual";

  if (action === "reject") {
    if (!adminActionable) {
      return NextResponse.json({ error: "not_admin_verifiable" }, { status: 400 });
    }
    // Don't claim "rejected" for a row that isn't actually pending — a completed
    // (credited) row must not look rejected, and a stale call should say so.
    if (payment.status === "completed") {
      return NextResponse.json({ error: "already_completed" }, { status: 409 });
    }
    if (payment.status !== "pending") {
      return NextResponse.json({ error: "not_pending" }, { status: 409 });
    }
    await svc
      .from("payments")
      .update({ status: "failed", verified_by: gate.userId, verified_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending");
    // Free any reserved promo use back to the pool (no-op when none was applied,
    // which is always the case for a hand-entered row).
    const { error: relErr } = await svc.rpc("release_discount_redemption", { p_payment_id: id });
    if (relErr) {
      Sentry.captureMessage(`payment reject: promo release failed (payment ${id}): ${relErr.message}`, "warning");
    }
    await writeAuditLog(svc, {
      actorId: gate.userId,
      action: "admin_reject_payment",
      entityType: "payment",
      entityId: id,
      payload: { customer_id: payment.customer_id, plan_id: payment.plan_id, reason: reason ?? null },
    });
    return NextResponse.json({ ok: true, status: "failed" } satisfies PaymentActionResponse);
  }

  if (action === "record_refund") {
    if (!refundReference) return NextResponse.json({ error: "bad request" }, { status: 400 });
    // 'refunded' is terminal, and this is the only thing that makes it so.
    // clawback_session_credits dedupes on external_ref alone, and the 'purchase'
    // ledger row it sizes the clawback from never changes, so a second call
    // carrying a DIFFERENT reference (an admin correcting the bank reference,
    // say) would happily debit the customer a second time for one purchase.
    if (payment.status === "refunded") {
      return NextResponse.json({ error: "refunded_payment" }, { status: 409 });
    }
    // Only money we actually took can be given back. A pending or rejected row
    // released no sessions, so relabelling it 'refunded' would bury the reason
    // it never completed and claw back nothing.
    if (payment.status !== "completed") {
      return NextResponse.json({ error: "not_completed" }, { status: 409 });
    }
    // 0035: a self-deleted account detaches its payments for VAT/GST retention.
    // There is no balance left to claw back from.
    if (!payment.customer_id) {
      return NextResponse.json({ error: "payment_detached" }, { status: 400 });
    }

    let clawedBack: number;

    if (payment.razorpay_payment_id) {
      // Route through the single reversal point so the promo release, the
      // refund-once dedupe and the status flip all behave exactly as they do on
      // the webhook path.
      if (!isRazorpayConfigured()) {
        return NextResponse.json({ error: "razorpay_not_configured" }, { status: 503 });
      }
      let result;
      try {
        result = await reverseRazorpayPayment(payment.razorpay_payment_id, refundReference);
      } catch (err) {
        Sentry.captureException(err, { tags: { route: "admin/payments/[id]", op: "record_refund" } });
        return NextResponse.json({ error: "upstream_error" }, { status: 502 });
      }
      if (!result.ok) {
        if (result.reason === "payment_detached") {
          return NextResponse.json({ error: "payment_detached" }, { status: 400 });
        }
        if (result.reason === "partial_refund_manual") {
          // Which sessions to reclaim for a part refund is a product decision,
          // not something to guess at from an amount.
          return NextResponse.json(
            {
              error: "bad request",
              message:
                "Razorpay reports only a partial refund on that payment, so the sessions to reclaim are a judgement call. Adjust the balance by hand instead.",
            },
            { status: 409 },
          );
        }
        if (result.reason === "payment_not_found") {
          return NextResponse.json({ error: "not_found" }, { status: 404 });
        }
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
      }
      clawedBack = result.clawedBack;
    } else {
      // A cash / UPI / wire row. Size the clawback from the ledger row the
      // purchase wrote, which is the same figure reverseRazorpayPayment uses.
      const { data: grant } = await svc
        .from("credit_ledger")
        .select("delta")
        .eq("payment_id", payment.id)
        .eq("reason", "purchase")
        .maybeSingle();
      const granted = grant?.delta ?? 0;

      if (granted > 0) {
        const { error: clawErr } = await svc.rpc("clawback_session_credits", {
          p_customer: payment.customer_id,
          p_amount: granted,
          p_external_ref: refundReference,
          p_payment_id: payment.id,
        });
        if (clawErr) return NextResponse.json({ error: "update_failed" }, { status: 500 });
      }

      // Conditioned on 'completed' the way verify and reject condition theirs,
      // so a concurrent reversal cannot be double-counted here.
      const { error: updErr } = await svc
        .from("payments")
        .update({ status: "refunded" })
        .eq("id", payment.id)
        .eq("status", "completed");
      if (updErr) return NextResponse.json({ error: "update_failed" }, { status: 500 });
      clawedBack = granted;
    }

    await writeAuditLog(svc, {
      actorId: gate.userId,
      action: "admin_record_refund",
      entityType: "payment",
      entityId: id,
      payload: {
        customer_id: payment.customer_id,
        refund_reference: refundReference,
        clawed_back: clawedBack,
        reason: reason ?? null,
      },
    });

    const { data: bal } = await svc
      .from("customer_credits")
      .select("balance")
      .eq("customer_id", payment.customer_id)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      action: "record_refund",
      clawedBack,
      balance: bal?.balance ?? 0,
    } satisfies PaymentActionResponse);
  }

  if (action === "resync") {
    if (!payment.razorpay_payment_id) {
      return NextResponse.json({ error: "no_razorpay_id" }, { status: 400 });
    }
    if (!isRazorpayConfigured()) {
      return NextResponse.json({ error: "razorpay_not_configured" }, { status: 503 });
    }

    const rzp = getRazorpayClient();
    let remote;
    try {
      remote = await rzp.payments.fetch(payment.razorpay_payment_id);
    } catch (err) {
      const status = razorpayStatus(err);
      if (status === 400 || status === 404) {
        return NextResponse.json({ error: "razorpay_payment_not_found" }, { status: 404 });
      }
      if (status === 401) {
        return NextResponse.json({ error: "razorpay_unauthorized" }, { status: 502 });
      }
      Sentry.captureException(err, { tags: { route: "admin/payments/[id]", op: "resync" } });
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }

    const total = Number(remote.amount ?? 0);
    const refunded = Number(remote.amount_refunded ?? 0);
    const fullyRefunded = remote.refund_status === "full" || (total > 0 && refunded >= total);

    let outcome: "none" | "completed" | "reversed" = "none";
    let clawedBack: number | undefined;
    let balance: number | undefined;

    if (fullyRefunded) {
      // The refund id must be the REAL one: clawback_session_credits dedupes on
      // external_ref, so a synthesised ref would let the genuine refund webhook
      // claw back a second time. If we cannot read one, do nothing.
      let refundId: string | null = null;
      try {
        const refunds = await rzp.payments.fetchMultipleRefund(payment.razorpay_payment_id);
        refundId = refunds.items?.[0]?.id ?? null;
      } catch (err) {
        Sentry.captureException(err, { tags: { route: "admin/payments/[id]", op: "resync_refunds" } });
      }
      if (refundId) {
        const result = await reverseRazorpayPayment(payment.razorpay_payment_id, refundId);
        if (result.ok) {
          outcome = "reversed";
          clawedBack = result.clawedBack;
        } else {
          Sentry.captureMessage(
            `payment resync: reversal declined (payment ${id}): ${result.reason}`,
            "warning",
          );
        }
      }
    } else if (remote.status === "captured" && payment.status === "pending") {
      // Razorpay took the money and our row never caught up. Same grant-then-flip
      // as verify, for the same reason: a grant failure must leave it retryable.
      if (!payment.customer_id) {
        return NextResponse.json({ error: "payment_detached" }, { status: 400 });
      }
      if (!payment.plan_id) return NextResponse.json({ error: "missing_plan" }, { status: 400 });

      const { data: plan } = await svc
        .from("plans")
        .select("session_credits")
        .eq("id", payment.plan_id)
        .maybeSingle();
      const credits = plan?.session_credits ?? 0;
      if (credits <= 0) return NextResponse.json({ error: "no_credits_for_plan" }, { status: 400 });

      const { error: grantErr } = await svc.rpc("grant_session_credits", {
        p_customer: payment.customer_id,
        p_delta: credits,
        p_reason: "purchase",
        p_payment_id: payment.id,
      });
      if (grantErr) return NextResponse.json({ error: "grant_failed" }, { status: 500 });

      const { error: updErr } = await svc
        .from("payments")
        .update({
          status: "completed",
          verified_by: gate.userId,
          verified_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "pending");
      if (updErr) return NextResponse.json({ error: "update_failed" }, { status: 500 });

      outcome = "completed";
      const { data: bal } = await svc
        .from("customer_credits")
        .select("balance")
        .eq("customer_id", payment.customer_id)
        .maybeSingle();
      balance = bal?.balance ?? credits;
    }

    // Stamped whatever the answer was: "we asked Razorpay and this row matches
    // what it said" is the useful fact, including when nothing needed doing.
    await svc
      .from("payments")
      .update({ reconciled_at: new Date().toISOString() })
      .eq("id", id);

    await writeAuditLog(svc, {
      actorId: gate.userId,
      action: "admin_resync_payment",
      entityType: "payment",
      entityId: id,
      payload: {
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_status: remote.status,
        outcome,
        clawed_back: clawedBack ?? null,
      },
    });

    const body: Extract<PaymentActionResponse, { action: "resync" }> = {
      ok: true,
      action: "resync",
      razorpayStatus: remote.status,
      outcome,
    };
    if (clawedBack !== undefined) body.clawedBack = clawedBack;
    if (balance !== undefined) body.balance = balance;
    return NextResponse.json(body);
  }

  // verify -----------------------------------------------------------------
  if (!adminActionable) {
    return NextResponse.json({ error: "not_admin_verifiable" }, { status: 400 });
  }
  // Pending or already-completed can be (re-)verified; failed/refunded are terminal.
  if (payment.status !== "pending" && payment.status !== "completed") {
    return NextResponse.json({ error: "not_pending" }, { status: 409 });
  }
  if (!payment.customer_id) {
    return NextResponse.json({ error: "payment_detached" }, { status: 400 });
  }
  if (!payment.plan_id) {
    return NextResponse.json({ error: "missing_plan" }, { status: 400 });
  }

  const { data: plan } = await svc
    .from("plans")
    .select("session_credits")
    .eq("id", payment.plan_id)
    .maybeSingle();
  const credits = plan?.session_credits ?? 0;
  if (credits <= 0) return NextResponse.json({ error: "no_credits_for_plan" }, { status: 400 });

  // Grant FIRST and ALWAYS. grant_session_credits is idempotent on the payment id
  // (purchase-once ledger index), so a re-verify is a no-op and a verify whose
  // earlier grant failed self-heals on retry. Granting before the status flip
  // means a grant failure leaves the row 'pending' (still retryable) instead of
  // stranded 'completed' with no credits.
  const { error: grantErr } = await svc.rpc("grant_session_credits", {
    p_customer: payment.customer_id,
    p_delta: credits,
    p_reason: "purchase",
    p_payment_id: payment.id,
  });
  if (grantErr) return NextResponse.json({ error: "grant_failed" }, { status: 500 });

  // Record the verification — only flips a still-pending row (a concurrent verify
  // or a re-verify of an already-completed row is a harmless no-op here).
  //
  // paid_at is only filled in when it is still empty. A bank transfer has none
  // until it is verified, so the behaviour there is unchanged, but a
  // hand-entered row already carries the REAL capture time the admin typed, and
  // this is the path that recovers one stranded by a grant failure. Overwriting
  // it with now() would move that money into the wrong month for admin_kpis.
  const verifiedAt = new Date().toISOString();
  const { error: updErr } = await svc
    .from("payments")
    .update({
      status: "completed",
      ...(payment.paid_at ? {} : { paid_at: verifiedAt }),
      verified_by: gate.userId,
      verified_at: verifiedAt,
    })
    .eq("id", id)
    .eq("status", "pending");
  if (updErr) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  // Commit any reserved promo use exactly once (idempotent; advances times_used).
  // Non-fatal: the credits are already granted, so a commit hiccup must not fail
  // the verify — the stale sweep is the backstop.
  const { error: commitErr } = await svc.rpc("commit_discount_redemption_by_payment", {
    p_payment_id: payment.id,
  });
  if (commitErr) {
    Sentry.captureMessage(`payment verify: promo commit failed (payment ${payment.id}): ${commitErr.message}`, "warning");
  }

  await writeAuditLog(svc, {
    actorId: gate.userId,
    action: "admin_verify_payment",
    entityType: "payment",
    entityId: id,
    payload: {
      customer_id: payment.customer_id,
      plan_id: payment.plan_id,
      credits,
      method: payment.method,
      reason: reason ?? null,
    },
  });

  const { data: bal } = await svc
    .from("customer_credits")
    .select("balance")
    .eq("customer_id", payment.customer_id)
    .maybeSingle();
  return NextResponse.json({
    ok: true,
    status: "completed",
    balance: bal?.balance ?? credits,
  } satisfies PaymentActionResponse);
}
