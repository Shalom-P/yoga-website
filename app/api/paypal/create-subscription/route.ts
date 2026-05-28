import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { paypalFetch } from "@/lib/paypal/client";

const schema = z.object({
  planSlug: z.string().min(1).max(64),
  discountCode: z.string().min(1).max(64).optional(),
});

// PayPal rejects $0 fixed_price subscriptions. Floor to AUD 1.00 / cycle for
// 100%-off promotions; admins issue free intros via the trial flow, not via
// paid plans with 100% discounts.
const PRICE_FLOOR_AUD_CENTS = 100;

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { data: plan, error: planErr } = await supabase
    .from("plans")
    .select("id, paypal_plan_id, price_aud_cents")
    .eq("slug", parsed.data.planSlug)
    .eq("is_active", true)
    .single();
  if (planErr || !plan?.paypal_plan_id) {
    return NextResponse.json({ error: "plan not configured" }, { status: 400 });
  }

  // Discount handling — percentage applied via plan_overrides.pricing_scheme.fixed_price.
  let pricingOverride: { fixed_price: { value: string; currency_code: "AUD" } } | undefined;
  let discountCodeId: string | null = null;
  if (parsed.data.discountCode) {
    const { data: d } = await supabase.rpc("validate_discount_code", {
      p_code: parsed.data.discountCode,
      p_plan_id: plan.id,
    });
    if (d) {
      const computed =
        d.discount_type === "percentage"
          ? Math.round(plan.price_aud_cents * (1 - d.discount_value / 100))
          : Math.max(0, plan.price_aud_cents - d.discount_value);
      const final = Math.max(computed, PRICE_FLOOR_AUD_CENTS);
      pricingOverride = {
        fixed_price: { value: (final / 100).toFixed(2), currency_code: "AUD" },
      };
      discountCodeId = d.id;
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const res = await paypalFetch("/v1/billing/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: plan.paypal_plan_id,
      ...(pricingOverride
        ? { plan: { billing_cycles: [{ sequence: 1, pricing_scheme: pricingOverride }] } }
        : {}),
      application_context: {
        brand_name: "MYYOGACLASSES",
        locale: "en-AU",
        return_url: `${siteUrl}/dashboard/plan/success`,
        cancel_url: `${siteUrl}/dashboard/plan?canceled=1`,
        user_action: "SUBSCRIBE_NOW",
      },
    }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: "paypal_failed", details: await res.text() }, { status: 502 });
  }
  const data = (await res.json()) as { id: string; links: { rel: string; href: string }[] };

  // Pre-claim the subscription against this customer so /confirm-subscription
  // can reject hijack attempts where Mallory POSTs Alice's subscription ID.
  const svc = createSupabaseServiceClient();
  const { error: insertErr } = await svc.from("subscriptions").insert({
    customer_id: user.id,
    plan_id: plan.id,
    paypal_subscription_id: data.id,
    status: "pending",
    discount_code_id: discountCodeId,
  });
  if (insertErr) {
    return NextResponse.json({ error: "db_error", details: insertErr.message }, { status: 500 });
  }

  const approveUrl = data.links.find((l) => l.rel === "approve")?.href;
  return NextResponse.json({ subscriptionId: data.id, approveUrl });
}
