"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { LabelWithHint } from "@/components/ui/field-hint";
import { toast } from "sonner";
import { formatCustomerTime } from "@/lib/timezone";
import { friendlyAdminError } from "@/lib/ui/errors";
import type { AdminErrorBody } from "@/lib/admin/contracts";

/**
 * One candidate destination for a move. `live` is the non-cancelled booking
 * count, so `live >= capacity` is the same "full" the capacity trigger enforces
 * in Postgres; the option is disabled rather than hidden so an admin can see
 * why the class they had in mind is not on offer.
 */
export type MoveTarget = {
  id: string;
  startAt: string;
  teacherName: string;
  live: number;
  capacity: number;
};

/**
 * Move one student from the class they are in to another one.
 *
 * Deliberately credit-neutral: `admin_move_booking` is a plain
 * `update bookings set session_id`, with no ledger write on either side. That
 * is the whole reason this exists as its own action rather than a cancel plus a
 * re-enrol, which would refund a credit and then spend a different one and leave
 * two extra rows in the customer's ledger for what the studio calls "same class,
 * different day".
 *
 * Shared with the bookings table, so the props are the frozen contract: the
 * caller owns the ordering of `targets` (same teacher first reads best) and
 * decides whether to refresh itself via `onMoved` or let the default
 * router.refresh() run.
 */
export function MoveBookingDialog({
  booking,
  targets,
  onClose,
  onMoved,
}: {
  booking: { id: string; customerName: string; sessionId: string } | null;
  targets: MoveTarget[];
  onClose: () => void;
  onMoved?: () => void;
}) {
  const router = useRouter();
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);

  // No reset effect here: both callers key this dialog on the booking id, so a
  // different row remounts it and `targetId` starts empty. Carrying the last
  // destination over to another student would be a mis-move waiting to happen.
  // Never offer the class the student is already in: the RPC answers
  // `same_session` for that, which is a round trip to learn nothing.
  const options = targets.filter((t) => t.id !== booking?.sessionId);

  async function move() {
    if (!booking || !targetId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "move", targetSessionId: targetId }),
      });
      const body = (await res.json().catch(() => ({}))) as AdminErrorBody;
      if (!res.ok) {
        toast.error(friendlyAdminError(body.error));
        return;
      }
      // Says what the move DID, not what the booking was paid with. The props
      // are the frozen contract shared with two callers and carry no
      // comped/is_free_trial flag, and a comped or introductory booking never
      // spent a prepaid session for one to "come with them". Credit neutral is
      // true of every move, so state that instead of guessing.
      toast.success(
        `${booking.customerName} moved. No prepaid session was charged or returned.`,
      );
      onClose();
      if (onMoved) onMoved();
      else router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={booking !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Move to another class</DialogTitle>
          <DialogDescription>
            Moving is credit neutral. {booking?.customerName ?? "This student"} keeps the booking
            exactly as it is, so nothing is charged and nothing is returned.
          </DialogDescription>
        </DialogHeader>

        <div>
          <LabelWithHint
            htmlFor="move_target"
            hint="Upcoming scheduled classes only. A full class cannot take another student until its capacity is raised."
          >
            New class
          </LabelWithHint>
          <Select value={targetId} onValueChange={(v) => v && setTargetId(v)}>
            <SelectTrigger id="move_target" className="mt-1.5">
              <SelectValue placeholder="Pick a class" />
            </SelectTrigger>
            <SelectContent>
              {options.map((t) => {
                const full = t.live >= t.capacity;
                return (
                  <SelectItem key={t.id} value={t.id} disabled={full}>
                    {formatCustomerTime(t.startAt)} · {t.teacherName} · {t.live}/{t.capacity}
                    {full ? " · Full" : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {options.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              There are no other upcoming classes to move this student into.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Back
          </Button>
          <Button onClick={move} disabled={saving || !targetId}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Move student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
