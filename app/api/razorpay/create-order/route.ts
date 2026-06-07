import "server-only";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { getRazorpayClient, isRazorpayConfigured } from "@/lib/razorpay/client";
import { getRazorpayProduct } from "@/lib/razorpay/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/razorpay/create-order
 *
 * Creates a Razorpay order for a signed-in customer and returns
 * { orderId, amount, currency }. Middleware does not run on /api/* (see
 * CLAUDE.md "Three auth-guard paths"), so this handler authenticates itself.
 *
 * The price is resolved server-side from the catalog by `productId` — the
 * client never sends an amount, so it can't tamper with what it's charged.
 */

const bodySchema = z.object({
  productId: z.string().trim().min(1).max(64),
  // Optional caller reference, surfaced in the Razorpay dashboard. Max 40 chars.
  receipt: z.string().trim().min(1).max(40).optional(),
});

export async function POST(req: Request): Promise<Response> {
  if (!isRazorpayConfigured()) {
    return Response.json({ error: "Razorpay is not configured." }, { status: 500 });
  }

  // Authenticate first — fail fast before touching the request body.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Sign in to start checkout." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Trusted price lookup — reject anything not in the catalog.
  const product = getRazorpayProduct(parsed.data.productId);
  if (!product) {
    return Response.json({ error: "Unknown product" }, { status: 400 });
  }

  try {
    const order = await getRazorpayClient().orders.create({
      amount: product.amount,
      currency: product.currency,
      receipt: parsed.data.receipt ?? `rcpt_${Date.now()}`,
      // Ties the order to the customer + product for later reconciliation.
      notes: { customerId: user.id, productId: parsed.data.productId },
    });

    return Response.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    // The SDK rejects with { statusCode, error } on API failures (see its
    // normalizeError); a network failure surfaces here as a generic throw.
    const e = err as { statusCode?: number; error?: { description?: string } };
    const status = e?.statusCode === 401 ? 401 : 500;
    Sentry.captureException(err, { tags: { route: "razorpay/create-order" } });
    const message =
      status === 401
        ? "Razorpay authentication failed — check your API keys."
        : e?.error?.description ?? "Failed to create Razorpay order.";
    return Response.json({ error: message }, { status });
  }
}
