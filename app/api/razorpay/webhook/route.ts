import "server-only";

import crypto from "node:crypto";

import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { fulfillRazorpayPayment, reverseRazorpayPayment } from "@/lib/razorpay/fulfillment";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// node:crypto + the Razorpay SDK require the Node runtime.
export const runtime = "nodejs";

/**
 * POST /api/razorpay/webhook
 *
 * The authoritative fulfilment path. If the browser never returns to
 * verify-payment (closed tab, dropped network after capture), this still grants
 * the credits. Razorpay signs the raw body with the dashboard webhook secret
 * (RAZORPAY_WEBHOOK_SECRET) — distinct from the API key secret.
 *
 * Order matters: fulfil FIRST (it's idempotent on razorpay_payment_id), THEN
 * best-effort record the event. If we recorded first and fulfilment failed, the
 * retry would treat the event as already-seen and skip it. Re-fulfilling a paid
 * order is a no-op, so running it on every verified delivery is safe.
 */
type RazorpayWebhook = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string } };
    refund?: { entity?: { id?: string; payment_id?: string } };
  };
};

export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed — never accept an unverifiable webhook.
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 500 });
  }

  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature");
  if (!sig) return NextResponse.json({ error: "missing_signature" }, { status: 400 });

  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(sig, "utf8");
  const valid =
    expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
  if (!valid) return NextResponse.json({ error: "invalid_signature" }, { status: 400 });

  let event: RazorpayWebhook;
  try {
    event = JSON.parse(raw) as RazorpayWebhook;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const eventType = event.event;
  const entity = event.payload?.payment?.entity;

  // Replay short-circuit. A row in razorpay_webhook_events is written only AFTER
  // an event is fully processed below (failures return 5xx before the insert), so
  // a known event id means "already handled" — ack immediately and skip the
  // redundant Razorpay API round-trips. Fulfilment stays idempotent regardless,
  // so this is an optimization, not the safety guarantee.
  const eventId = req.headers.get("x-razorpay-event-id");
  const svc = createSupabaseServiceClient();
  if (eventId) {
    const { data: seen } = await svc
      .from("razorpay_webhook_events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();
    if (seen) return NextResponse.json({ ok: true, deduped: true });
  }

  // Fulfil first (idempotent). Return 5xx on a real failure so Razorpay retries.
  if (
    (eventType === "payment.captured" || eventType === "order.paid") &&
    entity?.id &&
    entity.order_id
  ) {
    try {
      const result = await fulfillRazorpayPayment(entity.order_id, entity.id);
      if (!result.ok && result.reason.startsWith("not_paid")) {
        // Authorized-but-not-captured etc. — ack so Razorpay stops retrying; the
        // capture event arrives separately and will fulfil then.
        return NextResponse.json({ ok: true, skipped: result.reason });
      }
      if (!result.ok) {
        Sentry.captureMessage(`razorpay webhook fulfil failed: ${result.reason}`, "warning");
        return NextResponse.json({ error: result.reason }, { status: 500 });
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { route: "razorpay/webhook" } });
      return NextResponse.json({ error: "fulfill_failed" }, { status: 500 });
    }
  }

  // Refund: claw back the granted credits (idempotent on the refund id). A full
  // refund is auto-reconciled; a partial refund is acked + flagged for manual
  // review (which credits to reclaim is a product decision).
  const refund = event.payload?.refund?.entity;
  if (
    (eventType === "refund.created" || eventType === "payment.refunded") &&
    refund?.id &&
    refund.payment_id
  ) {
    try {
      const result = await reverseRazorpayPayment(refund.payment_id, refund.id);
      if (!result.ok && result.reason === "partial_refund_manual") {
        Sentry.captureMessage(
          `razorpay partial refund needs manual credit review: payment=${refund.payment_id}`,
          "warning",
        );
        return NextResponse.json({ ok: true, skipped: result.reason });
      }
      if (!result.ok) {
        Sentry.captureMessage(`razorpay refund clawback failed: ${result.reason}`, "warning");
        return NextResponse.json({ error: result.reason }, { status: 500 });
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { route: "razorpay/webhook" } });
      return NextResponse.json({ error: "refund_failed" }, { status: 500 });
    }
  }

  // Record the processed event for audit + the replay short-circuit above. A
  // duplicate event id (race) lands in `error` and is ignored; supabase-js
  // doesn't throw on it.
  if (eventId) {
    try {
      await svc
        .from("razorpay_webhook_events")
        .insert({ event_id: eventId, event_type: eventType ?? null, payload: event as unknown });
    } catch {
      // ignore — the event record is informational only
    }
  }

  return NextResponse.json({ ok: true });
}
