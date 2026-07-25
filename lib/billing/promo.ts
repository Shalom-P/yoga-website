import "server-only";

import type { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { Currency } from "@/lib/geo/region";
import {
  previewAmountForPlan,
  type PromoErrorCode,
  type PromoPreviewPlan,
  type PromoPreviewResult,
} from "@/lib/billing/promoPreview";

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

// Defined in the pure module so the client can reason about which rejections are
// verdicts on the code and which are "we couldn't tell" (see promoCodeForCheckout).
export type { PromoErrorCode };

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

/** One pack to price under a previewed code. */
export type PromoPreviewPlanInput = { slug: string; planId: string; amountCents: number };

/**
 * Admin-managed marketing table, so "every active code" is a handful of rows. We
 * read them and match in JS rather than through PostgREST's `ilike`, whose
 * pattern syntax would treat `%`, `_` and `*` inside a customer-supplied code as
 * wildcards. The cap is a runaway guard, not an expected boundary.
 */
const ACTIVE_CODE_SCAN_LIMIT = 1000;

/**
 * READ-ONLY price preview for a promo code, powering the live "here's your new
 * price" state on the pricing cards. It runs every check
 * `reserve_discount_redemption` runs and computes the discount the same way, but
 * it RESERVES NOTHING: typing a code must never consume a `max_uses` or
 * `per_email_max` slot, or an idle browser would burn the customer's own
 * allowance before they ever reach checkout.
 *
 * The tradeoff is that a preview can go stale between here and checkout (someone
 * else takes the last use). Checkout re-validates under a row lock and is the
 * authoritative answer; the UI surfaces its rejection if that happens.
 */
export async function previewPromoCode(
  svc: ServiceClient,
  args: {
    code: string;
    customerId: string;
    email: string;
    currency: Currency;
    plans: PromoPreviewPlanInput[];
  },
): Promise<PromoPreviewResult> {
  const reject = (error: PromoErrorCode): PromoPreviewResult => ({
    ok: false,
    error,
    message: promoErrorMessage(error),
  });

  const email = args.email.trim().toLowerCase();
  if (!email) return reject("email_required");

  const wanted = args.code.trim().toUpperCase();
  if (!wanted) return reject("invalid_code");

  const nowIso = new Date().toISOString();
  const { data: codes, error: codesError } = await svc
    .from("discount_codes")
    .select(
      "id, code, discount_type, discount_value, applies_to_plan_ids, max_uses, per_email_max, currency",
    )
    .eq("is_active", true)
    .lte("valid_from", nowIso)
    .or(`valid_until.is.null,valid_until.gt.${nowIso}`)
    .limit(ACTIVE_CODE_SCAN_LIMIT);
  if (codesError) return reject("reserve_failed");

  const code = (codes ?? []).find((c) => c.code.trim().toUpperCase() === wanted);
  if (!code) return reject("invalid_code");

  // Currency lock (null = any), the same guard that stops a fixed-amount code
  // designed for AED being spent against an INR price.
  if (code.currency && code.currency !== args.currency) return reject("currency_not_allowed");

  // Live = reserved + committed, matching the RPC. A fresh checkout supersedes
  // this customer's own still-unpaid Razorpay reservations for the code, so
  // those must not count here either: an abandoned modal should never make the
  // preview claim a code is exhausted when checkout would happily accept it.
  // Scoped to `payment_id is null` exactly as the RPC scopes its supersede, so a
  // bank transfer awaiting a real wire still holds its slot.
  if (code.max_uses != null || code.per_email_max != null) {
    const liveRows = () =>
      svc
        .from("discount_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("discount_code_id", code.id)
        .in("status", ["reserved", "committed"]);

    const [total, forEmail, own] = await Promise.all([
      code.max_uses != null ? liveRows() : null,
      code.per_email_max != null ? liveRows().eq("email", email) : null,
      liveRows()
        .eq("customer_id", args.customerId)
        .eq("status", "reserved")
        .is("payment_id", null),
    ]);
    if (total?.error || forEmail?.error || own.error) return reject("reserve_failed");

    // Every supersedable row belongs to this customer, whose reservations carry
    // this same session email, so it deducts from both caps.
    const ownSupersedable = own.count ?? 0;
    if (code.max_uses != null && (total?.count ?? 0) - ownSupersedable >= code.max_uses) {
      return reject("code_exhausted");
    }
    if (code.per_email_max != null && (forEmail?.count ?? 0) - ownSupersedable >= code.per_email_max) {
      return reject("email_limit_reached");
    }
  }

  // Per-pack pricing. `applies_to_plan_ids` null means "any pack"; a restricted
  // code prices only its own packs and reports the rest as not applicable, so
  // the grid can say which pack the code is actually for.
  const allowed = code.applies_to_plan_ids;
  const plans: PromoPreviewPlan[] = args.plans.map((plan) => {
    if (allowed && !allowed.includes(plan.planId)) {
      return {
        slug: plan.slug,
        originalAmountCents: plan.amountCents,
        discountAmountCents: 0,
        finalAmountCents: plan.amountCents,
        eligible: false,
        reason: "not_applicable",
      };
    }
    return {
      slug: plan.slug,
      ...previewAmountForPlan(plan.amountCents, code.discount_type, code.discount_value),
    };
  });

  // A code valid in the abstract but applicable to no pack on offer reads as a
  // wrong code to the customer, so say so instead of showing an inert banner.
  if (!plans.some((p) => p.eligible)) return reject("invalid_code");

  return {
    ok: true,
    code: code.code,
    currency: args.currency,
    discountType: code.discount_type,
    plans,
  };
}
