import "server-only";

import type { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Server-side promo-code application for credit-pack purchases. The discount is
 * always computed here (in the order currency) and the redemption is RESERVED
 * before the customer is charged, so the client can never set or tamper with the
 * amount. Both rails (Razorpay order + UAE bank transfer) share this path.
 *
 * Reserve at checkout-start (email known from the session), commit at fulfilment
 * (money settled) — see supabase/migrations/0032_discount_redemptions.sql.
 */

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

// Mirrors the `error` values returned by reserve_discount_redemption.
export type PromoErrorCode =
  | "invalid_code"
  | "code_exhausted"
  | "email_limit_reached"
  | "currency_not_allowed"
  | "amount_below_minimum"
  | "email_required"
  | "reserve_failed";

export type ReserveDiscountResult =
  | {
      ok: true;
      redemptionId: string;
      discountCodeId: string;
      discountAmountCents: number;
      finalAmountCents: number;
      code: string;
    }
  | { ok: false; error: PromoErrorCode };

/** Customer-facing copy for each rejection reason. */
export const PROMO_ERROR_MESSAGES: Record<PromoErrorCode, string> = {
  invalid_code: "That promo code isn't valid for this pack.",
  code_exhausted: "This promo code has reached its usage limit.",
  email_limit_reached: "You've already used this promo code.",
  currency_not_allowed: "This promo code isn't available in your currency.",
  amount_below_minimum: "This promo code can't be applied to this pack.",
  email_required: "We couldn't read your account email. Please contact support.",
  reserve_failed: "Couldn't apply the promo code. Please try again.",
};

export function promoErrorMessage(code: string | undefined): string {
  return PROMO_ERROR_MESSAGES[(code as PromoErrorCode) ?? "reserve_failed"] ?? PROMO_ERROR_MESSAGES.reserve_failed;
}

/** Normalise a raw client-supplied code: trim, collapse, upper-case. "" → null. */
export function normalizePromoCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return code.length === 0 ? null : code.slice(0, 64);
}

export async function reserveDiscount(
  svc: ServiceClient,
  args: {
    code: string;
    planId: string;
    customerId: string;
    email: string;
    currency: string;
    originalAmountCents: number;
    orderId?: string | null;
    paymentId?: string | null;
  },
): Promise<ReserveDiscountResult> {
  const { data, error } = await svc.rpc("reserve_discount_redemption", {
    p_code: args.code,
    p_plan_id: args.planId,
    p_customer: args.customerId,
    p_email: args.email,
    p_currency: args.currency,
    p_original_amount_cents: args.originalAmountCents,
    p_order_id: args.orderId ?? null,
    p_payment_id: args.paymentId ?? null,
  });

  if (error || !data) return { ok: false, error: "reserve_failed" };
  if (!data.ok) return { ok: false, error: (data.error as PromoErrorCode) ?? "invalid_code" };

  return {
    ok: true,
    redemptionId: data.redemption_id as string,
    discountCodeId: data.discount_code_id as string,
    discountAmountCents: data.discount_amount_cents as number,
    finalAmountCents: data.final_amount_cents as number,
    code: data.code as string,
  };
}
