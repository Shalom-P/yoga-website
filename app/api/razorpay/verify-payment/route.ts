import "server-only";

import crypto from "node:crypto";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { isRazorpayConfigured } from "@/lib/razorpay/client";
import { fulfillRazorpayPayment } from "@/lib/razorpay/fulfillment";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// node:crypto + the Razorpay SDK require the Node runtime.
export const runtime = "nodejs";

/**
 * POST /api/razorpay/verify-payment
 *
 * Confirms a Checkout success payload and fulfils the purchase:
 *  1. Recompute the HMAC-SHA256 signature over "<order_id>|<payment_id>" and
 *     compare it constant-time — proves the payload is authentic.
 *  2. fulfillRazorpayPayment re-checks capture against the Razorpay API and
 *     grants the pack's credits server-side, idempotently (a replay, or the
 *     webhook racing this call, is a no-op). The grant NEVER happens client-side.
 *
 * This is the optimistic, fast-feedback path; /api/razorpay/webhook is the
 * authoritative backstop for when the browser never makes it back here.
 */

const bodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(req: Request): Promise<Response> {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret || !isRazorpayConfigured()) {
    return Response.json({ error: "Razorpay is not configured." }, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ verified: false, error: "Sign in required." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ verified: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ verified: false, error: "Missing required fields" }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  // 1. Cryptographic signature check (constant-time; guard length first because
  //    timingSafeEqual throws on a length mismatch).
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(razorpay_signature, "utf8");
  const signatureValid =
    expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
  if (!signatureValid) {
    return Response.json({ verified: false, error: "Signature verification failed" }, { status: 400 });
  }

  // 2. Confirm capture + grant credits server-side (idempotent). Bind the order
  //    to the signed-in caller so one user can't fulfil/inspect another's order.
  try {
    const result = await fulfillRazorpayPayment(razorpay_order_id, razorpay_payment_id, {
      expectedCustomerId: user.id,
    });
    if (!result.ok) {
      if (result.reason === "customer_mismatch") {
        return Response.json({ verified: false, error: "Not your order" }, { status: 403 });
      }
      // A still-uncaptured payment (rare now that fulfilment captures on-authorize)
      // is PENDING, not failed: the customer was charged and the webhook backstop
      // settles it shortly. Tell the UI so, instead of a scary hard error.
      if (result.reason.startsWith("not_paid")) {
        Sentry.captureMessage(`razorpay verify pending capture: ${result.reason}`, "info");
        return Response.json(
          {
            verified: false,
            pending: true,
            reason: result.reason,
            error:
              "Payment received. We're still confirming it, so your sessions may take a moment to appear. If they don't show up shortly, contact support and we'll add them right away.",
          },
          { status: 202 },
        );
      }
      Sentry.captureMessage(`razorpay verify fulfil failed: ${result.reason}`, "warning");
      return Response.json(
        {
          verified: false,
          reason: result.reason,
          error:
            "Payment received but not yet confirmed. If you were charged, contact support and we'll sort it out right away.",
        },
        { status: 400 },
      );
    }
    return Response.json({
      verified: true,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      credits: result.credits,
    });
  } catch (err) {
    // Razorpay unreachable / fetch failed — don't grant value; let the webhook
    // (or a client retry) settle it.
    Sentry.captureException(err, { tags: { route: "razorpay/verify-payment" } });
    return Response.json({ verified: false, error: "Could not confirm payment status" }, { status: 502 });
  }
}
