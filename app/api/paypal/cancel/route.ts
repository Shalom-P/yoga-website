import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { paypalFetch } from "@/lib/paypal/client";

const schema = z.object({
  subscriptionId: z.string().min(1).max(64),
  reason: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, customer_id")
    .eq("paypal_subscription_id", parsed.data.subscriptionId)
    .single();
  if (!sub || sub.customer_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const res = await paypalFetch(
    `/v1/billing/subscriptions/${encodeURIComponent(parsed.data.subscriptionId)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ reason: parsed.data.reason ?? "Cancelled by user" }),
    },
  );
  if (!res.ok && res.status !== 204) {
    return NextResponse.json({ error: "paypal_failed" }, { status: 502 });
  }
  // The webhook will flip status to "cancelled" — UI shows pending state until then.
  return NextResponse.json({ ok: true });
}
