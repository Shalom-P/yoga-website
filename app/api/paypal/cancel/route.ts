import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { paypalFetch } from "@/lib/paypal/client";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { subscriptionId, reason } = (await req.json()) as { subscriptionId: string; reason?: string };
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, customer_id")
    .eq("paypal_subscription_id", subscriptionId)
    .single();
  if (!sub || sub.customer_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const res = await paypalFetch(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? "Cancelled by user" }),
  });
  if (!res.ok && res.status !== 204) {
    return NextResponse.json({ error: "paypal_failed" }, { status: 502 });
  }
  // The webhook will flip status to "cancelled" — UI shows pending state until then.
  return NextResponse.json({ ok: true });
}
