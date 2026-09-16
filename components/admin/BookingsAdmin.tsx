"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldHint } from "@/components/ui/field-hint";
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
import { MoveBookingDialog, type MoveTarget } from "@/components/admin/MoveBookingDialog";
import { formatCustomerTime } from "@/lib/timezone";
import { friendlyAdminError } from "@/lib/ui/errors";
import { toast } from "sonner";
import type { BookingStatus, SessionStatus } from "@/lib/supabase/types";
import { AdminPageHeader } from "@/components/admin/AdminPage";

export type BookingRow = {
  id: string;
  status: BookingStatus;
  is_free_trial: boolean;
  /** 0039: an admin added this student without spending a prepaid session. */
  comped: boolean;
  /** 0039: a refund ledger row actually landed when this booking was cancelled. */
  credit_refunded: boolean;
  moved_from_session_id: string | null;
  cancellation_reason: string | null;
  created_at: string;
  customer: { id: string; full_name: string | null; email: string | null } | null;
  session: {
    id: string;
    start_at: string;
    capacity: number;
    status: SessionStatus;
    teacher: { id: string; display_name: string } | null;
  } | null;
};

// Re-exported so the page that feeds this table has one import, and so the
// shape stays whatever MoveBookingDialog says it is rather than drifting.
export type { MoveTarget };

type Filters = { q: string; status: string; customer: string; session: string };

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  attended: "Attended",
  no_show: "No-show",
};

function customerName(row: BookingRow | null): string {
  return row?.customer?.full_name ?? row?.customer?.email ?? "this customer";
}

/**
 * The bookings queue.
 *
 * Every write here goes through POST /api/admin/bookings/[id], never a browser
 * Supabase write. Two reasons this component used to get wrong on its own:
 * attendance has to be conditioned on the status the operator was looking at
 * (cron/no-show-sweep flips confirmed to no_show two hours after a class ends,
 * so a stale tab could silently overwrite it), and a cancel has to decide
 * explicitly whether the student's prepaid session comes back. The old direct
 * UPDATE did neither, and destroyed the credit every time.
 */
export function BookingsAdmin({
  rows,
  moveTargets,
  filters,
  total,
}: {
  rows: BookingRow[];
  moveTargets: MoveTarget[];
  filters: Filters;
  total: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState(filters.q);

  const [cancelTarget, setCancelTarget] = useState<BookingRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [refundCredit, setRefundCredit] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const [moveTarget, setMoveTarget] = useState<BookingRow | null>(null);

  const hasFilters = Boolean(
    filters.q || filters.status || filters.customer || filters.session,
  );

  /** Filtering is server-side, so every control navigates rather than setting state. */
  function applyFilters(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.status) params.set("status", next.status);
    if (next.customer) params.set("customer", next.customer);
    if (next.session) params.set("session", next.session);
    const qs = params.toString();
    router.push(qs ? `/admin/bookings?${qs}` : "/admin/bookings");
  }

  async function post(id: string, body: Record<string, unknown>): Promise<boolean> {
    // The network catch lives here, not at the three call sites. A rejected
    // fetch (offline, DNS) thrown out of this helper would skip the caller's
    // setBusy(null) / setCancelling(false) and leave the row's buttons spinning
    // for good with no toast; answering false instead routes it through every
    // caller's existing `if (!ok) return`.
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        toast.error(friendlyAdminError(payload?.error));
        return false;
      }
      return true;
    } catch {
      toast.error("Network error. Please try again.");
      return false;
    }
  }

  async function updateStatus(row: BookingRow, status: BookingStatus) {
    setBusy(row.id);
    // expectedStatus is the row the admin was actually looking at. Without it
    // this races the no-show sweeper.
    const ok = await post(row.id, {
      action: "attendance",
      status,
      expectedStatus: row.status,
    });
    setBusy(null);
    if (!ok) return;
    toast.success(
      status === "confirmed"
        ? "Attendance cleared. The booking is confirmed again."
        : `Marked as ${STATUS_LABEL[status]}.`,
    );
    router.refresh();
  }

  function openCancelDialog(row: BookingRow) {
    setCancelTarget(row);
    setCancelReason("");
    // Default to giving the session back. The operator can take the decision
    // away deliberately, but never by accident.
    setRefundCredit(true);
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      toast.error("Add a short reason so the cancellation is explainable later.");
      return;
    }
    // A free-trial or comped booking never spent a prepaid session, so there is
    // nothing to hand back and the server ignores the flag either way.
    const spentACredit = !cancelTarget.is_free_trial && !cancelTarget.comped;

    setCancelling(true);
    const ok = await post(cancelTarget.id, {
      action: "cancel",
      refundCredit: spentACredit ? refundCredit : false,
      reason,
    });
    setCancelling(false);
    if (!ok) return;

    toast.success(
      spentACredit && refundCredit
        ? `Booking cancelled. ${customerName(cancelTarget)} has their prepaid session back.`
        : "Booking cancelled. No prepaid session was returned.",
    );
    setCancelTarget(null);
    router.refresh();
  }

  const cancelSpentACredit =
    cancelTarget !== null && !cancelTarget.is_free_trial && !cancelTarget.comped;
  const cancelIsPast =
    cancelTarget?.session != null && new Date(cancelTarget.session.start_at) < new Date();

  return (
    <>
      <AdminPageHeader
        eyebrow="Operations"
        title="Bookings"
        sub="Every booking across every customer. Search, attendance and cancellations all run on the server, so a booking on page 4 is as findable as one on page 1."
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
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
            placeholder="Search by customer name or email"
            className="w-64"
          />
          <Button type="submit" variant="outline" size="sm">
            <Search className="size-3.5 mr-1" />
            Search
          </Button>
        </form>

        <Select
          value={filters.status || "all"}
          onValueChange={(v) => v && applyFilters({ status: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="attended">Attended</SelectItem>
            <SelectItem value="no_show">No-show</SelectItem>
          </SelectContent>
        </Select>

        {filters.customer && (
          <Badge variant="outline" className="gap-1">
            One customer
            <button
              type="button"
              aria-label="Clear the customer filter"
              onClick={() => applyFilters({ customer: "" })}
            >
              <X className="size-3" />
            </button>
          </Badge>
        )}
        {filters.session && (
          <Badge variant="outline" className="gap-1">
            One class
            <button
              type="button"
              aria-label="Clear the class filter"
              onClick={() => applyFilters({ session: "" })}
            >
              <X className="size-3" />
            </button>
          </Badge>
        )}

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              router.push("/admin/bookings");
            }}
          >
            Clear filters
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {total} booking{total === 1 ? "" : "s"}
          {hasFilters ? " matching" : ""}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="mt-8 border border-dashed border-border bg-foreground/3 p-12 text-center text-muted-foreground">
          {hasFilters ? "No bookings match these filters." : "No bookings yet."}
        </div>
      ) : (
        <div className="mt-6 myc-glass overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">Customer</th>
                <th className="bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">Session</th>
                <th className="bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">Teacher</th>
                <th className="bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">Status</th>
                <th className="bg-foreground/4 px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border transition-colors hover:bg-foreground/4">
                  <td className="px-4 py-3">
                    <div>{r.customer?.full_name ?? "-"}</div>
                    <div className="text-xs text-muted-foreground">{r.customer?.email ?? ""}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.session ? formatCustomerTime(r.session.start_at) : "-"}
                  </td>
                  <td className="px-4 py-3">{r.session?.teacher?.display_name ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={
                          r.status === "confirmed"
                            ? "secondary"
                            : r.status === "attended"
                            ? "default"
                            : "outline"
                        }
                      >
                        {STATUS_LABEL[r.status]}
                      </Badge>
                      {r.is_free_trial && <Badge variant="outline">Introductory 1:1</Badge>}
                      {r.comped && <Badge variant="outline">Comped</Badge>}
                      {r.moved_from_session_id && <Badge variant="outline">Moved</Badge>}
                      {/* A deliberate late-cancel should look deliberate, not
                          like a bug someone has to reconstruct from the ledger. */}
                      {r.status === "cancelled" &&
                        !r.credit_refunded &&
                        !r.is_free_trial &&
                        !r.comped && <Badge variant="outline">No refund</Badge>}
                    </div>
                    {r.status === "cancelled" && r.cancellation_reason && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {r.cancellation_reason}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      {r.status === "confirmed" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateStatus(r, "attended")}
                            disabled={busy === r.id}
                          >
                            Mark attended
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateStatus(r, "no_show")}
                            disabled={busy === r.id}
                          >
                            No-show
                          </Button>
                        </>
                      )}
                      {(r.status === "attended" || r.status === "no_show") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateStatus(r, "confirmed")}
                          disabled={busy === r.id}
                        >
                          Undo
                        </Button>
                      )}
                      {r.status !== "cancelled" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setMoveTarget(r)}
                            disabled={busy === r.id}
                          >
                            Move
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => openCancelDialog(r)}
                            disabled={busy === r.id}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={cancelTarget !== null} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this booking?</DialogTitle>
            <DialogDescription>
              {customerName(cancelTarget)} comes off
              {cancelTarget?.session
                ? ` ${formatCustomerTime(cancelTarget.session.start_at)}`
                : " this class"}
              . Decide below whether their prepaid session comes back.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {cancelSpentACredit ? (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-sm font-normal">
                  <Checkbox
                    checked={refundCredit}
                    onCheckedChange={(v) => setRefundCredit(v === true)}
                  />
                  Return the prepaid session to {customerName(cancelTarget)}
                  <FieldHint>
                    Leave this unchecked to apply a late-cancel policy: the booking is cancelled
                    and the session stays spent. The choice is recorded either way.
                  </FieldHint>
                </Label>
                {cancelIsPast && (
                  <p className="text-xs text-muted-foreground">
                    This class has already started, so a late-cancel policy may apply.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No prepaid session was used, so there is nothing to return.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="cancel_reason">Reason</Label>
              <Textarea
                id="cancel_reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer asked to move to next week, teacher unwell"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Stored internally on the booking and in the audit log.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancel}
              disabled={cancelling || cancelReason.trim().length < 3}
            >
              {cancelling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : cancelSpentACredit && refundCredit ? (
                "Cancel and return the session"
              ) : (
                "Cancel without a refund"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MoveBookingDialog
        key={moveTarget?.id ?? "no-booking"}
        booking={
          moveTarget && moveTarget.session
            ? {
                id: moveTarget.id,
                customerName: customerName(moveTarget),
                sessionId: moveTarget.session.id,
              }
            : null
        }
        targets={moveTargets}
        onClose={() => setMoveTarget(null)}
        onMoved={() => {
          setMoveTarget(null);
          router.refresh();
        }}
      />
    </>
  );
}
