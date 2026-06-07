import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { verifyPayPalWebhook } from "@/lib/paypal/verify-webhook";
import type { SubscriptionStatus } from "@/lib/supabase/types";
import { sendSubscriptionActivated } from "@/lib/email";
import { trackServer } from "@/lib/analytics/server";

type PayPalEvent = {
  id?: string;
  event_type?: string;
  resource?: Record<string, unknown>;
};

export async function POST(req: Request) {
  const raw = await req.text();
  const ok = await verifyPayPalWebhook(req.headers, raw).catch(() => false);
  if (!ok) return NextResponse.json({ error: "invalid_signature" }, { status: 400 });

  let event: PayPalEvent;
  try {
    event = JSON.parse(raw) as PayPalEvent;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!event.id || !event.event_type) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const svc = createSupabaseServiceClient();

  // Idempotency: paypal_webhook_events.event_id is the primary key. A unique-
  // violation (23505) is a genuine replay and we ack 200. Any other DB error
  // must surface as 5xx so PayPal retries — silently dropping a transient
  // failure here used to leave subscription state un-synced forever.
  const dedupe = await svc
    .from("paypal_webhook_events")
    .insert({
      event_id: event.id,
      event_type: event.event_type,
      payload: event as unknown,
    })
    .select("event_id")
    .maybeSingle();
  if (dedupe.error) {
    if ((dedupe.error as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: true, replay: true });
    }
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  if (!dedupe.data) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  switch (event.event_type) {
    case "BILLING.SUBSCRIPTION.ACTIVATED": {
      const r = event.resource as
        | { id?: string; billing_info?: { next_billing_time?: string } }
        | undefined;
      if (!r?.id) break;
      const { data: subRow } = await svc
        .from("subscriptions")
        .select("id, status, customer_id, plan_id")
        .eq("paypal_subscription_id", r.id)
        .single();
      // Guard against out-of-order delivery: never reactivate a cancelled sub.
      if (subRow && subRow.status !== "cancelled") {
        await svc
          .from("subscriptions")
          .update({
            status: "active" as SubscriptionStatus,
            started_at: new Date().toISOString(),
            next_billing_at: r.billing_info?.next_billing_time ?? null,
            cancelled_at: null,
          })
          .eq("id", subRow.id);
        await svc.rpc("apply_discount_to_subscription", {
          p_subscription_id: subRow.id,
        });
        // Notify the customer their plan is live (fire-and-forget; no-op without Resend).
        const [{ data: prof }, { data: plan }] = await Promise.all([
          svc.from("profiles").select("email").eq("id", subRow.customer_id).maybeSingle(),
          svc.from("plans").select("name").eq("id", subRow.plan_id).maybeSingle(),
        ]);
        if (prof?.email) {
          // Awaited so the email actually sends before the webhook returns.
          await sendSubscriptionActivated({ to: prof.email, planName: plan?.name ?? "your plan" });
        }
        void trackServer(subRow.customer_id, "subscription_activated", {
          plan_id: subRow.plan_id,
        });
      }
      break;
    }
    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED":
    case "BILLING.SUBSCRIPTION.SUSPENDED": {
      const r = event.resource as { id?: string } | undefined;
      if (!r?.id) break;
      const status: SubscriptionStatus =
        event.event_type === "BILLING.SUBSCRIPTION.CANCELLED"
          ? "cancelled"
          : event.event_type === "BILLING.SUBSCRIPTION.EXPIRED"
          ? "expired"
          : "suspended";
      // Only flip cancelled_at on a real cancellation. SUSPENDED is recoverable;
      // EXPIRED is end-of-term, separate from a user-initiated cancel.
      const updates: { status: SubscriptionStatus; cancelled_at?: string } = { status };
      if (status === "cancelled") {
        updates.cancelled_at = new Date().toISOString();
      }
      await svc
        .from("subscriptions")
        .update(updates)
        .eq("paypal_subscription_id", r.id);
      break;
    }
    case "PAYMENT.SALE.COMPLETED":
    case "PAYMENT.CAPTURE.COMPLETED": {
      const r = event.resource as
        | {
            id?: string;
            billing_agreement_id?: string;
            amount?: { total?: string; value?: string; currency?: string };
          }
        | undefined;
      if (!r?.id) break;
      const rawAmount = r.amount?.total ?? r.amount?.value;
      if (rawAmount == null) break;
      const parsedAmount = Number(rawAmount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) break;
      const cents = Math.round(parsedAmount * 100);
      const { data: subRow } = await svc
        .from("subscriptions")
        .select("id, customer_id")
        .eq("paypal_subscription_id", r.billing_agreement_id ?? "")
        .single();
      if (subRow) {
        await svc.from("payments").upsert(
          {
            paypal_capture_id: r.id,
            customer_id: subRow.customer_id,
            subscription_id: subRow.id,
            amount_aud_cents: cents,
            currency: r.amount?.currency ?? "AUD",
            status: "completed",
            paid_at: new Date().toISOString(),
          },
          { onConflict: "paypal_capture_id" },
        );
      }
      break;
    }
    case "PAYMENT.SALE.REFUNDED":
    case "PAYMENT.CAPTURE.REFUNDED": {
      // Best-effort: flip the original capture/sale's payment row to refunded.
      // PayPal carries the original id in sale_id (SALE.REFUNDED) or an "up"
      // link (CAPTURE.REFUNDED).
      const r = event.resource as
        | { id?: string; sale_id?: string; links?: { rel?: string; href?: string }[] }
        | undefined;
      const captureId =
        r?.sale_id ?? r?.links?.find((l) => l.rel === "up")?.href?.split("/").pop() ?? null;
      if (captureId) {
        await svc
          .from("payments")
          .update({ status: "refunded" })
          .eq("paypal_capture_id", captureId);
      }
      break;
    }
    case "BILLING.SUBSCRIPTION.RE-ACTIVATED": {
      const r = event.resource as { id?: string } | undefined;
      if (!r?.id) break;
      // Reactivation after a suspension. Never resurrect a real cancellation.
      await svc
        .from("subscriptions")
        .update({ status: "active" as SubscriptionStatus, cancelled_at: null })
        .eq("paypal_subscription_id", r.id)
        .neq("status", "cancelled");
      break;
    }
  }

  await svc.from("audit_log").insert({
    actor_id: null,
    action: "paypal_webhook",
    entity_type: "subscription",
    entity_id: event.id,
    payload: event as object,
  });

  return NextResponse.json({ ok: true });
}
