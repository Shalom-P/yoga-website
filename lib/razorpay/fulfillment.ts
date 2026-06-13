import "server-only";

import { getRazorpayClient } from "./client";
import { resolvePackById } from "./catalog";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

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

  // The payment must belong to this order and the money must have SETTLED. An
  // `authorized` payment is only a hold that can still void/expire — granting
  // credits on it would release value before capture. Require `captured`; the
  // capture webhook arrives separately and fulfils then.
  if (payment.order_id !== orderId) return { ok: false, reason: "order_mismatch" };
  if (payment.status !== "captured") return { ok: false, reason: `not_paid:${payment.status}` };
  // Defence-in-depth: the captured amount + currency must match the order.
  if (Number(payment.amount) !== Number(order.amount)) {
    return { ok: false, reason: "amount_mismatch" };
  }
  if (order.currency && payment.currency && payment.currency !== order.currency) {
    return { ok: false, reason: "currency_mismatch" };
  }

  const notes = (order.notes ?? {}) as Record<string, string | number>;
  const customerId = typeof notes.customerId === "string" ? notes.customerId : undefined;
  const planId = typeof notes.planId === "string" ? notes.planId : undefined;
  if (!customerId || !planId) return { ok: false, reason: "missing_notes" };
  // When called from the per-user verify endpoint, the order must belong to the
  // caller — a signed-in user can't force-fulfil (or read the balance of)
  // someone else's pending payment. The webhook omits this (it has no user).
  if (opts.expectedCustomerId && customerId !== opts.expectedCustomerId) {
    return { ok: false, reason: "customer_mismatch" };
  }

  const pack = await resolvePackById(planId);
  if (!pack) return { ok: false, reason: "plan_not_found" };

  const svc = createSupabaseServiceClient();

  // Record the payment (idempotent on razorpay_payment_id).
  const { data: paymentRow, error: payErr } = await svc
    .from("payments")
    .upsert(
      {
        razorpay_payment_id: paymentId,
        razorpay_order_id: orderId,
        customer_id: customerId,
        amount_aud_cents: Number(payment.amount),
        currency: payment.currency ?? "AUD",
        status: "completed",
        paid_at: new Date().toISOString(),
      },
      { onConflict: "razorpay_payment_id" },
    )
    .select("id")
    .single();
  if (payErr || !paymentRow) return { ok: false, reason: "payment_record_failed" };

  // Grant the pack's credits — idempotent on the payment row (a replay is a no-op).
  const { error: grantErr } = await svc.rpc("grant_session_credits", {
    p_customer: customerId,
    p_delta: pack.sessionCredits,
    p_reason: "purchase",
    p_payment_id: paymentRow.id,
  });
  if (grantErr) return { ok: false, reason: "grant_failed" };

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

  await svc.from("payments").update({ status: "refunded" }).eq("id", paymentRow.id);
  return { ok: true, clawedBack: granted };
}
