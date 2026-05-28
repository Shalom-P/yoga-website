import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { verifyPayPalWebhook } from "@/lib/paypal/verify-webhook";
import type { SubscriptionStatus } from "@/lib/supabase/types";

export async function POST(req: Request) {
  const raw = await req.text();
  const ok = await verifyPayPalWebhook(req.headers, raw).catch(() => false);
  if (!ok) return NextResponse.json({ error: "invalid_signature" }, { status: 400 });

  const event = JSON.parse(raw) as { event_type: string; resource: Record<string, unknown> };
  const svc = createSupabaseServiceClient();

  switch (event.event_type) {
    case "BILLING.SUBSCRIPTION.ACTIVATED": {
      const r = event.resource as { id: string; billing_info?: { next_billing_time?: string } };
      await svc.from("subscriptions")
        .update({
          status: "active" as SubscriptionStatus,
          started_at: new Date().toISOString(),
          next_billing_at: r.billing_info?.next_billing_time ?? null,
        })
        .eq("paypal_subscription_id", r.id);
      break;
    }
    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED":
    case "BILLING.SUBSCRIPTION.SUSPENDED": {
      const r = event.resource as { id: string };
      const status = event.event_type.split(".").pop()!.toLowerCase() as SubscriptionStatus;
      await svc.from("subscriptions")
        .update({ status, cancelled_at: new Date().toISOString() })
        .eq("paypal_subscription_id", r.id);
      break;
    }
    case "PAYMENT.SALE.COMPLETED":
    case "PAYMENT.CAPTURE.COMPLETED": {
      const r = event.resource as {
        id: string;
        billing_agreement_id?: string;
        amount?: { total?: string; value?: string; currency?: string };
      };
      const cents = Math.round(parseFloat(r.amount?.total ?? r.amount?.value ?? "0") * 100);
      const { data: sub } = await svc
        .from("subscriptions")
        .select("id, customer_id")
        .eq("paypal_subscription_id", r.billing_agreement_id ?? "")
        .single();
      if (sub) {
        await svc.from("payments").upsert({
          paypal_capture_id: r.id,
          customer_id: sub.customer_id,
          subscription_id: sub.id,
          amount_aud_cents: cents,
          currency: r.amount?.currency ?? "AUD",
          status: "completed",
          paid_at: new Date().toISOString(),
        }, { onConflict: "paypal_capture_id" });
      }
      break;
    }
  }

  await svc.from("audit_log").insert({
    actor_id: null,
    action: "paypal_webhook",
    entity_type: "subscription",
    payload: event as object,
  });

  return NextResponse.json({ ok: true });
}
