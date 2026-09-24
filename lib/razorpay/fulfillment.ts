import "server-only";

import * as Sentry from "@sentry/nextjs";

import { getRazorpayClient } from "./client";
import { resolvePackById } from "./catalog";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { isMetaCapiConfigured, queueMetaEvent } from "@/lib/meta/capi";
import { metaContextFromNotes } from "@/lib/meta/shared";

/**
 * Idempotent fulfilment for a Razorpay one-time payment. Safe to call from BOTH
 * /api/razorpay/verify-payment (the client round-trip) and /api/razorpay/webhook
 * (the authoritative path) — whichever runs first wins, the other is a no-op:
 *   - payments is keyed on a UNIQUE razorpay_payment_id (upsert)
 *   - grant_session_credits is idempotent per payment (purchase-once ledger index)
 *
 * It re-derives everything from Razorpay (order notes + payment status), so the
 * client cannot influence who gets credited or how much. Never grant value from
 * a client `onPaid` callback — call this instead.
 */
export type FulfillResult =
  | { ok: true; customerId: string; credits: number }
  | { ok: false; reason: string };

export async function fulfillRazorpayPayment(
  orderId: string,
  paymentId: string,
  opts: { expectedCustomerId?: string } = {},
): Promise<FulfillResult> {
  const rzp = getRazorpayClient();

  // Pull the order (carries our notes) and the payment (proves money moved).
  const [order, payment] = await Promise.all([
    rzp.orders.fetch(orderId),
    rzp.payments.fetch(paymentId),
  ]);

  if (payment.order_id !== orderId) return { ok: false, reason: "order_mismatch" };

  // Attribute + authorise the order BEFORE any money action. An order we can't
  // map to a customer + plan (or, on the verify path, one the caller doesn't
  // own) must never be captured: leaving it as an authorized hold lets it expire
  // and return the funds, rather than capturing money we'd then refuse to
  // fulfil. All fields come from the notes we stamped at create-order.
  const notes = (order.notes ?? {}) as Record<string, string | number>;
  const customerId = typeof notes.customerId === "string" ? notes.customerId : undefined;
  const planId = typeof notes.planId === "string" ? notes.planId : undefined;
  const redemptionId =
    typeof notes.discountRedemptionId === "string" ? notes.discountRedemptionId : undefined;
  if (!customerId || !planId) return { ok: false, reason: "missing_notes" };
  // When called from the per-user verify endpoint, the order must belong to the
  // caller: a signed-in user can't force-fulfil, capture, or read the balance of
  // someone else's pending payment. The webhook omits this (it has no user).
  if (opts.expectedCustomerId && customerId !== opts.expectedCustomerId) {
    return { ok: false, reason: "customer_mismatch" };
  }

  // A successful Checkout can land as `authorized` (a hold) instead of
  // `captured`: either because account Auto-Capture is off, or because this
  // verify round-trip races Razorpay's own capture flip. Rather than dead-end a
  // customer who has already been charged (and lean on the capture webhook,
  // which is dead whenever RAZORPAY_WEBHOOK_SECRET is unset), capture it here for
  // the EXACT order amount + currency. Idempotent: it only fires while the
  // payment is still `authorized`, and a concurrent capture (verify vs webhook)
  // rejects with "already captured", which we absorb by re-reading the payment.
  let settled = payment;
  if (settled.status === "authorized") {
    try {
      settled = await rzp.payments.capture(paymentId, Number(order.amount), order.currency);
    } catch (err) {
      Sentry.captureMessage(
        `razorpay capture-on-authorized fell back to refetch (payment ${paymentId}): ${
          err instanceof Error ? err.message : "unknown error"
        }`,
        "info",
      );
      settled = await rzp.payments.fetch(paymentId);
    }
  }

  // The money must have SETTLED before we grant value. If it is still not
  // captured, bail: a genuinely pending/failed payment is left for the capture
  // webhook (the backstop) to fulfil once Razorpay settles it.
  if (settled.status !== "captured") return { ok: false, reason: `not_paid:${settled.status}` };
  // Defence-in-depth: the captured amount + currency must match the order.
  if (Number(settled.amount) !== Number(order.amount)) {
    return { ok: false, reason: "amount_mismatch" };
  }
  if (order.currency && settled.currency && settled.currency !== order.currency) {
    return { ok: false, reason: "currency_mismatch" };
  }

  const pack = await resolvePackById(planId);
  if (!pack) return { ok: false, reason: "plan_not_found" };

  const svc = createSupabaseServiceClient();

  // If a promo code was reserved at create-order, pull its discount so we can
  // stamp it on the payment row (queryable per-payment record of the promo used).
  let discountCodeId: string | null = null;
  let discountAmountCents: number | null = null;
  if (redemptionId) {
    const { data: redemption } = await svc
      .from("discount_redemptions")
      .select("discount_code_id, discount_amount_cents")
      .eq("id", redemptionId)
      .maybeSingle();
    if (redemption) {
      discountCodeId = redemption.discount_code_id;
      discountAmountCents = redemption.discount_amount_cents;
    }
  }

  // Read the row we may be about to overwrite. The upsert below conflicts on a
  // TOTAL unique index (0033), so it is an in-place UPDATE whenever this payment
  // is already on file — including when an admin put it there by hand.
  const { data: existing } = await svc
    .from("payments")
    .select("id, entry_source, customer_id, plan_id, paid_at")
    .eq("razorpay_payment_id", paymentId)
    .maybeSingle();

  // The commonest reason a payment is hand-entered is that the webhook missed
  // it, so the webhook arriving LATER is the expected case, not the exotic one.
  // The upsert writes customer_id from the ORDER NOTES: if the admin attributed
  // this payment to a different customer (or a different pack), the row would
  // silently flip to the notes customer while the credits stayed with the
  // admin's pick. Money and credits would then name different people, with no
  // error raised anywhere. Refuse, and make a human look.
  if (existing && existing.entry_source === "admin_manual") {
    const planMismatch = existing.plan_id != null && existing.plan_id !== planId;
    if (existing.customer_id !== customerId || planMismatch) {
      Sentry.captureException(
        new Error(`manual payment attribution conflict on ${paymentId}`),
        {
          tags: { module: "fulfillment" },
          extra: {
            manualCustomer: existing.customer_id,
            notesCustomer: customerId,
            manualPlan: existing.plan_id,
            notesPlan: planId,
          },
        },
      );
      await svc.from("audit_log").insert({
        actor_id: null,
        action: "manual_payment_attribution_conflict",
        entity_type: "payment",
        entity_id: existing.id,
        payload: {
          razorpay_payment_id: paymentId,
          manual_customer_id: existing.customer_id,
          notes_customer_id: customerId,
          manual_plan_id: existing.plan_id,
          notes_plan_id: planId,
        },
      });
      return { ok: false, reason: "manual_entry_conflict" };
    }
  }

  // Attributions agree, so this is a reconciliation rather than a first write.
  // Keep the capture time the admin recorded (admin_kpis buckets revenue on
  // paid_at), and let the row say it was later confirmed by Razorpay.
  const isManualReconcile = existing?.entry_source === "admin_manual";
  const paidAt =
    isManualReconcile && existing?.paid_at ? existing.paid_at : new Date().toISOString();

  // Record the payment (idempotent on razorpay_payment_id). plan_id, method,
  // reference, recorded_by and admin_note are absent from this object on
  // purpose, so a hand-entered row keeps them.
  const { data: paymentRow, error: payErr } = await svc
    .from("payments")
    .upsert(
      {
        razorpay_payment_id: paymentId,
        razorpay_order_id: orderId,
        customer_id: customerId,
        amount_cents: Number(settled.amount),
        // Razorpay reports the captured currency (AED/INR); the column has no
        // default, so always stamp it. INR fallback is defensive only.
        currency: settled.currency ?? "INR",
        status: "completed",
        discount_code_id: discountCodeId,
        discount_amount_cents: discountAmountCents,
        paid_at: paidAt,
        ...(isManualReconcile
          ? {
              entry_source: "admin_manual_reconciled" as const,
              reconciled_at: new Date().toISOString(),
            }
          : {}),
      },
      { onConflict: "razorpay_payment_id" },
    )
    .select("id")
    .single();
  if (payErr || !paymentRow) return { ok: false, reason: "payment_record_failed" };

  // Was this payment already granted by an earlier call? Read before the grant
  // so we know whether THIS call is the one that fulfils it (decides the Meta
  // Purchase below). payments.status can't answer that: the upsert above has
  // already written 'completed', including on an attempt whose grant then failed.
  const metaContext = metaContextFromNotes(notes);
  const reportToMeta = isMetaCapiConfigured() && !metaContext.optOut;
  const { data: priorGrant } = reportToMeta
    ? await svc
        .from("credit_ledger")
        .select("id")
        .eq("payment_id", paymentRow.id)
        .eq("reason", "purchase")
        .maybeSingle()
    : { data: null };

  // Grant the pack's credits — idempotent on the payment row (a replay is a no-op).
  const { error: grantErr } = await svc.rpc("grant_session_credits", {
    p_customer: customerId,
    p_delta: pack.sessionCredits,
    p_reason: "purchase",
    p_payment_id: paymentRow.id,
  });
  if (grantErr) return { ok: false, reason: "grant_failed" };

  // Commit the promo redemption exactly once (idempotent via the status guard).
  // Non-fatal: the credits are already granted, so a commit hiccup must not fail
  // fulfilment or trigger a webhook retry storm — the stale sweep is the backstop.
  if (redemptionId) {
    const { error: commitErr } = await svc.rpc("commit_discount_redemption", {
      p_redemption_id: redemptionId,
      p_order_id: orderId,
      p_payment_id: paymentRow.id,
    });
    if (commitErr) {
      Sentry.captureMessage(
        `discount redemption commit failed (payment ${paymentId}): ${commitErr.message}`,
        "warning",
      );
    }
  }

  // Report the sale to Meta once: only when this call's grant is the one that
  // fulfilled the payment. A replay or an admin resync days later would
  // otherwise land outside Meta's 48h dedupe window and count the purchase
  // twice, while a retry after a failed grant still reports it. A verify/webhook
  // race can send the same event_id twice, which Meta collapses.
  if (reportToMeta && !priorGrant) {
    const { data: buyer } = await svc
      .from("profiles")
      .select("email")
      .eq("id", customerId)
      .maybeSingle();
    queueMetaEvent({
      name: "Purchase",
      eventId: `purchase_${paymentId}`,
      context: metaContext,
      user: { email: buyer?.email, externalId: customerId },
      custom: {
        value: Number(settled.amount) / 100,
        currency: settled.currency ?? "INR",
        contentIds: [pack.slug],
        contentType: "product",
        numItems: 1,
      },
    });
  }

  const { data: bal } = await svc
    .from("customer_credits")
    .select("balance")
    .eq("customer_id", customerId)
    .maybeSingle();

  return { ok: true, customerId, credits: bal?.balance ?? 0 };
}

export type RefundResult =
  | { ok: true; clawedBack: number }
  | { ok: false; reason: string };

/**
 * Reverse a fulfilled Razorpay payment when it is refunded: claw back the
 * credits the purchase granted (idempotent on the refund id) and mark the
 * payment `refunded`. Only FULL refunds are auto-reconciled — a partial refund
 * is a product decision (which credits to reclaim) and is flagged for manual
 * handling rather than guessed at. Safe to call repeatedly (redelivered webhook).
 */
export async function reverseRazorpayPayment(
  paymentId: string,
  refundId: string,
): Promise<RefundResult> {
  const svc = createSupabaseServiceClient();

  // The payment row we recorded at fulfilment.
  const { data: paymentRow } = await svc
    .from("payments")
    .select("id, customer_id")
    .eq("razorpay_payment_id", paymentId)
    .maybeSingle();
  if (!paymentRow) return { ok: false, reason: "payment_not_found" };
  // 0035 made payments.customer_id nullable: a self-deleted account detaches its
  // financial history (VAT/GST retention) instead of destroying it. There is
  // nobody left to claw credits back from, and clawback_session_credits would
  // receive a null customer. The caller acks rather than retrying forever.
  if (!paymentRow.customer_id) return { ok: false, reason: "payment_detached" };

  // Only auto-clawback a FULL refund.
  const rzp = getRazorpayClient();
  const payment = await rzp.payments.fetch(paymentId);
  const total = Number(payment.amount ?? 0);
  const refunded = Number(payment.amount_refunded ?? 0);
  if (total > 0 && refunded < total) {
    return { ok: false, reason: "partial_refund_manual" };
  }

  // How many credits this payment granted (its 'purchase' ledger row).
  const { data: grant } = await svc
    .from("credit_ledger")
    .select("delta")
    .eq("payment_id", paymentRow.id)
    .eq("reason", "purchase")
    .maybeSingle();
  const granted = grant?.delta ?? 0;

  if (granted > 0) {
    const { error: clawErr } = await svc.rpc("clawback_session_credits", {
      p_customer: paymentRow.customer_id,
      p_amount: granted,
      p_external_ref: refundId,
      p_payment_id: paymentRow.id,
    });
    if (clawErr) return { ok: false, reason: "clawback_failed" };
  }

  // Free any promo use this payment committed back to the pool (idempotent on a
  // redelivered refund; a no-op when no promo was applied).
  const { error: releaseErr } = await svc.rpc("release_discount_redemption", {
    p_payment_id: paymentRow.id,
  });
  if (releaseErr) {
    Sentry.captureMessage(
      `discount redemption release failed (payment ${paymentId}): ${releaseErr.message}`,
      "warning",
    );
  }

  await svc.from("payments").update({ status: "refunded" }).eq("id", paymentRow.id);
  return { ok: true, clawedBack: granted };
}
