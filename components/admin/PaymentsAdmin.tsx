"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Ban, Clock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/i18n/money";
import type { PaymentStatus } from "@/lib/supabase/types";

export type BankTransferRow = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  plan_name: string | null;
  session_credits: number | null;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  reference: string | null;
  created_at: string;
  verified_at: string | null;
};

export function PaymentsAdmin({ rows }: { rows: BankTransferRow[] }) {
  const router = useRouter();
  const [verifyTarget, setVerifyTarget] = useState<BankTransferRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<BankTransferRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(row: BankTransferRow, action: "verify" | "reject") {
    setBusy(true);
    const res = await fetch(`/api/admin/payments/${row.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error ?? "Action failed.");
      return;
    }
    const who = row.customer_name ?? row.customer_email ?? "customer";
    if (action === "verify") {
      const { balance } = await res.json();
      toast.success(
        `Verified ${who}'s transfer. ${row.session_credits ?? 0} credit${
          row.session_credits === 1 ? "" : "s"
        } granted — new balance: ${balance ?? "—"}.`,
      );
    } else {
      toast.success(`Rejected ${who}'s pending transfer.`);
    }
    setVerifyTarget(null);
    setRejectTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-card overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pack</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reference</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Requested</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div>{r.customer_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.customer_email ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.plan_name ?? "—"}
                  {r.session_credits != null && (
                    <span className="text-xs"> · {r.session_credits} cr</span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">{formatMoney(r.amount_cents, r.currency)}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {r.reference ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("en-GB")}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {r.status === "pending" ? (
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
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {r.verified_at
                        ? new Date(r.verified_at).toLocaleDateString("en-GB")
                        : "—"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center px-4 py-12 text-muted-foreground">
                  No bank transfers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={verifyTarget !== null} onOpenChange={(o) => !o && setVerifyTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify this bank transfer?</DialogTitle>
            <DialogDescription>
              Only do this once you&apos;ve confirmed the SWIFT transfer landed in the account. This
              grants {verifyTarget?.session_credits ?? 0} session credit
              {verifyTarget?.session_credits === 1 ? "" : "s"} to{" "}
              {verifyTarget?.customer_name ?? verifyTarget?.customer_email} (
              {verifyTarget ? formatMoney(verifyTarget.amount_cents, verifyTarget.currency) : ""}
              {verifyTarget?.reference ? `, ref ${verifyTarget.reference}` : ""}).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => verifyTarget && act(verifyTarget, "verify")} disabled={busy}>
              {busy ? "Verifying…" : "Verify & grant credits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectTarget !== null} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this pending transfer?</DialogTitle>
            <DialogDescription>
              Marks {rejectTarget?.customer_name ?? rejectTarget?.customer_email}&apos;s pending
              transfer as failed. No credits are granted. Use this for abandoned or duplicate
              requests — the customer can start a new one anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectTarget && act(rejectTarget, "reject")}
              disabled={busy}
            >
              {busy ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-primary font-medium">
        <BadgeCheck className="size-3.5" /> Verified
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
        <Clock className="size-3.5" /> Awaiting verification
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Ban className="size-3.5" /> {status === "failed" ? "Rejected" : status}
    </span>
  );
}
