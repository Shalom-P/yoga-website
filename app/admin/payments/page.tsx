import { requireAdmin } from "@/lib/auth/guards";
import { PaymentsAdmin, type BankTransferRow } from "@/components/admin/PaymentsAdmin";

/**
 * Manual UAE bank-transfer verification queue. Lists every bank-transfer payment
 * (newest first) so an admin can verify an incoming SWIFT transfer — which
 * releases the pack's session credits — or reject an abandoned one. India keeps
 * Razorpay, so those payments never appear here.
 */
export default async function AdminPaymentsPage() {
  const { supabase } = await requireAdmin();

  const { data: payments } = await supabase
    .from("payments")
    .select(
      "id, customer_id, plan_id, amount_cents, currency, status, reference, created_at, verified_at",
    )
    .eq("method", "bank_transfer")
    .order("created_at", { ascending: false })
    .limit(200);

  const rowsRaw = payments ?? [];
  // customer_id is nullable since 0035 (account deletion detaches payments for
  // tax retention). A null inside .in() errors the whole profiles query, so
  // filter like plan_id below.
  const customerIds = [
    ...new Set(rowsRaw.map((p) => p.customer_id).filter((x): x is string => Boolean(x))),
  ];
  const planIds = [...new Set(rowsRaw.map((p) => p.plan_id).filter((x): x is string => Boolean(x)))];

  const [{ data: profiles }, { data: plans }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").in("id", customerIds),
    supabase.from("plans").select("id, name, session_credits").in("id", planIds),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const planById = new Map((plans ?? []).map((p) => [p.id, p]));

  const rows: BankTransferRow[] = rowsRaw.map((p) => {
    const customer = p.customer_id ? profileById.get(p.customer_id) : undefined;
    const plan = p.plan_id ? planById.get(p.plan_id) : undefined;
    return {
      id: p.id,
      customer_name: p.customer_id ? (customer?.full_name ?? null) : "Deleted account",
      customer_email: customer?.email ?? null,
      plan_name: plan?.name ?? null,
      session_credits: plan?.session_credits ?? null,
      amount_cents: p.amount_cents,
      currency: p.currency,
      status: p.status,
      reference: p.reference,
      created_at: p.created_at,
      verified_at: p.verified_at,
    };
  });

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="p-8 max-w-7xl">
      <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
        Bank transfers
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        UAE customers paying by SWIFT. Verify each transfer to release their session credits.
        {pendingCount > 0 && (
          <span className="ml-1 font-medium text-foreground">
            {pendingCount} awaiting verification.
          </span>
        )}
      </p>
      <div className="mt-6">
        <PaymentsAdmin rows={rows} />
      </div>
    </div>
  );
}
