import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { paypalFetch } from "@/lib/paypal/client";

const schema = z.object({
  planSlug: z.string(),
  discountCode: z.string().optional(),
});

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

  // Discount handling (percentage applied via plan_overrides.pricing_scheme.fixed_price)
  let pricingOverride: { fixed_price: { value: string; currency_code: "AUD" } } | undefined;
  if (parsed.data.discountCode) {
    const { data: d } = await supabase.rpc("validate_discount_code", {
      p_code: parsed.data.discountCode,
      p_plan_id: plan.id,
    });
    if (d) {
      const final =
        d.discount_type === "percentage"
          ? Math.round(plan.price_aud_cents * (1 - d.discount_value / 100))
          : Math.max(0, plan.price_aud_cents - d.discount_value);
      pricingOverride = {
        fixed_price: { value: (final / 100).toFixed(2), currency_code: "AUD" },
      };
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
  const approveUrl = data.links.find((l) => l.rel === "approve")?.href;
  return NextResponse.json({ subscriptionId: data.id, approveUrl });
}
