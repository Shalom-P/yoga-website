"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Ban, Check, Clock, Copy, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/i18n/money";
import { DEFAULT_CUSTOMER_TZ, formatInTz } from "@/lib/timezone";
import { friendlyAdminError } from "@/lib/ui/errors";
import type { PaymentActionResponse } from "@/lib/admin/contracts";
import type { PaymentEntrySource, PaymentMethod, PaymentStatus } from "@/lib/supabase/types";

export type PaymentRow = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  plan_name: string | null;
  session_credits: number | null;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  /** How the money moved. */
  method: PaymentMethod;
  /** How the row got here. 0039. */
  entry_source: PaymentEntrySource;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  reference: string | null;
  admin_note: string | null;
  recorded_by_name: string | null;
  paid_at: string | null;
  reconciled_at: string | null;
  created_at: string;
  verified_at: string | null;
};

/** A pack an admin can attribute a hand-entered payment to. */
export type PackOption = { id: string; name: string; session_credits: number };

type Filters = { rail: string; status: string; q: string };

const RAIL_LABEL: Record<PaymentMethod, string> = {
  razorpay: "Razorpay",
  bank_transfer: "Bank transfer",
  manual: "Offline",
  paypal: "PayPal",
};

/**
 * `Intl.NumberFormat` throws on an invalid ISO 4217 code, and this table now
 * shows legacy rows (AUD from the pre-2026 market) alongside current ones. A
 * throw inside a cell takes the whole table down, so a bad code degrades to the
 * raw figure instead of losing the page.
 */
function safeMoney(cents: number, currency: string): string {
  try {
    return formatMoney(cents, currency);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/**
 * Dates render in IST, the timezone the studio actually operates in. The old
 * `new Date(x).toLocaleDateString("en-GB")` used whatever zone the admin's
 * laptop was in, so a late-evening IST capture displayed a day early for anyone
 * looking from the UAE.
 */
function dayInIst(iso: string | null): string {
  if (!iso) return "-";
  return formatInTz(iso, DEFAULT_CUSTOMER_TZ, "d MMM yyyy");
}

export function PaymentsAdmin({
  rows,
  filters,
  total,
}: {
  rows: PaymentRow[];
  filters: Filters;
  total: number;
}) {
  const router = useRouter();
  const [verifyTarget, setVerifyTarget] = useState<PaymentRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PaymentRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(filters.q);
  const [copied, setCopied] = useState<string | null>(null);

  const hasFilters = Boolean(filters.rail || filters.status || filters.q);

  function applyFilters(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    const params = new URLSearchParams();
    if (next.rail) params.set("rail", next.rail);
    if (next.status) params.set("status", next.status);
    if (next.q) params.set("q", next.q);
    const qs = params.toString();
    router.push(qs ? `/admin/payments?${qs}` : "/admin/payments");
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied((c) => (c === value ? null : c)), 1500);
    } catch {
      toast.error("Could not copy that. Select it by hand instead.");
    }
  }

  async function act(row: PaymentRow, action: "verify" | "reject" | "resync") {
    setBusy(true);
    // A rejected fetch (offline, DNS) must not skip the busy reset: `busy`
    // disables every Verify/Reject/Resync button in the table as well as the
    // dialog's own Back button, so leaving it true strands the whole page on the
    // one screen where money moves. Same try/catch/finally shape as the roster
    // drawer and the session dialogs.
    try {
      const res = await fetch(`/api/admin/payments/${row.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(friendlyAdminError(body?.error));
        return;
      }

      const who = row.customer_name ?? row.customer_email ?? "customer";
      const body = (await res.json().catch(() => null)) as PaymentActionResponse | null;

      if (action === "verify") {
        const balance = body && "balance" in body ? body.balance : null;
        const credits = row.session_credits ?? 0;
        toast.success(
          `Verified ${who}'s payment. ${credits} prepaid session${credits === 1 ? "" : "s"} released` +
            (balance != null ? `, new balance ${balance}.` : "."),
        );
      } else if (action === "reject") {
        toast.success(`Rejected ${who}'s pending payment. No sessions were released.`);
      } else {
        // Resync is the manual backstop for refunds while the Razorpay webhook
        // secret is unset in production: it asks Razorpay what actually happened
        // and reconciles this row to that answer.
        const outcome = body && "outcome" in body ? body.outcome : "none";
        const razorpayStatus = body && "razorpayStatus" in body ? body.razorpayStatus : "unknown";
        toast.success(
          outcome === "completed"
            ? `Razorpay confirms this was captured. Sessions released for ${who}.`
            : outcome === "reversed"
              ? `Razorpay shows this was refunded. The sessions have been taken back from ${who}.`
              : `Checked with Razorpay: ${razorpayStatus}. Nothing needed changing.`,
        );
      }

      setVerifyTarget(null);
      setRejectTarget(null);
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters({ q: search.trim() });
          }}
        >
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Payment id, order id or reference"
            className="w-64"
          />
          <Button type="submit" variant="outline" size="sm">
            <Search className="size-3.5 mr-1" />
            Find
          </Button>
        </form>

        <Select
          value={filters.rail || "all"}
          onValueChange={(v) => v && applyFilters({ rail: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rails</SelectItem>
            <SelectItem value="razorpay">Razorpay</SelectItem>
            <SelectItem value="bank_transfer">Bank transfer</SelectItem>
            <SelectItem value="manual">Offline</SelectItem>
            <SelectItem value="paypal">PayPal</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.status || "all"}
          onValueChange={(v) => v && applyFilters({ status: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Awaiting verification</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="failed">Rejected or failed</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              router.push("/admin/payments");
            }}
          >
            <X className="size-3.5 mr-1" />
            Clear filters
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {total} payment{total === 1 ? "" : "s"}
          {hasFilters ? " matching" : ""}
        </span>
      </div>

      <div className="myc-glass overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr>
              <th className="bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">Customer</th>
              <th className="bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">Pack</th>
              <th className="bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">Amount</th>
              <th className="bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">Rail</th>
              <th className="bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">Reference</th>
              <th className="bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">Paid</th>
              <th className="bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">Status</th>
              <th className="bg-foreground/4 px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              // The route gates per action, and so does this, or a button ends
              // up offering something the server refuses.
              //
              // Verify and Reject settle a row by hand, so they mirror the
              // route's provenance guard: only a bank transfer or a hand-keyed
              // row, and only while it is still pending. An automatically
              // fulfilled Razorpay row's status and credits belong to the
              // webhook.
              const adminActionable =
                (r.method === "bank_transfer" || r.entry_source === "admin_manual") &&
                r.status === "pending";
              // Resync is scoped differently ON PURPOSE. It writes nothing of
              // its own: it re-reads Razorpay and reconciles the row to that
              // answer, which is exactly what an automatically fulfilled row
              // needs while RAZORPAY_WEBHOOK_SECRET is unset and refunds are
              // not coming back on their own. The route accepts it for any row
              // carrying a razorpay_payment_id, whatever the entry_source, so
              // do not fold this back into adminActionable.
              const canResync = r.razorpay_payment_id !== null;
              return (
                <tr key={r.id} className="border-t border-border transition-colors hover:bg-foreground/4">
                  <td className="px-4 py-3">
                    <div>{r.customer_name ?? "-"}</div>
                    <div className="text-xs text-muted-foreground">{r.customer_email ?? "-"}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.plan_name ?? "-"}
                    {r.session_credits != null && (
                      <span className="text-xs"> · {r.session_credits} sessions</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{safeMoney(r.amount_cents, r.currency)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <Badge variant="secondary">{RAIL_LABEL[r.method]}</Badge>
                      <ProvenanceChip entrySource={r.entry_source} by={r.recorded_by_name} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {r.razorpay_payment_id ? (
                      <button
                        type="button"
                        onClick={() => copy(r.razorpay_payment_id as string)}
                        title={r.razorpay_payment_id}
                        className="inline-flex max-w-[11rem] items-center gap-1 font-mono transition-colors hover:text-foreground"
                      >
                        <span className="truncate">{r.razorpay_payment_id}</span>
                        {copied === r.razorpay_payment_id ? (
                          <Check className="size-3 shrink-0" />
                        ) : (
                          <Copy className="size-3 shrink-0" />
                        )}
                      </button>
                    ) : (
                      <span className="font-mono">{r.reference ?? "-"}</span>
                    )}
                    {r.admin_note && (
                      <div className="mt-1 max-w-[16rem] truncate" title={r.admin_note}>
                        {r.admin_note}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {dayInIst(r.paid_at ?? r.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {adminActionable && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setVerifyTarget(r)}>
                          <BadgeCheck className="size-3.5 mr-1" />
                          Verify payment
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setRejectTarget(r)}
                        >
                          <Ban className="size-3.5 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                    {canResync && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => act(r, "resync")}
                        disabled={busy}
                        title="Ask Razorpay what happened to this payment and reconcile this row to it."
                      >
                        <RefreshCw className="size-3.5 mr-1" />
                        Resync
                      </Button>
                    )}
                    {!adminActionable && !canResync && (
                      <span className="text-xs text-muted-foreground">
                        {dayInIst(r.verified_at)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center px-4 py-12 text-muted-foreground">
                  {hasFilters ? "No payments match these filters." : "No payments yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={verifyTarget !== null} onOpenChange={(o) => !o && setVerifyTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify this payment?</DialogTitle>
            <DialogDescription>
              Only do this once you have confirmed the money landed. This releases{" "}
              {verifyTarget?.session_credits ?? 0} prepaid session
              {verifyTarget?.session_credits === 1 ? "" : "s"} to{" "}
              {verifyTarget?.customer_name ?? verifyTarget?.customer_email} (
              {verifyTarget ? safeMoney(verifyTarget.amount_cents, verifyTarget.currency) : ""}
              {verifyTarget?.reference ? `, ref ${verifyTarget.reference}` : ""}).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyTarget(null)} disabled={busy}>
              Back
            </Button>
            <Button onClick={() => verifyTarget && act(verifyTarget, "verify")} disabled={busy}>
              {busy ? "Verifying..." : "Verify and release sessions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectTarget !== null} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this pending payment?</DialogTitle>
            <DialogDescription>
              Marks {rejectTarget?.customer_name ?? rejectTarget?.customer_email}&apos;s pending
              payment as failed. No prepaid sessions are released. Use this for abandoned or
              duplicate entries. The customer can start a new one at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={busy}>
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectTarget && act(rejectTarget, "reject")}
              disabled={busy}
            >
              {busy ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Where the row came from, as opposed to how the money moved. A hand-keyed row
 * carries real risk of being read as automatic (wrong amount, wrong customer,
 * no webhook behind it), so it says so on its face.
 */
function ProvenanceChip({
  entrySource,
  by,
}: {
  entrySource: PaymentEntrySource;
  by: string | null;
}) {
  if (entrySource === "admin_manual") {
    return (
      <span className="text-[11px] text-muted-foreground">
        Entered by hand{by ? ` by ${by}` : ""}
      </span>
    );
  }
  if (entrySource === "admin_manual_reconciled") {
    return <span className="text-[11px] text-muted-foreground">Confirmed by Razorpay</span>;
  }
  if (entrySource === "legacy") {
    return <span className="text-[11px] text-muted-foreground">Legacy PayPal</span>;
  }
  return null;
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-primary font-medium">
        <BadgeCheck className="size-3.5" /> Completed
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-[var(--myc-pill-amber-fg)] font-medium">
        <Clock className="size-3.5" /> Awaiting verification
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Ban className="size-3.5" /> {status === "failed" ? "Rejected" : "Refunded"}
    </span>
  );
}
