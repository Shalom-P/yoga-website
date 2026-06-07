import "server-only";

/**
 * Trusted, server-side price catalog for Razorpay one-time checkouts.
 *
 * The browser sends a `productId` — never an amount — so a caller can't mint a
 * ₹1 order for a ₹1000 product. The server resolves the real price here.
 *
 * In production, source these from your products/plans table instead of a
 * constant (see CLAUDE.md "Schema ownership" — `plans.price_aud_cents` is the
 * existing pattern, though those are PayPal *subscriptions*, not one-time).
 * Amounts are in the smallest currency unit (paise for INR, cents for AUD).
 */
export type RazorpayProduct = {
  amount: number;
  currency: string;
  /** Human label, handy for receipts / dashboards. */
  label: string;
};

const RAZORPAY_PRODUCTS: Record<string, RazorpayProduct> = {
  demo_500: { amount: 50000, currency: "INR", label: "Razorpay test order" },
};

export function getRazorpayProduct(productId: string): RazorpayProduct | null {
  return Object.prototype.hasOwnProperty.call(RAZORPAY_PRODUCTS, productId)
    ? RAZORPAY_PRODUCTS[productId]
    : null;
}
