"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Video, Calendar, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatCustomerTime } from "@/lib/timezone";
import { toast } from "sonner";
import type { BookingStatus } from "@/lib/supabase/types";

type Row = {
  id: string;
  status: BookingStatus;
  is_free_trial: boolean;
  session: {
    id: string;
    start_at: string;
    end_at: string;
    meet_link: string | null;
    meet_status: "pending" | "created" | "failed" | null;
    teacher: { display_name: string } | null;
  } | null;
};

export function BookingsList({ rows, customerTimezone }: { rows: Row[]; customerTimezone: string }) {
  const router = useRouter();
  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  // Pin "now" to mount time so render stays pure. Stale by seconds, fine for this view.
  const [now] = useState(() => Date.now());
  const upcoming = rows.filter(
    (r) => r.session && new Date(r.session.start_at).getTime() > now && r.status !== "cancelled"
  );
  const past = rows.filter(
    (r) => !r.session || new Date(r.session.start_at).getTime() <= now || r.status === "cancelled"
  );

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingId: cancelTarget.id, reason }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(`Couldn't cancel: ${body.error ?? "unknown"}`);
        return;
      }
      toast.success("Booking cancelled.");
      setCancelTarget(null);
      setReason("");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setCancelling(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
        <Calendar className="size-10 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No bookings yet.</p>
        <Button asChild className="mt-5 rounded-full">
          <Link href="/dashboard/book">Book your first class</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      {upcoming.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-medium mb-3">Upcoming</h2>
          <div className="space-y-3">
            {upcoming.map((r) => (
              <BookingCard
                key={r.id}
                row={r}
                customerTimezone={customerTimezone}
                now={now}
                onCancel={() => setCancelTarget(r)}
              />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-medium mb-3">Past & cancelled</h2>
          <div className="space-y-3">
            {past.map((r) => (
              <BookingCard key={r.id} row={r} customerTimezone={customerTimezone} now={now} />
            ))}
          </div>
        </section>
      )}

      <Dialog open={cancelTarget !== null} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this booking?</DialogTitle>
            <DialogDescription>
              {cancelTarget?.session && (
                <>
                  {cancelTarget.session.teacher?.display_name} ·{" "}
                  {formatCustomerTime(cancelTarget.session.start_at, customerTimezone)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              Keep booking
            </Button>
            <Button variant="destructive" onClick={confirmCancel} disabled={cancelling}>
              {cancelling ? <Loader2 className="size-4 animate-spin" /> : "Cancel booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BookingCard({
  row,
  customerTimezone,
  now,
  onCancel,
}: {
  row: Row;
  customerTimezone: string;
  now: number;
  onCancel?: () => void;
}) {
  const cancelled = row.status === "cancelled";
  const session = row.session;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{session?.teacher?.display_name ?? "Teacher"}</span>
          {row.is_free_trial && <Badge variant="outline">Free trial</Badge>}
          {cancelled && <Badge variant="outline">Cancelled</Badge>}
          {row.status === "attended" && <Badge variant="secondary">Attended</Badge>}
          {row.status === "no_show" && <Badge variant="outline">No-show</Badge>}
        </div>
        <div className="text-sm text-muted-foreground mt-0.5">
          {session ? formatCustomerTime(session.start_at, customerTimezone) : "—"}
        </div>
      </div>
      {!cancelled && session && new Date(session.start_at).getTime() > now && (
        <div className="flex items-center gap-2">
          {session.meet_link ? (
            <Button asChild size="sm" className="rounded-full">
              <a href={session.meet_link} target="_blank" rel="noreferrer">
                <Video className="size-3.5 mr-1" />
                Join
              </a>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              {session.meet_status === "failed" ? "Link unavailable" : "Link soon"}
            </span>
          )}
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              <X className="size-3.5 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
