import "server-only";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { getRazorpayClient, isRazorpayConfigured } from "@/lib/razorpay/client";
import { resolvePackBySlug } from "@/lib/razorpay/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canTransactFromTimezone, OUTSIDE_AUSTRALIA_ERROR } from "@/lib/geo/australia";

// The Razorpay SDK requires the Node runtime.
export const runtime = "nodejs";

/**
 * POST /api/razorpay/create-order
 *
 * Creates a Razorpay order for a signed-in customer buying a session pack and
 * returns { orderId, amount, currency }. Middleware does not run on /api/* (see
 * CLAUDE.md "Three auth-guard paths"), so this handler authenticates itself.
 *
 * The price + credit count are resolved server-side from the `plans` table by
 * `planSlug` — the client never sends an amount, so it can't tamper with what
 * it's charged. The order's notes bind it to the customer + plan so fulfilment
 * (verify-payment / webhook) can credit the right account for the right pack.
 */

const bodySchema = z.object({
  planSlug: z.string().trim().min(1).max(64),
  // The visitor's live browser timezone (IANA id). Used only for the
  // Australia-only purchase gate below — the price is never client-supplied.
  clientTimezone: z.string().trim().min(1).max(64),
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

  // Australia-only purchase gate. Non-admin customers must be in an Australian
  // timezone to buy a pack; admins may operate from anywhere. This is the single
  // choke point for purchases — no order means no Checkout and no fulfilment.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (
    !canTransactFromTimezone({
      isAdmin: profile?.role === "admin",
      timezone: parsed.data.clientTimezone,
    })
  ) {
    return Response.json(
      {
        error: OUTSIDE_AUSTRALIA_ERROR,
        message: "Session packs can only be purchased from within Australia.",
      },
      { status: 403 },
    );
  }

  // Trusted price lookup — reject anything that isn't an active plan.
  const pack = await resolvePackBySlug(parsed.data.planSlug);
  if (!pack) {
    return Response.json({ error: "Unknown plan" }, { status: 400 });
  }

  try {
    const order = await getRazorpayClient().orders.create({
      amount: pack.amount,
      currency: pack.currency,
      // Razorpay caps receipt at 40 chars.
      receipt: `plan_${pack.slug}_${Date.now()}`.slice(0, 40),
      notes: { customerId: user.id, planSlug: pack.slug, planId: pack.planId },
    });

    return Response.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    // The SDK rejects with { statusCode, error } on API failures; a network
    // failure surfaces here as a generic throw.
    const e = err as { statusCode?: number; error?: { description?: string } };
    Sentry.captureException(err, { tags: { route: "razorpay/create-order" } });
    // A 401 from Razorpay means bad API keys (our config problem), not a user
    // auth failure. Return 502 so the client's "401 = not signed in" branch
    // doesn't fire and mislead the user.
    const status = e?.statusCode === 401 ? 502 : 500;
    const message =
      e?.statusCode === 401
        ? "Razorpay authentication failed — check your API keys."
        : e?.error?.description ?? "Failed to create Razorpay order.";
    return Response.json({ error: message }, { status });
  }
}
