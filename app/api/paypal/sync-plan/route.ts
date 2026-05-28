import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { paypalFetch } from "@/lib/paypal/client";

const schema = z.object({ planId: z.string().uuid() });

// Catalog Product IDs in PayPal need to be ≤50 chars and stable for the plan.
function productIdFor(planId: string) {
  return `myyoga_${planId.replace(/-/g, "").slice(0, 40)}`;
}

const INTERVAL_TO_PAYPAL: Record<string, { interval_unit: "MONTH" | "YEAR"; interval_count: number }> = {
  monthly: { interval_unit: "MONTH", interval_count: 1 },
  quarterly: { interval_unit: "MONTH", interval_count: 3 },
  yearly: { interval_unit: "YEAR", interval_count: 1 },
};

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const svc = createSupabaseServiceClient();
  const { data: plan } = await svc
    .from("plans")
    .select("id, name, description, price_aud_cents, billing_interval, paypal_plan_id")
    .eq("id", parsed.data.planId)
    .single();
  if (!plan) return NextResponse.json({ error: "plan_not_found" }, { status: 404 });

  if (plan.paypal_plan_id) {
    return NextResponse.json({ ok: true, paypalPlanId: plan.paypal_plan_id, replay: true });
  }

  const interval = INTERVAL_TO_PAYPAL[plan.billing_interval];
  if (!interval) return NextResponse.json({ error: "invalid_interval" }, { status: 400 });

  const productId = productIdFor(plan.id);

  // 1. Ensure the Catalog Product exists. POST is idempotent-ish — a 422 on
  //    duplicate ID means the product is already there, which is fine.
  const productRes = await paypalFetch("/v1/catalogs/products", {
    method: "POST",
    body: JSON.stringify({
      id: productId,
      name: plan.name.slice(0, 127),
      description: (plan.description ?? plan.name).slice(0, 256),
      type: "SERVICE",
      category: "EXERCISE_AND_FITNESS",
    }),
  });
  if (!productRes.ok && productRes.status !== 422) {
    return NextResponse.json(
      { error: "paypal_product_failed", details: await productRes.text() },
      { status: 502 }
    );
  }

  // 2. Create the Billing Plan against that product.
  const planRes = await paypalFetch("/v1/billing/plans", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      name: plan.name.slice(0, 127),
      description: (plan.description ?? plan.name).slice(0, 127),
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: interval,
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              value: (plan.price_aud_cents / 100).toFixed(2),
              currency_code: "AUD",
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: { value: "0", currency_code: "AUD" },
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 2,
      },
    }),
  });
  if (!planRes.ok) {
    return NextResponse.json(
      { error: "paypal_plan_failed", details: await planRes.text() },
      { status: 502 }
    );
  }
  const planData = (await planRes.json()) as { id: string };

  const { error: updateErr } = await svc
    .from("plans")
    .update({ paypal_plan_id: planData.id })
    .eq("id", plan.id);
  if (updateErr) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, paypalPlanId: planData.id });
}
