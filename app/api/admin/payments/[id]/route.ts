import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// grant_session_credits + service-role client; Node runtime.
export const runtime = "nodejs";

/**
 * POST /api/admin/payments/[id]  — admin-only verification of a manual UAE
 * bank-transfer payment. Middleware does not run on /api/*, so this authes
 * itself and re-checks the admin role inline.
 *
 *   action: "verify" → grant the pack's credits, then mark the transfer
 *            completed. The grant runs FIRST and ALWAYS (it's purchase-once on
 *            the payment id, so a re-verify is a no-op and a verify whose grant
 *            previously failed self-heals); ordering it before the conditional
 *            status flip means a grant failure leaves the row retryable, never
 *            stranded 'completed' with no credits.
 *   action: "reject" → mark a still-pending transfer failed (no credits).
 */
const schema = z.object({ action: z.enum(["verify", "reject"]) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

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

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const svc = createSupabaseServiceClient();
  const { data: payment } = await svc
    .from("payments")
    .select("id, customer_id, plan_id, method, status")
    .eq("id", id)
    .maybeSingle();
  if (!payment) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (payment.method !== "bank_transfer") {
    return NextResponse.json({ error: "not_bank_transfer" }, { status: 400 });
  }

  if (parsed.data.action === "reject") {
    // Don't claim "rejected" for a row that isn't actually pending — a completed
    // (credited) row must not look rejected, and a stale call should say so.
    if (payment.status === "completed") {
      return NextResponse.json({ error: "already_completed" }, { status: 409 });
    }
    if (payment.status !== "pending") {
      return NextResponse.json({ error: "not_pending" }, { status: 409 });
    }
    await svc
      .from("payments")
      .update({ status: "failed", verified_by: user.id, verified_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending");
    return NextResponse.json({ ok: true, status: "failed" });
  }

  // verify ---------------------------------------------------------------
  // Pending or already-completed can be (re-)verified; failed/refunded are terminal.
  if (payment.status !== "pending" && payment.status !== "completed") {
    return NextResponse.json({ error: "not_pending" }, { status: 409 });
  }
  if (!payment.plan_id) {
    return NextResponse.json({ error: "missing_plan" }, { status: 400 });
  }

  const { data: plan } = await svc
    .from("plans")
    .select("session_credits")
    .eq("id", payment.plan_id)
    .maybeSingle();
  const credits = plan?.session_credits ?? 0;
  if (credits <= 0) return NextResponse.json({ error: "no_credits_for_plan" }, { status: 400 });

  // Grant FIRST and ALWAYS. grant_session_credits is idempotent on the payment id
  // (purchase-once ledger index), so a re-verify is a no-op and a verify whose
  // earlier grant failed self-heals on retry. Granting before the status flip
  // means a grant failure leaves the row 'pending' (still retryable) instead of
  // stranded 'completed' with no credits.
  const { error: grantErr } = await svc.rpc("grant_session_credits", {
    p_customer: payment.customer_id,
    p_delta: credits,
    p_reason: "purchase",
    p_payment_id: payment.id,
  });
  if (grantErr) return NextResponse.json({ error: "grant_failed" }, { status: 500 });

  // Record the verification — only flips a still-pending row (a concurrent verify
  // or a re-verify of an already-completed row is a harmless no-op here).
  const { error: updErr } = await svc
    .from("payments")
    .update({
      status: "completed",
      paid_at: new Date().toISOString(),
      verified_by: user.id,
      verified_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");
  if (updErr) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  const { data: bal } = await svc
    .from("customer_credits")
    .select("balance")
    .eq("customer_id", payment.customer_id)
    .maybeSingle();
  return NextResponse.json({ ok: true, status: "completed", balance: bal?.balance ?? credits });
}
