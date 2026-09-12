import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, type Currency } from "@/lib/geo/region";

/**
 * Trusted, server-side resolution of what a Razorpay one-time order should cost
 * and grant. The browser sends only a `planSlug` (or the server reads a `planId`
 * from a paid order's notes) — never an amount — so a caller can't mint a cheap
 * order for an expensive pack. Prices come from the admin-managed `plans` /
 * `plan_prices` tables.
 *
 * A "pack" = a plan row: a per-currency price + how many session-credits it
 * grants. The price is per (plan, currency); `plan_prices` holds the amount in
 * the smallest currency unit (paise for INR, fils for AED, cents for USD/EUR).
 *
 * `plans.price_base_cents` is an INR figure and is ONLY ever a fallback for INR.
 * It used to be the fallback for every currency, which meant a plan missing its
 * row for a currency was billed the rupee number in that currency — 99900 paise
 * (a ~12 USD pack) would have been charged as USD 999.00. A missing row now
 * means "not sold in this currency" and the pack is withheld; `effectiveCurrency`
 * keeps that from ever reaching a customer by downgrading first.
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
 * (used at checkout start). Returns null when the plan has no price in that
 * currency, so an unpriced currency refuses the sale instead of mispricing it.
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

  // INR is the one currency price_base_cents is denominated in, so it is the
  // only currency that may fall back to it.
  const amount =
    price?.amount_cents ?? (currency === DEFAULT_CURRENCY ? plan.price_base_cents : null);
  if (amount === null) return null;

  return {
    planId: plan.id,
    slug: plan.slug,
    name: plan.name,
    amount,
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
 * from the client, and a plan with no price in this currency is omitted rather
 * than priced from the INR base.
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

  return plans.flatMap((plan) => {
    const amount =
      amountByPlan.get(plan.id) ??
      (currency === DEFAULT_CURRENCY ? plan.price_base_cents : null);
    if (amount === null) return [];
    return [
      {
        planId: plan.id,
        slug: plan.slug,
        name: plan.name,
        amount,
        currency,
        sessionCredits: plan.session_credits,
      },
    ];
  });
}

/**
 * Currencies every active pack is priced in, and therefore the ones we can
 * actually sell in today.
 *
 * DEFAULT_CURRENCY is always included: `plans.price_base_cents` is INR, so INR
 * is priced by construction even with no `plan_prices` rows at all.
 *
 * This is what makes adding a currency to SUPPORTED_CURRENCIES inert until
 * somebody prices it in /admin/plans — a half-priced currency (say three packs
 * with GBP rows and a fourth without) is deliberately NOT offered, because a
 * pricing grid that silently drops a pack is worse than one in rupees.
 */
export async function pricedCurrencies(): Promise<Set<Currency>> {
  const svc = createSupabaseServiceClient();
  const { data: plans } = await svc.from("plans").select("id").eq("is_active", true);
  const activeIds = new Set((plans ?? []).map((p) => p.id));
  const priced = new Set<Currency>([DEFAULT_CURRENCY]);
  if (activeIds.size === 0) return priced;

  const { data: prices } = await svc
    .from("plan_prices")
    .select("plan_id, currency")
    .in("plan_id", [...activeIds]);

  const byCurrency = new Map<string, Set<string>>();
  for (const row of prices ?? []) {
    if (!byCurrency.has(row.currency)) byCurrency.set(row.currency, new Set());
    byCurrency.get(row.currency)!.add(row.plan_id);
  }
  for (const currency of SUPPORTED_CURRENCIES) {
    const covered = byCurrency.get(currency);
    if (covered && activeIds.size > 0 && [...activeIds].every((id) => covered.has(id))) {
      priced.add(currency);
    }
  }
  return priced;
}

/**
 * The currency to actually transact in for a visitor we would LIKE to bill in
 * `candidate`. Downgrades to DEFAULT_CURRENCY when the packs are not priced in
 * the candidate yet, so a new currency never blocks a sale or mis-states a price
 * — it simply does not appear until it is priced.
 *
 * Every path that shows or takes money goes through this, so the pricing grid
 * and checkout can never disagree about which currency is in play.
 */
export async function effectiveCurrency(candidate: Currency): Promise<Currency> {
  if (candidate === DEFAULT_CURRENCY) return candidate;
  const priced = await pricedCurrencies();
  return priced.has(candidate) ? candidate : DEFAULT_CURRENCY;
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
