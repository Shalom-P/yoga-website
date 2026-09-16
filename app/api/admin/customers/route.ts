import { NextResponse } from "next/server";
import { z } from "zod";

import type { AdminCustomerRow, AdminCustomerSearchResponse } from "@/lib/admin/contracts";
import { requireAdminApi } from "@/lib/auth/apiGuards";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// The service-role client is a Node-only module. Nothing here reaches Google or
// the Razorpay SDK, but the runtime pin stays explicit so a future edit cannot
// accidentally inherit the Edge runtime.
export const runtime = "nodejs";

/**
 * GET /api/admin/customers?q=<query>
 *
 * Type-ahead for the admin enrol / record-payment pickers. Read-only: no audit
 * row, no side effects, safe to call on every keystroke.
 *
 * Two things it does that the /admin/customers page does not:
 *
 *   * it filters on role='customer'. An enrol picker must never offer a teacher
 *     or an admin account as a student, and the page's unfiltered list would.
 *   * it reads balances scoped to the ids it is about to return. The page's
 *     unbounded `customer_credits` select (app/admin/customers/page.tsx) quietly
 *     renders 0 credits for everyone past PostgREST's max-rows cap, and the
 *     balance here is what decides whether an enrolment can charge a session.
 */
const searchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

// PostgREST's `or` filter is a mini-DSL: a comma or a paren breaks the grammar,
// and %, _ and * are ilike wildcards. lib/billing/promo.ts sidesteps PostgREST
// ilike entirely for the same class of reason; here the input is narrow enough
// that an allow-list is the simpler answer. Anything outside it is dropped, not
// escaped, so there is no quoting to get wrong.
const SAFE_Q = /[^A-Za-z0-9@._\-+' ]/g;

export async function GET(req: Request): Promise<Response> {
  const gate = await requireAdminApi();
  if (gate instanceof NextResponse) return gate;

  const parsed = searchSchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const raw = parsed.data.q;
  const q = raw ? raw.replace(SAFE_Q, "").trim() : "";
  // A query that was entirely punctuation is a legitimate "nothing matches",
  // not a malformed request: answering 400 would make the picker flash an error
  // at someone who simply typed a bracket.
  if (raw !== undefined && q.length === 0) {
    return NextResponse.json({ ok: true, customers: [] } satisfies AdminCustomerSearchResponse);
  }

  const svc = createSupabaseServiceClient();

  let query = svc
    .from("profiles")
    .select("id, full_name, email, timezone")
    .eq("role", "customer");
  if (q.length > 0) {
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  }
  const { data: profiles, error } = await query
    .order("full_name", { nullsFirst: false })
    .limit(parsed.data.limit);
  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  const ids = (profiles ?? []).map((p) => p.id);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, customers: [] } satisfies AdminCustomerSearchResponse);
  }

  // Both follow-up reads are scoped to the ids above, so they stay small no
  // matter how large the customer table grows.
  const [{ data: credits }, { data: trials }] = await Promise.all([
    svc.from("customer_credits").select("customer_id, balance").in("customer_id", ids),
    svc
      .from("bookings")
      .select("customer_id")
      .in("customer_id", ids)
      .eq("is_free_trial", true)
      .neq("status", "cancelled"),
  ]);

  const balanceById = new Map((credits ?? []).map((c) => [c.customer_id, c.balance]));
  const withLiveTrial = new Set((trials ?? []).map((b) => b.customer_id));

  const customers: AdminCustomerRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: p.email,
    timezone: p.timezone,
    credits: balanceById.get(p.id) ?? 0,
    hasLiveFreeTrial: withLiveTrial.has(p.id),
  }));

  return NextResponse.json({ ok: true, customers } satisfies AdminCustomerSearchResponse);
}
