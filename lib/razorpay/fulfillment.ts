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
): Promise<FulfillResult> {
  const rzp = getRazorpayClient();

  // Pull the order (carries our notes) and the payment (proves money moved).
  const [order, payment] = await Promise.all([
    rzp.orders.fetch(orderId),
    rzp.payments.fetch(paymentId),
  ]);

  // The payment must belong to this order and actually be paid. A valid signature
  // alone never proves capture — this does.
  if (payment.order_id !== orderId) return { ok: false, reason: "order_mismatch" };
  const paid = payment.status === "captured" || payment.status === "authorized";
  if (!paid) return { ok: false, reason: `not_paid:${payment.status}` };
  // Defence-in-depth: the captured amount must match the order we created.
  if (Number(payment.amount) !== Number(order.amount)) {
    return { ok: false, reason: "amount_mismatch" };
  }

  const notes = (order.notes ?? {}) as Record<string, string | number>;
  const customerId = typeof notes.customerId === "string" ? notes.customerId : undefined;
  const planId = typeof notes.planId === "string" ? notes.planId : undefined;
  if (!customerId || !planId) return { ok: false, reason: "missing_notes" };

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
