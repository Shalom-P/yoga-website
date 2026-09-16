import Link from "next/link";

import { requireAdmin } from "@/lib/auth/guards";
import { PaymentsAdmin, type PaymentRow, type PackOption } from "@/components/admin/PaymentsAdmin";
import { RecordPaymentButton } from "@/components/admin/RecordPaymentButton";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import type { PaymentMethod, PaymentStatus } from "@/lib/supabase/types";

const PAGE_SIZE = 50;

const RAILS: PaymentMethod[] = ["razorpay", "bank_transfer", "manual", "paypal"];
const STATUSES: PaymentStatus[] = ["pending", "completed", "refunded", "failed"];

// Razorpay ids and receipt references are opaque tokens, so a search on them is
// an exact match, never an ilike. Anything outside this alphabet cannot appear
// in one and would only risk breaking PostgREST's `or` grammar.
const SAFE_REF = /[^A-Za-z0-9_-]/g;

/**
 * Every payment on every rail.
 *
 * This page used to filter `.eq("method", "bank_transfer")`, which meant no
 * Razorpay payment had ever been visible anywhere in the admin console: the
 * only rail an operator could see was the one that needs a human, and the one
 * that carries most of the money was invisible. It now lists all of them and
 * distinguishes them with a rail pill plus a provenance chip, so a row someone
 * keyed in by hand is never mistaken for one the webhook wrote.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ rail?: string; status?: string; q?: string; page?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const rail = RAILS.includes(sp.rail as PaymentMethod) ? (sp.rail as PaymentMethod) : "";
  const status = STATUSES.includes(sp.status as PaymentStatus) ? (sp.status as PaymentStatus) : "";
  const q = (sp.q ?? "").replace(SAFE_REF, "").trim().slice(0, 64);

  // Filters go on before order/range: `.order()` narrows the builder to the
  // transform stage, which no longer accepts `.eq()`.
  let query = supabase
    .from("payments")
    .select(
      `id, customer_id, plan_id, amount_cents, currency, status, method, entry_source,
       razorpay_payment_id, razorpay_order_id, reference, admin_note, recorded_by,
       paid_at, reconciled_at, created_at, verified_at`,
      { count: "exact" },
    );

  if (rail) query = query.eq("method", rail);
  if (status) query = query.eq("status", status);
  if (q) {
    query = query.or(
      `razorpay_payment_id.eq.${q},razorpay_order_id.eq.${q},reference.eq.${q}`,
    );
  }

  const { data: payments, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  const rowsRaw = payments ?? [];

  // customer_id is nullable since 0035 (account deletion detaches payments for
  // tax retention). A null inside .in() errors the whole profiles query, so
  // filter like plan_id below. recorded_by rides along in the same read: it
  // points at an admin profile, not a customer, but it is the same table.
  const profileIds = [
    ...new Set(
      rowsRaw
        .flatMap((p) => [p.customer_id, p.recorded_by])
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  const planIds = [...new Set(rowsRaw.map((p) => p.plan_id).filter((x): x is string => Boolean(x)))];

  const [{ data: profiles }, { data: plans }, { data: packs }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").in("id", profileIds),
    supabase.from("plans").select("id, name, session_credits").in("id", planIds),
    // Every pack, active or not: a customer who paid for a since-hidden pack
    // still has to be creditable, the same reason resolvePackById does not
    // filter on is_active either.
    supabase
      .from("plans")
      .select("id, name, session_credits")
      .order("sort_order", { ascending: true }),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const planById = new Map((plans ?? []).map((p) => [p.id, p]));

  const rows: PaymentRow[] = rowsRaw.map((p) => {
    const customer = p.customer_id ? profileById.get(p.customer_id) : undefined;
    const plan = p.plan_id ? planById.get(p.plan_id) : undefined;
    const recorder = p.recorded_by ? profileById.get(p.recorded_by) : undefined;
    return {
      id: p.id,
      customer_name: p.customer_id ? (customer?.full_name ?? null) : "Deleted account",
      customer_email: customer?.email ?? null,
      plan_name: plan?.name ?? null,
      session_credits: plan?.session_credits ?? null,
      amount_cents: p.amount_cents,
      currency: p.currency,
      status: p.status,
      method: p.method,
      entry_source: p.entry_source,
      razorpay_payment_id: p.razorpay_payment_id,
      razorpay_order_id: p.razorpay_order_id,
      reference: p.reference,
      admin_note: p.admin_note,
      recorded_by_name: recorder?.full_name ?? recorder?.email ?? null,
      paid_at: p.paid_at,
      reconciled_at: p.reconciled_at,
      created_at: p.created_at,
      verified_at: p.verified_at,
    };
  });

  const packOptions: PackOption[] = (packs ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    session_credits: p.session_credits,
  }));

  const pendingCount = rows.filter(
    (r) =>
      r.status === "pending" &&
      (r.method === "bank_transfer" || r.entry_source === "admin_manual"),
  ).length;

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  function pageHref(next: number): string {
    const params = new URLSearchParams();
    if (rail) params.set("rail", rail);
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    if (next > 1) params.set("page", String(next));
    const qs = params.toString();
    return qs ? `/admin/payments?${qs}` : "/admin/payments";
  }

  return (
    <div>
      <AdminPageHeader
        eyebrow="Operations"
        title="Payments"
        sub={
          <>
            Every payment on every rail. Bank transfers need a verify before prepaid sessions are
            released.
            {pendingCount > 0 && (
              <strong className="ml-1 font-semibold text-foreground">
                {pendingCount} awaiting verification.
              </strong>
            )}
          </>
        }
        actions={<RecordPaymentButton plans={packOptions} />}
      />
      <div className="mt-6">
        <PaymentsAdmin
          rows={rows}
          filters={{ rail, status, q }}
          total={count ?? rows.length}
        />
      </div>
      {totalPages > 1 && (
        <div className="mt-6 flex items-center gap-3">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageHref(page - 1)}>← Previous</Link>
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
            {count != null && ` · ${count} total`}
          </span>
          {page < totalPages && (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageHref(page + 1)}>Next →</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
