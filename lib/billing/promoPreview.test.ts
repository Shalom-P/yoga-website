import { describe, it, expect } from "vitest";
import {
  discountForAmount,
  previewAmountForPlan,
  promoCodeForCheckout,
  MIN_CHARGE_MINOR_UNITS,
  type PromoPreviewResult,
} from "@/lib/billing/promoPreview";

// These assertions double as the contract against reserve_discount_redemption
// (supabase/migrations/0032_discount_redemptions.sql). If the RPC's arithmetic
// ever changes, these are the tests that must change with it.

describe("discountForAmount", () => {
  it("takes a percentage of the original, rounded to whole minor units", () => {
    expect(discountForAmount(135_000, "percentage", 10)).toBe(13_500);
    expect(discountForAmount(1_000_000, "percentage", 15)).toBe(150_000);
  });

  it("rounds a fractional percentage half-up, like Postgres round()", () => {
    // 105 * 50 / 100 = 52.5 -> 53 both in Postgres (half away from zero) and JS.
    expect(discountForAmount(105, "percentage", 50)).toBe(53);
    expect(discountForAmount(333, "percentage", 10)).toBe(33); // 33.3
    expect(discountForAmount(335, "percentage", 10)).toBe(34); // 33.5
  });

  it("caps a fixed-amount discount at the original price", () => {
    expect(discountForAmount(5_900, "fixed_amount_cents", 2_000)).toBe(2_000);
    expect(discountForAmount(5_900, "fixed_amount_cents", 9_999)).toBe(5_900);
  });

  it("never returns a negative discount", () => {
    expect(discountForAmount(5_900, "percentage", -10)).toBe(0);
    expect(discountForAmount(5_900, "fixed_amount_cents", -500)).toBe(0);
  });

  it("does not clamp an over-100% code, so it lands on the minimum check", () => {
    expect(discountForAmount(5_900, "percentage", 150)).toBe(8_850);
  });
});

describe("previewAmountForPlan", () => {
  it("returns the discounted price and marks the pack eligible", () => {
    expect(previewAmountForPlan(135_000, "percentage", 10)).toEqual({
      originalAmountCents: 135_000,
      discountAmountCents: 13_500,
      finalAmountCents: 121_500,
      eligible: true,
    });
  });

  it("refuses a code that would take the pack under the charge floor", () => {
    const result = previewAmountForPlan(5_900, "fixed_amount_cents", 5_899);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("amount_below_minimum");
    // The pack keeps its list price rather than showing a price we can't charge.
    expect(result.finalAmountCents).toBe(5_900);
    expect(result.discountAmountCents).toBe(0);
  });

  it("allows a code that lands exactly on the charge floor", () => {
    const result = previewAmountForPlan(5_900, "fixed_amount_cents", 5_800);
    expect(result.eligible).toBe(true);
    expect(result.finalAmountCents).toBe(MIN_CHARGE_MINOR_UNITS);
  });

  it("treats a zero-value discount as not applicable rather than an error", () => {
    const result = previewAmountForPlan(135_000, "percentage", 0);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("not_applicable");
    expect(result.finalAmountCents).toBe(135_000);
  });

  it("refuses a percentage over 100 instead of paying the customer", () => {
    const result = previewAmountForPlan(5_900, "percentage", 150);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("amount_below_minimum");
    expect(result.finalAmountCents).toBe(5_900);
  });
});

describe("promoCodeForCheckout", () => {
  // A code scoped to pack-10 only: reserve_discount_redemption folds
  // applies_to_plan_ids into its code lookup, so sending this code with
  // pack-5 makes checkout 400 rather than sell the pack at its list price.
  const partial: PromoPreviewResult = {
    ok: true,
    code: "SUMMER",
    currency: "INR",
    discountType: "percentage",
    plans: [
      {
        slug: "pack-5",
        originalAmountCents: 449_900,
        discountAmountCents: 0,
        finalAmountCents: 449_900,
        eligible: false,
        reason: "not_applicable",
      },
      {
        slug: "pack-10",
        originalAmountCents: 799_900,
        discountAmountCents: 79_990,
        finalAmountCents: 719_910,
        eligible: true,
      },
    ],
  };

  it("sends the code for a pack the preview priced", () => {
    expect(promoCodeForCheckout("SUMMER", "pack-10", partial)).toBe("SUMMER");
  });

  it("withholds the code for a pack the preview ruled out", () => {
    expect(promoCodeForCheckout("SUMMER", "pack-5", partial)).toBeUndefined();
  });

  it("withholds a code the server rejected outright", () => {
    const rejected: PromoPreviewResult = {
      ok: false,
      error: "code_exhausted",
      message: "This promo code has reached its usage limit.",
    };
    expect(promoCodeForCheckout("SUMMER", "pack-10", rejected)).toBeUndefined();
  });

  it("still sends the code when the server couldn't complete the check", () => {
    // reserve_failed is a query failure, not a verdict. Dropping the code here
    // would charge full price for a discount the customer actually had.
    const failed: PromoPreviewResult = {
      ok: false,
      error: "reserve_failed",
      message: "Couldn't apply the promo code. Please try again.",
    };
    expect(promoCodeForCheckout("SUMMER", "pack-10", failed)).toBe("SUMMER");
  });

  it("sends the code when the outcome isn't known yet, letting the server decide", () => {
    // null covers still-checking, request failed, and signed out.
    expect(promoCodeForCheckout("SUMMER", "pack-5", null)).toBe("SUMMER");
  });

  it("sends the code for a pack the preview didn't mention", () => {
    expect(promoCodeForCheckout("SUMMER", "pack-1", partial)).toBe("SUMMER");
  });

  it("trims, and treats a blank input as no code", () => {
    expect(promoCodeForCheckout("  SUMMER  ", "pack-10", partial)).toBe("SUMMER");
    expect(promoCodeForCheckout("   ", "pack-10", null)).toBeUndefined();
    expect(promoCodeForCheckout("", "pack-10", null)).toBeUndefined();
  });
});
