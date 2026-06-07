import "server-only";

import crypto from "node:crypto";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { getRazorpayClient, isRazorpayConfigured } from "@/lib/razorpay/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/razorpay/verify-payment
 *
 * Confirms a Checkout success payload, in two steps:
 *  1. Recompute the HMAC-SHA256 signature over "<order_id>|<payment_id>" and
 *     compare it (constant-time) to what Razorpay returned. This proves the
 *     payload is authentic.
 *  2. Fetch the payment from Razorpay and confirm it is actually captured/
 *     authorized and bound to this order. A valid signature alone does NOT
 *     prove money changed hands, so this guards against treating a created/
 *     failed payment as paid.
 *
 * Returns 200 { verified: true } only when both pass.
 *
 * NOTE: this is not yet replay-safe — replaying a genuine (order, payment,
 * signature) triple still returns verified:true. True idempotency requires
 * persisting the payment id and rejecting duplicates, which needs a
 * hand-written Supabase migration (see CLAUDE.md "Schema ownership"). TODO.
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
    expectedBuf.length === actualBuf.length &&
    crypto.timingSafeEqual(expectedBuf, actualBuf);

  if (!signatureValid) {
    // Signature mismatch — DO NOT mark as paid.
    return Response.json({ verified: false, error: "Signature verification failed" }, { status: 400 });
  }

  // 2. Confirm the payment is real and paid, straight from Razorpay.
  try {
    const payment = await getRazorpayClient().payments.fetch(razorpay_payment_id);
    const boundToOrder = payment.order_id === razorpay_order_id;
    const paid = payment.status === "captured" || payment.status === "authorized";
    if (!boundToOrder || !paid) {
      return Response.json(
        { verified: false, error: "Payment not captured", status: payment.status },
        { status: 400 },
      );
    }

    return Response.json({
      verified: true,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
    });
  } catch (err) {
    // Razorpay unreachable / fetch failed — don't grant value; let the client retry.
    Sentry.captureException(err, { tags: { route: "razorpay/verify-payment" } });
    return Response.json({ verified: false, error: "Could not confirm payment status" }, { status: 502 });
  }
}
