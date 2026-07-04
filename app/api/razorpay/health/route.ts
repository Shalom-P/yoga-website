import { NextResponse } from "next/server";

import { getRazorpayClient, isRazorpayConfigured } from "@/lib/razorpay/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The Razorpay SDK requires the Node runtime.
export const runtime = "nodejs";
// Always evaluate live — never serve a cached config snapshot.
export const dynamic = "force-dynamic";

/**
 * GET /api/razorpay/health — admin-only Razorpay configuration check.
 *
 * Reports whether the server's RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET pair is
 * present AND actually accepted by Razorpay (a read-only `orders.all` probe that
 * creates nothing), plus the key mode (test/live), whether the publishable key
 * matches the server key, and whether the webhook secret is set.
 *
 * It NEVER returns a secret — only a 4-char key-id fingerprint and booleans.
 * Open it in the browser while signed in as an admin after a deploy to confirm
 * the keys took effect, instead of inferring from the checkout 401 toast.
 */
function keyMode(keyId: string | undefined): "live" | "test" | "unset" | "unknown" {
  if (!keyId) return "unset";
  if (keyId.startsWith("rzp_live_")) return "live";
  if (keyId.startsWith("rzp_test_")) return "test";
  return "unknown";
}

export async function GET(): Promise<Response> {
  // Middleware doesn't run on /api/* — authenticate + gate inline.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const serverKeyId = process.env.RAZORPAY_KEY_ID;
  const publicKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

  const report = {
    configured: isRazorpayConfigured(),
    mode: keyMode(serverKeyId),
    serverKeyIdLast4: serverKeyId ? serverKeyId.slice(-4) : null,
    publicKeyMatchesServer: Boolean(serverKeyId) && serverKeyId === publicKeyId,
    webhookSecretSet: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
    apiAuth: "not_configured" as "ok" | "unauthorized" | "error" | "not_configured",
    apiError: null as string | null,
  };

  if (report.configured) {
    try {
      // Read-only auth probe — lists at most one order, creates nothing.
      await getRazorpayClient().orders.all({ count: 1 });
      report.apiAuth = "ok";
    } catch (err) {
      const e = err as { statusCode?: number; error?: { description?: string } };
      report.apiAuth = e?.statusCode === 401 ? "unauthorized" : "error";
      report.apiError =
        e?.error?.description ?? (e?.statusCode ? `HTTP ${e.statusCode}` : "request failed");
    }
  }

  const ok = report.configured && report.apiAuth === "ok" && report.publicKeyMatchesServer;
  return NextResponse.json({ ok, ...report });
}
