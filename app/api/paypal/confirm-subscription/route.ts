import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { paypalFetch } from "@/lib/paypal/client";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { subscriptionId, planSlug } = (await req.json()) as { subscriptionId: string; planSlug: string };
  if (!subscriptionId || !planSlug) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const res = await paypalFetch(`/v1/billing/subscriptions/${subscriptionId}`);
  if (!res.ok) return NextResponse.json({ error: "paypal_lookup_failed" }, { status: 502 });
  const sub = (await res.json()) as { id: string; status: string; billing_info?: { next_billing_time?: string } };

  const { data: plan } = await supabase
    .from("plans").select("id").eq("slug", planSlug).single();
  if (!plan) return NextResponse.json({ error: "plan_missing" }, { status: 400 });

  const svc = createSupabaseServiceClient();
  await svc.from("subscriptions").upsert({
    customer_id: user.id,
    plan_id: plan.id,
    paypal_subscription_id: sub.id,
    status: sub.status.toLowerCase() as "pending" | "active",
    next_billing_at: sub.billing_info?.next_billing_time ?? null,
    started_at: new Date().toISOString(),
  }, { onConflict: "paypal_subscription_id" });

  return NextResponse.json({ ok: true, status: sub.status });
}
