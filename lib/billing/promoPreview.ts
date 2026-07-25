/**
 * Shared shapes + arithmetic for the promo-code price PREVIEW shown on the
 * pricing cards while a customer types a code.
 *
 * Like `lib/geo/region.ts` and `lib/payments/bankTransfer.ts`, this module is a
 * deliberate exception to the `server-only` rule: the pricing UI imports the
 * types from here to render the preview. It stays pure and dependency-free.
 *
 * IMPORTANT, two invariants:
 *   1. The browser never computes what a customer pays. `discountForAmount` is
 *      called from the server only (`lib/billing/promo.ts`); the client uses the
 *      *types* and the amounts the server already resolved.
 *   2. A preview is advisory. The authoritative discount is the one
 *      `reserve_discount_redemption` returns at checkout, against a locked code
 *      row. The math below mirrors that RPC line for line (see
 *      supabase/migrations/0032_discount_redemptions.sql) so the number the
 *      customer sees matches what they are charged, but a preview never
 *      reserves, so a cap can still be taken by someone else in between.
 */

import type { Currency } from "@/lib/geo/region";
import type { DiscountType } from "@/lib/supabase/types";

/**
 * Razorpay (and our own floor) rejects an order below 100 minor units, so a code
 * that would take a pack under that is refused rather than silently clamped.
 * Mirrors the `v_final < 100` check in reserve_discount_redemption.
 */
export const MIN_CHARGE_MINOR_UNITS = 100;

/**
 * Why a code was refused. The first five are VERDICTS about the code itself and
 * are stable for the customer; `email_required` is an account-state problem that
 * checkout would hit identically. `reserve_failed` is the odd one out: it means
 * a query failed, so nothing about the code was actually determined.
 * Mirrors the `error` values returned by reserve_discount_redemption.
 */
export type PromoErrorCode =
  | "invalid_code"
  | "code_exhausted"
  | "email_limit_reached"
  | "currency_not_allowed"
  | "amount_below_minimum"
  | "email_required"
  | "reserve_failed";

/** Why a specific pack can't use an otherwise-valid code. */
export type PromoPlanIneligibility = "not_applicable" | "amount_below_minimum";

/** One pack's pricing under the previewed code. */
export type PromoPreviewPlan = {
  slug: string;
  /** Server-resolved list price for this pack in `currency` (minor units). */
  originalAmountCents: number;
  discountAmountCents: number;
  finalAmountCents: number;
  eligible: boolean;
  /** Set only when `eligible` is false. */
  reason?: PromoPlanIneligibility;
};

export type PromoPreviewOk = {
  ok: true;
  /** The code as stored (canonical casing), not as typed. */
  code: string;
  currency: Currency;
  discountType: DiscountType;
  plans: PromoPreviewPlan[];
};

/** A whole-code rejection: nothing about the packs matters. */
export type PromoPreviewRejected = {
  ok: false;
  error: PromoErrorCode;
  message: string;
};

export type PromoPreviewResult = PromoPreviewOk | PromoPreviewRejected;

/**
 * Discount for one amount, in the order currency. Exact mirror of the RPC:
 *
 *   percentage -> round(original * value / 100.0)
 *   fixed_*    -> least(value, original)
 *   then         greatest(discount, 0)
 *
 * Postgres `round()` on numeric is half-away-from-zero and `Math.round` is
 * half-up; for the non-negative amounts we deal with those agree. Deliberately
 * NOT clamped to `original` for percentages, so an over-100% code lands on the
 * same "below minimum" rejection here as it does in the RPC.
 */
export function discountForAmount(
  originalAmountCents: number,
  discountType: DiscountType,
  discountValue: number,
): number {
  const raw =
    discountType === "percentage"
      ? Math.round((originalAmountCents * discountValue) / 100)
      : Math.min(discountValue, originalAmountCents);
  return Math.max(raw, 0);
}

/**
 * Rejections that are a real verdict on the code, so the customer would hit the
 * same answer at checkout. `reserve_failed` is excluded on purpose: it means a
 * query failed, not that the code is bad, and dropping the code on it would
 * silently charge full price for a discount the customer had earned.
 */
const SETTLED_REJECTIONS: readonly PromoErrorCode[] = [
  "invalid_code",
  "code_exhausted",
  "email_limit_reached",
  "currency_not_allowed",
  "amount_below_minimum",
  "email_required",
];

/**
 * The promo code to actually send to checkout for one pack, given what the
 * preview said about it. Returns undefined to mean "buy at list price".
 *
 * This exists because `reserve_discount_redemption` has NO per-pack "partially
 * applies" outcome: it folds `applies_to_plan_ids` into the code lookup itself
 * and rejects the whole reservation on the charge floor, and both checkout
 * routes turn that into a 400 rather than falling back to the list price. So
 * forwarding a code the preview already ruled out for this pack would make the
 * pack unbuyable, even though its card is showing a perfectly valid price.
 *
 * The rule is narrow on purpose: withhold ONLY where the preview reached a
 * verdict. Whenever we don't know (still checking, request failed, signed out,
 * or the server couldn't complete the lookup) the code goes through untouched
 * and the server decides, because a wrongly-withheld code is a customer paying
 * full price for a discount they had.
 */
export function promoCodeForCheckout(
  typedCode: string,
  planSlug: string,
  preview: PromoPreviewResult | null,
): string | undefined {
  const code = typedCode.trim();
  if (!code) return undefined;
  if (!preview) return code;
  if (!preview.ok) return SETTLED_REJECTIONS.includes(preview.error) ? undefined : code;
  const line = preview.plans.find((p) => p.slug === planSlug);
  return line && !line.eligible ? undefined : code;
}

/** Price a single pack under a code. `eligible` false means "keep list price". */
export function previewAmountForPlan(
  originalAmountCents: number,
  discountType: DiscountType,
  discountValue: number,
): Omit<PromoPreviewPlan, "slug"> {
  const discountAmountCents = discountForAmount(originalAmountCents, discountType, discountValue);
  const finalAmountCents = Math.max(originalAmountCents - discountAmountCents, 0);

  if (finalAmountCents < MIN_CHARGE_MINOR_UNITS) {
    return {
      originalAmountCents,
      discountAmountCents: 0,
      finalAmountCents: originalAmountCents,
      eligible: false,
      reason: "amount_below_minimum",
    };
  }

  return {
    originalAmountCents,
    discountAmountCents,
    finalAmountCents,
    eligible: discountAmountCents > 0,
    // A code that computes to zero off (e.g. a 0% code) isn't an error, it just
    // changes nothing, so it reads as "doesn't apply to this pack".
    ...(discountAmountCents > 0 ? {} : { reason: "not_applicable" as const }),
  };
}
