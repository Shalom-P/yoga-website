"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, UserMinus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { CustomerCombobox, type CustomerOption } from "@/components/ui/customer-combobox";
import { MoveBookingDialog, type MoveTarget } from "@/components/admin/MoveBookingDialog";
import { adminWarningLine } from "@/components/admin/SessionEditDialog";
import { toast } from "sonner";
import {
  DEFAULT_CUSTOMER_TZ,
  formatCustomerTime,
  formatInTz,
  formatTeacherTime,
  tzShort,
} from "@/lib/timezone";
import { friendlyAdminError } from "@/lib/ui/errors";
import type { AdminEnrolResponse, AdminErrorBody } from "@/lib/admin/contracts";
import type { BookingStatus, MeetStatus } from "@/lib/supabase/types";

export type RosterSession = {
  id: string;
  start_at: string;
  end_at: string;
  capacity: number;
  status: "scheduled" | "live" | "completed" | "cancelled";
  is_free_trial: boolean;
  meet_link: string | null;
  meet_status: MeetStatus | null;
  teacher_name: string | null;
  category_name: string | null;
  /** Non-cancelled bookings. The same count the capacity trigger enforces. */
  live_count: number;
};

export type RosterEntry = {
  id: string;
  status: BookingStatus;
  is_free_trial: boolean;
  comped: boolean;
  credit_refunded: boolean;
  moved_from_session_id: string | null;
  cancellation_reason: string | null;
  created_at: string;
  customer: {
    id: string;
    full_name: string | null;
    email: string | null;
    timezone: string;
  } | null;
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  attended: "Attended",
  no_show: "No-show",
};

/** Live statuses, in the order an admin scans them. Cancelled sorts last. */
const LIVE_ORDER: BookingStatus[] = ["confirmed", "attended", "no_show"];

function nameOf(entry: RosterEntry): string {
  return entry.customer?.full_name?.trim() || entry.customer?.email || "Unnamed customer";
}

function firstNameOf(customer: CustomerOption): string {
  const full = customer.fullName?.trim();
  if (full) return full.split(/\s+/)[0];
  return customer.email ?? "This customer";
}

/**
 * Render an instant in a customer's own zone. `profiles.timezone` is
 * self-reported (the onboarding picker writes whatever the device says, and ICU
 * ids like "Asia/Calcutta" are legitimate), so a bad value must degrade to IST
 * rather than throw and take the whole roster down with it.
 */
function inCustomerTz(iso: string, timezone: string): string {
  try {
    return `${formatInTz(iso, timezone, "EEE d MMM, h:mm a")} ${tzShort(timezone)}`;
  } catch {
    return `${formatInTz(iso, DEFAULT_CUSTOMER_TZ, "EEE d MMM, h:mm a")} ${tzShort(DEFAULT_CUSTOMER_TZ)}`;
  }
}

const TH =
  "bg-foreground/4 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap";

/**
 * The roster for one class: who is in it, what time it is for each of them, and
 * the four things an admin actually needs to do about it (add, remove, move,
 * mark attendance).
 *
 * The add form sits in the footer, always open rather than behind a button,
 * because adding a student is the single most common reason this drawer is
 * opened at all. Every mutation goes through an admin route: the browser client
 * cannot insert a booking (admin-only INSERT policy since 0018) and, more to the
 * point, credits must move through the RPCs so the ledger stays the record of
 * why a balance is what it is.
 */
export function SessionRosterDrawer({
  session,
  roster,
  moveTargets,
  onClose,
}: {
  session: RosterSession | null;
  roster: RosterEntry[];
  moveTargets: MoveTarget[];
  onClose: () => void;
}) {
  const router = useRouter();

  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<RosterEntry | null>(null);
  const [refundCredit, setRefundCredit] = useState(true);
  const [removeReason, setRemoveReason] = useState("");
  const [removing, setRemoving] = useState(false);

  const [moveTarget, setMoveTarget] = useState<RosterEntry | null>(null);

  const [picked, setPicked] = useState<CustomerOption | null>(null);
  const [useTrial, setUseTrial] = useState(false);
  const [chargeCredit, setChargeCredit] = useState(true);
  const [adding, setAdding] = useState(false);

  // NOTE on resetting the add form between classes: a customer left selected
  // from the last roster is a mis-enrolment waiting to happen, but this
  // component does NOT reset itself in an effect. SessionsAdmin keys it on the
  // session id, so opening a different class remounts it and every field below
  // starts fresh. That is React's own answer to "reset state when a prop
  // changes" and it avoids the extra render an effect-plus-setState costs.
  //
  // The trial and the charge are likewise not synchronised by an effect: the
  // charge checkbox is `disabled={useTrial}` and the submit derives
  // `chargeCredit: useTrial ? false : chargeCredit`, so the invariant (an
  // introductory 1:1 never touches the credit ledger) holds by construction.

  const live = roster.filter((r) => r.status !== "cancelled");
  const sorted = [...roster].sort((a, b) => {
    const aLive = a.status !== "cancelled";
    const bLive = b.status !== "cancelled";
    if (aLive !== bLive) return aLive ? -1 : 1;
    if (aLive) {
      const byStatus = LIVE_ORDER.indexOf(a.status) - LIVE_ORDER.indexOf(b.status);
      if (byStatus !== 0) return byStatus;
    }
    return Date.parse(a.created_at) - Date.parse(b.created_at);
  });

  const full = session ? live.length >= session.capacity : false;
  const closed = session ? session.status === "cancelled" || session.status === "completed" : true;
  const durationMinutes = session
    ? Math.round((Date.parse(session.end_at) - Date.parse(session.start_at)) / 60000)
    : 0;

  async function copyLink() {
    if (!session?.meet_link) return;
    try {
      await navigator.clipboard.writeText(session.meet_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the link. Select it and copy by hand.");
    }
  }

  async function setAttendance(entry: RosterEntry, status: "attended" | "no_show" | "confirmed") {
    setBusy(entry.id);
    try {
      const res = await fetch(`/api/admin/bookings/${entry.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "attendance",
          status,
          // Echoed from the row on screen. Without it this races
          // cron/no-show-sweep, which flips confirmed to no_show two hours
          // after a class ends, and the admin would silently overwrite it.
          expectedStatus: entry.status,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as AdminErrorBody;
      if (!res.ok) {
        toast.error(friendlyAdminError(body.error));
        return;
      }
      toast.success(
        status === "confirmed"
          ? `${nameOf(entry)} is back to confirmed.`
          : `${nameOf(entry)} marked as ${STATUS_LABEL[status].toLowerCase()}.`,
      );
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function openRemove(entry: RosterEntry) {
    setRemoveTarget(entry);
    // A paid seat defaults to being given back; a trial or a comped seat never
    // spent anything, so there is nothing to return.
    setRefundCredit(!entry.is_free_trial && !entry.comped);
    setRemoveReason("");
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    const reason = removeReason.trim();
    if (reason.length < 3) {
      toast.error("Add a short reason. It is stored on the booking.");
      return;
    }
    setRemoving(true);
    try {
      const res = await fetch(`/api/admin/bookings/${removeTarget.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel", refundCredit, reason }),
      });
      const body = (await res.json().catch(() => ({}))) as AdminErrorBody & { refunded?: boolean };
      if (!res.ok) {
        toast.error(friendlyAdminError(body.error));
        return;
      }
      toast.success(
        body.refunded
          ? `${nameOf(removeTarget)} removed. Their prepaid session was returned.`
          : `${nameOf(removeTarget)} removed. No prepaid session was returned.`,
      );
      setRemoveTarget(null);
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setRemoving(false);
    }
  }

  async function addToClass() {
    if (!session || !picked) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionIds: [session.id],
          customerIds: [picked.id],
          isFreeTrial: useTrial,
          chargeCredit: useTrial ? false : chargeCredit,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as AdminEnrolResponse | AdminErrorBody;
      if (!res.ok) {
        toast.error(friendlyAdminError((body as AdminErrorBody).error));
        return;
      }
      // The route answers 200 even when every pair failed, so the per-row error
      // is the one that matters here, not the HTTP status.
      const ok = body as AdminEnrolResponse;
      const row = ok.results[0];
      if (!row || row.error) {
        toast.error(friendlyAdminError(row?.error));
        return;
      }
      const balance = ok.balances[picked.id];
      const name = firstNameOf(picked);
      toast.success(
        row.charged
          ? `${name} added. ${balance ?? 0} prepaid ${balance === 1 ? "session" : "sessions"} left.`
          : `${name} added without charging a prepaid session.`,
      );
      for (const warning of ok.warnings ?? []) toast.warning(adminWarningLine(warning));
      setPicked(null);
      setUseTrial(false);
      setChargeCredit(true);
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <Dialog open={session !== null} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {session && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {session.category_name ?? "1:1 private session"}
                  <span className="block text-sm font-normal text-muted-foreground">
                    {formatCustomerTime(session.start_at)} {tzShort(DEFAULT_CUSTOMER_TZ)}
                  </span>
                </DialogTitle>
                <DialogDescription>
                  {session.teacher_name ?? "No teacher"} · {durationMinutes} min ·{" "}
                  {formatTeacherTime(session.start_at)} for the teacher
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={full ? "outline" : "secondary"}>
                  {live.length} / {session.capacity} booked
                </Badge>
                <Badge variant="outline">{session.status}</Badge>
                {session.is_free_trial && <Badge variant="outline">trial slot</Badge>}
                {session.meet_status === "created" && session.meet_link ? (
                  <Button size="sm" variant="ghost" onClick={copyLink}>
                    {copied ? (
                      <Check className="size-3.5 mr-1" />
                    ) : (
                      <Copy className="size-3.5 mr-1" />
                    )}
                    {copied ? "Copied" : "Link ready"}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {session.meet_status === "release_pending"
                      ? "Link being removed"
                      : session.meet_status === "pending" || session.meet_status === "failed"
                        ? "Link pending"
                        : "No link"}
                  </span>
                )}
              </div>

              {roster.length === 0 ? (
                <div className="border border-dashed border-border bg-foreground/3 p-8 text-center text-sm text-muted-foreground">
                  Nobody is in this class yet.
                </div>
              ) : (
                <div className="myc-glass overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className={TH}>Student</th>
                        <th className={TH}>Their time</th>
                        <th className={TH}>Status</th>
                        <th className={TH}>Paid</th>
                        <th className={TH}>Added</th>
                        <th className={TH}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((r) => {
                        const cancelled = r.status === "cancelled";
                        return (
                          <tr
                            key={r.id}
                            className={`border-t border-border transition-colors hover:bg-foreground/4 ${
                              cancelled ? "opacity-60" : ""
                            }`}
                          >
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span>{nameOf(r)}</span>
                                {r.moved_from_session_id && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Moved
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {r.customer?.email ?? ""}
                              </div>
                              {cancelled && r.cancellation_reason && (
                                <div className="text-xs text-muted-foreground">
                                  {r.cancellation_reason}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                              {r.customer
                                ? inCustomerTz(session.start_at, r.customer.timezone)
                                : "-"}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap items-center gap-1">
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
                                {/* A deliberate late-cancel should look deliberate: the
                                    seat was kept, and that was somebody's decision. */}
                                {cancelled &&
                                  !r.is_free_trial &&
                                  !r.comped &&
                                  !r.credit_refunded && (
                                    <span className="text-[11px] text-muted-foreground">
                                      No refund
                                    </span>
                                  )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                              {r.is_free_trial
                                ? "Introductory 1:1"
                                : r.comped
                                  ? "Comped"
                                  : "Prepaid session"}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                              {formatInTz(r.created_at, DEFAULT_CUSTOMER_TZ, "d MMM yyyy")}
                            </td>
                            <td className="px-3 py-2.5">
                              {!cancelled && (
                                <div className="flex flex-wrap justify-end gap-1">
                                  {r.status !== "attended" && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setAttendance(r, "attended")}
                                      disabled={busy === r.id}
                                    >
                                      Attended
                                    </Button>
                                  )}
                                  {r.status !== "no_show" && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setAttendance(r, "no_show")}
                                      disabled={busy === r.id}
                                    >
                                      No-show
                                    </Button>
                                  )}
                                  {r.status !== "confirmed" && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setAttendance(r, "confirmed")}
                                      disabled={busy === r.id}
                                    >
                                      Undo
                                    </Button>
                                  )}
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
                                    onClick={() => openRemove(r)}
                                    disabled={busy === r.id}
                                  >
                                    <UserMinus className="size-3.5 mr-1" />
                                    Remove
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add a student. Open by default: this is what the drawer is for. */}
              <div className="rounded-lg border border-border bg-foreground/3 p-3 space-y-3">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <UserPlus className="size-4" />
                  Add a student
                </div>

                <CustomerCombobox
                  value={picked}
                  onValueChange={setPicked}
                  excludeIds={live.map((r) => r.customer?.id).filter((x): x is string => !!x)}
                />

                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  <Label className="flex items-center gap-2 text-sm font-normal">
                    <Checkbox
                      checked={useTrial}
                      onCheckedChange={(v) => setUseTrial(v === true)}
                      disabled={!picked || picked.hasLiveFreeTrial}
                    />
                    Use their introductory 1:1
                    <FieldHint>
                      {picked?.hasLiveFreeTrial
                        ? "This student already holds an introductory 1:1, and the database allows only one per customer for life."
                        : "Books this class as the student's one introductory 1:1. No prepaid session is spent."}
                    </FieldHint>
                  </Label>

                  <Label className="flex items-center gap-2 text-sm font-normal">
                    <Checkbox
                      checked={chargeCredit}
                      onCheckedChange={(v) => setChargeCredit(v === true)}
                      disabled={useTrial}
                    />
                    Charge a prepaid session
                    <FieldHint>
                      Unchecking this comps the class: the student keeps their balance, and removing
                      them later returns nothing because nothing was spent.
                    </FieldHint>
                  </Label>
                </div>

                {picked && (
                  <p
                    className={`text-xs ${
                      picked.credits === 0 ? "text-amber-600" : "text-muted-foreground"
                    }`}
                  >
                    {picked.credits === 0
                      ? `${firstNameOf(picked)} has no sessions left. Record a payment, add sessions, or uncheck the charge to comp this class.`
                      : `${firstNameOf(picked)} has ${picked.credits} ${
                          picked.credits === 1 ? "session" : "sessions"
                        } left.`}
                  </p>
                )}

                {full && (
                  <p className="text-xs text-amber-600">
                    This class is full. Raise the capacity from Edit to fit another student.
                  </p>
                )}
                {closed && (
                  <p className="text-xs text-amber-600">
                    This class is {session.status}, so nobody can be added to it.
                  </p>
                )}

                <Button onClick={addToClass} disabled={adding || !picked || full || closed}>
                  {adding ? <Loader2 className="size-4 animate-spin" /> : "Add to class"}
                </Button>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={onClose}>
                  <X className="size-4 mr-1" />
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove. The refund decision is the body of this dialog, not a detail:
          it is the difference between a goodwill cancel and a late-cancel
          policy, and it is recorded on the booking either way. */}
      <Dialog open={removeTarget !== null} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Remove from this class?</DialogTitle>
            <DialogDescription>
              {removeTarget ? nameOf(removeTarget) : "This student"} will be removed from the class
              and told nothing automatically. Let them know yourself.
            </DialogDescription>
          </DialogHeader>

          {removeTarget &&
            (removeTarget.is_free_trial || removeTarget.comped ? (
              <p className="text-sm text-muted-foreground">
                No prepaid session was used, so there is nothing to return.
              </p>
            ) : (
              <Label className="flex items-start gap-2 text-sm font-normal">
                <Checkbox
                  checked={refundCredit}
                  onCheckedChange={(v) => setRefundCredit(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Return the prepaid session to {nameOf(removeTarget)}
                  <FieldHint>
                    Leave this unchecked to apply a late-cancel policy: the student is removed and
                    the session stays spent. The choice is recorded on the booking.
                  </FieldHint>
                </span>
              </Label>
            ))}

          <div className="space-y-2">
            <Label htmlFor="remove_reason">Reason</Label>
            <Textarea
              id="remove_reason"
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              rows={2}
              placeholder="e.g. Student asked to move to next week"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing}>
              Back
            </Button>
            <Button variant="destructive" onClick={confirmRemove} disabled={removing}>
              {removing ? <Loader2 className="size-4 animate-spin" /> : "Remove student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MoveBookingDialog
        key={moveTarget?.id ?? "no-booking"}
        booking={
          moveTarget
            ? {
                id: moveTarget.id,
                customerName: nameOf(moveTarget),
                sessionId: session?.id ?? "",
              }
            : null
        }
        targets={moveTargets}
        onClose={() => setMoveTarget(null)}
      />
    </>
  );
}
