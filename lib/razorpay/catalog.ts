import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { DEFAULT_CURRENCY, type Currency } from "@/lib/geo/region";

/**
 * Trusted, server-side resolution of what a Razorpay one-time order should cost
 * and grant. The browser sends only a `planSlug` (or the server reads a `planId`
 * from a paid order's notes) — never an amount — so a caller can't mint a cheap
 * order for an expensive pack. Prices come from the admin-managed `plans` /
 * `plan_prices` tables.
 *
 * A "pack" = a plan row: a per-currency price + how many session-credits it
 * grants. The price is per (plan, currency): UAE customers pay AED, India INR
 * (see lib/geo/region.ts). `plan_prices` holds the per-currency amount; when a
 * currency row is missing we fall back to `plans.price_base_cents`. Amounts are
 * in the smallest currency unit (paise for INR, fils for AED).
 */
export type RazorpayPack = {
  planId: string;
  slug: string;
  name: string;
  amount: number;
  currency: Currency;
  sessionCredits: number;
};

/**
 * Resolve a purchasable pack by slug in a specific currency — only active plans
 * (used at checkout start). Falls back to the base price if the currency has no
 * dedicated `plan_prices` row.
 */
export async function resolvePackBySlug(
  slug: string,
  currency: Currency,
): Promise<RazorpayPack | null> {
  const svc = createSupabaseServiceClient();
  const { data: plan } = await svc
    .from("plans")
    .select("id, slug, name, price_base_cents, session_credits")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan) return null;

  const { data: price } = await svc
    .from("plan_prices")
    .select("amount_cents")
    .eq("plan_id", plan.id)
    .eq("currency", currency)
    .maybeSingle();

  return {
    planId: plan.id,
    slug: plan.slug,
    name: plan.name,
    amount: price?.amount_cents ?? plan.price_base_cents,
    currency,
    sessionCredits: plan.session_credits,
  };
}

/**
 * Resolve a pack by id — used during fulfilment from a paid order's notes. No
 * `is_active` filter: a customer who already paid must still be credited even if
 * an admin has since hidden the plan. Fulfilment only reads `sessionCredits`;
 * the amount/currency here are NOT used to charge (the captured amount and
 * currency Razorpay reports are authoritative), so they carry placeholder values.
 */
export async function resolvePackById(planId: string): Promise<RazorpayPack | null> {
  const svc = createSupabaseServiceClient();
  const { data: plan } = await svc
    .from("plans")
    .select("id, slug, name, price_base_cents, session_credits")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return null;
  return {
    planId: plan.id,
    slug: plan.slug,
    name: plan.name,
    amount: plan.price_base_cents,
    currency: DEFAULT_CURRENCY,
    sessionCredits: plan.session_credits,
  };
}
