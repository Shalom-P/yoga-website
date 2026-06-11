import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Add-only by design: the schema rejects non-positive amounts and the
// grant_session_credits RPC independently refuses delta <= 0.
const schema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().int().min(1).max(100),
});

async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return data?.role === "admin";
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { customerId, amount } = parsed.data;

  const svc = createSupabaseServiceClient();

  const { data: customer } = await svc
    .from("profiles")
    .select("id")
    .eq("id", customerId)
    .single();
  if (!customer) return NextResponse.json({ error: "customer_not_found" }, { status: 404 });

  const { error: grantErr } = await svc.rpc("grant_session_credits", {
    p_customer: customerId,
    p_delta: amount,
    p_reason: "admin_adjust",
    p_payment_id: null,
  });
  if (grantErr) return NextResponse.json({ error: "grant_failed" }, { status: 500 });

  const { data: bal } = await svc
    .from("customer_credits")
    .select("balance")
    .eq("customer_id", customerId)
    .maybeSingle();

  return NextResponse.json({ ok: true, balance: bal?.balance ?? amount });
}
