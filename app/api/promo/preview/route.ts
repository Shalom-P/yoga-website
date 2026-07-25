import "server-only";

import { z } from "zod";

import { listActivePacks } from "@/lib/razorpay/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { normalizePromoCode, previewPromoCode, promoErrorMessage } from "@/lib/billing/promo";
import { countryFromHeaders, resolveRegion } from "@/lib/geo/region";

// listActivePacks uses the service-role client; Node runtime required.
export const runtime = "nodejs";

/**
 * POST /api/promo/preview
 *
 * Prices every active pack under a promo code so the pricing grid can show the
 * customer what they'd actually pay before they commit to checkout. READ-ONLY:
 * it reserves nothing, increments nothing, and is safe to call on every debounced
 * keystroke.
 *
 * Auth is REQUIRED, deliberately. 0007_security_fixes.sql locked
 * validate_discount_code away from anonymous callers so the site can't be used as
 * a brute-force oracle for promo codes, and a public preview would hand that
 * oracle straight back. Signed-out visitors get a 401 and the pricing UI tells
 * them to sign in; their typed code is already carried through the login
 * redirect (see PricingTeaser -> PlanAutoStart), so nothing is lost.
 *
 * No service-area gate here: this returns no more than the pricing cards already
 * show publicly, and purchases stay gated at their own choke points
 * (/api/razorpay/create-order and /api/payments/intent).
 */

const bodySchema = z.object({
  code: z.string().trim().min(1).max(64),
  // The visitor's live browser timezone (IANA id) — currency fallback only, used
  // exactly as the checkout routes use it. Never a price input.
  clientTimezone: z.string().trim().min(1).max(64),
});

export async function POST(req: Request): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Sign in to check a promo code." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const code = normalizePromoCode(parsed.data.code);
  if (!code) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();
  const email = user.email ?? profile?.email ?? null;
  if (!email) {
    return Response.json(
      { ok: false, error: "email_required", message: promoErrorMessage("email_required") },
      { status: 200 },
    );
  }

  // Same GeoIP-first resolution as create-order, so the preview quotes the
  // currency the customer will really be charged in.
  const { currency } = resolveRegion({
    country: countryFromHeaders(req.headers),
    timezone: parsed.data.clientTimezone,
  });

  const packs = await listActivePacks(currency);
  if (packs.length === 0) {
    return Response.json({ error: "No packs available" }, { status: 503 });
  }

  const result = await previewPromoCode(createSupabaseServiceClient(), {
    code,
    customerId: user.id,
    email,
    currency,
    plans: packs.map((p) => ({ slug: p.slug, planId: p.planId, amountCents: p.amount })),
  });

  // `reserve_failed` means a query failed, so nothing about the code was
  // determined. Return it as a real failure rather than a verdict: the client
  // must not treat "we couldn't tell" as "your code is bad" and drop it, which
  // would charge full price for a discount the customer actually had.
  if (!result.ok && result.error === "reserve_failed") {
    return Response.json(result, { status: 503 });
  }

  // Any other rejection is a valid answer about the code, not a transport
  // failure: 200 keeps the client's error handling about the *code*.
  return Response.json(result);
}
