import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { paypalFetch } from "@/lib/paypal/client";
import type { SubscriptionStatus } from "@/lib/supabase/types";

const schema = z.object({
  subscriptionId: z.string().min(1).max(64),
});

// Map raw PayPal subscription status to our enum. APPROVAL_PENDING / APPROVED
// stay pending until the webhook fires BILLING.SUBSCRIPTION.ACTIVATED.
function mapStatus(raw: string): SubscriptionStatus {
  switch (raw.toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "SUSPENDED":
      return "suspended";
    case "CANCELLED":
      return "cancelled";
    case "EXPIRED":
      return "expired";
    case "APPROVAL_PENDING":
    case "APPROVED":
    default:
      return "pending";
  }
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const svc = createSupabaseServiceClient();

  // The pending row was inserted at create-subscription time. If it doesn't
  // exist or belongs to a different customer, reject — this blocks Mallory
  // from claiming Alice's subscription by guessing the PayPal ID.
  const { data: pending } = await svc
    .from("subscriptions")
    .select("id, customer_id, status")
    .eq("paypal_subscription_id", parsed.data.subscriptionId)
    .single();
  if (!pending || pending.customer_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const res = await paypalFetch(`/v1/billing/subscriptions/${encodeURIComponent(parsed.data.subscriptionId)}`);
  if (!res.ok) return NextResponse.json({ error: "paypal_lookup_failed" }, { status: 502 });
  const sub = (await res.json()) as {
    id: string;
    status: string;
    billing_info?: { next_billing_time?: string };
  };

  const mapped = mapStatus(sub.status);
  // Don't reopen a previously-cancelled sub from an out-of-order confirm call.
  if (pending.status === "cancelled" && mapped !== "cancelled") {
    return NextResponse.json({ ok: true, status: pending.status });
  }

  const update: Partial<{
    status: SubscriptionStatus;
    next_billing_at: string | null;
    started_at: string;
  }> = {
    status: mapped,
    next_billing_at: sub.billing_info?.next_billing_time ?? null,
  };
  if (mapped === "active" && !pending.status.startsWith("active")) {
    update.started_at = new Date().toISOString();
  }
  const { error } = await svc.from("subscriptions").update(update).eq("id", pending.id);
  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  // If the webhook already flipped this to active, apply the discount counter
  // here too — the RPC is idempotent.
  if (mapped === "active") {
    await svc.rpc("apply_discount_to_subscription", { p_subscription_id: pending.id });
  }

  return NextResponse.json({ ok: true, status: mapped });
}
