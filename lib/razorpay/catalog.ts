import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Trusted, server-side resolution of what a Razorpay one-time order should cost
 * and grant. The browser sends only a `planSlug` (or the server reads a `planId`
 * from a paid order's notes) — never an amount — so a caller can't mint a cheap
 * order for an expensive pack. Prices come from the admin-managed `plans` table.
 *
 * A "pack" = a plan row: a price (AUD cents) + how many session-credits it grants.
 * Amounts are in the smallest currency unit (cents for AUD).
 */
export type RazorpayPack = {
  planId: string;
  slug: string;
  name: string;
  amount: number;
  currency: "AUD";
  sessionCredits: number;
};

function toPack(row: {
  id: string;
  slug: string;
  name: string;
  price_aud_cents: number;
  session_credits: number;
}): RazorpayPack {
  return {
    planId: row.id,
    slug: row.slug,
    name: row.name,
    amount: row.price_aud_cents,
    currency: "AUD",
    sessionCredits: row.session_credits,
  };
}

/** Resolve a purchasable pack by slug — only active plans (used at checkout start). */
export async function resolvePackBySlug(slug: string): Promise<RazorpayPack | null> {
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("plans")
    .select("id, slug, name, price_aud_cents, session_credits")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return data ? toPack(data) : null;
}

/**
 * Resolve a pack by id — used during fulfilment from a paid order's notes. No
 * `is_active` filter: a customer who already paid must still be credited even if
 * an admin has since hidden the plan.
 */
export async function resolvePackById(planId: string): Promise<RazorpayPack | null> {
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("plans")
    .select("id, slug, name, price_aud_cents, session_credits")
    .eq("id", planId)
    .maybeSingle();
  return data ? toPack(data) : null;
}
