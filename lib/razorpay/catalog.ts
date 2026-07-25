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
 * Every purchasable pack in a currency, ordered the way the pricing grid renders
 * them. Used by the promo-code preview, which has to price *all* packs at once
 * (a code may be restricted to some of them via `applies_to_plan_ids`).
 *
 * Same trusted-price rule as resolvePackBySlug: amounts come from the DB, never
 * from the client, and a missing per-currency row falls back to the base price.
 */
export async function listActivePacks(currency: Currency): Promise<RazorpayPack[]> {
  const svc = createSupabaseServiceClient();
  const { data: plans } = await svc
    .from("plans")
    .select("id, slug, name, price_base_cents, session_credits")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (!plans || plans.length === 0) return [];

  const { data: prices } = await svc
    .from("plan_prices")
    .select("plan_id, amount_cents")
    .eq("currency", currency)
    .in(
      "plan_id",
      plans.map((p) => p.id),
    );
  const amountByPlan = new Map((prices ?? []).map((p) => [p.plan_id, p.amount_cents]));

  return plans.map((plan) => ({
    planId: plan.id,
    slug: plan.slug,
    name: plan.name,
    amount: amountByPlan.get(plan.id) ?? plan.price_base_cents,
    currency,
    sessionCredits: plan.session_credits,
  }));
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
