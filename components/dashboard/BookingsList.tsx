"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Video, Loader2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { formatInTz, tzShort } from "@/lib/timezone";
import { useBrowserTz } from "@/components/dashboard/local-time";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
    class_category: { name: string } | null;
  } | null;
};

type Filter = "upcoming" | "past" | "cancelled";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
];

function durationMin(start: string, end: string) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

function StatusPill({ row }: { row: Row }) {
  if (row.status === "cancelled") return <span className="myc-pill myc-pill-gray">Cancelled</span>;
  if (row.status === "no_show") return <span className="myc-pill myc-pill-gray">No-show</span>;
  if (row.status === "attended") return <span className="myc-pill myc-pill-teal">Attended</span>;
  if (row.is_free_trial) return <span className="myc-pill myc-pill-free">Free trial</span>;
  return <span className="myc-pill myc-pill-green">Confirmed</span>;
}

export function BookingsList({
  rows,
  customerTimezone,
}: {
  rows: Row[];
  customerTimezone: string;
}) {
  const router = useRouter();
  // Display in the timezone the customer is actually in right now.
  const tz = useBrowserTz(customerTimezone);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  // Pin "now" to mount time so render stays pure. Stale by seconds, fine here.
  const [now] = useState(() => Date.now());

  const { upcoming, past, cancelled } = useMemo(() => {
    const upcoming: Row[] = [];
    const past: Row[] = [];
    const cancelled: Row[] = [];
    for (const r of rows) {
      if (r.status === "cancelled") cancelled.push(r);
      else if (r.session && new Date(r.session.start_at).getTime() > now) upcoming.push(r);
      else past.push(r);
    }
    return { upcoming, past, cancelled };
  }, [rows, now]);

  const visible = filter === "upcoming" ? upcoming : filter === "past" ? past : cancelled;

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
      toast.success("Session cancelled.");
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
      <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
        <CalendarDays className="mx-auto mb-4 size-10 text-muted-foreground" />
        <p className="text-muted-foreground">No sessions yet.</p>
        <Button asChild className="mt-5 rounded-full bg-accent text-white hover:bg-accent/90">
          <Link href="/dashboard/book">Book your first session</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="mt-7 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap gap-2 border-b border-border px-5 py-3.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>When ({tzShort(tz)})</Th>
                <Th>Session</Th>
                <Th>Teacher</Th>
                <Th>Status</Th>
                <Th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="border-t border-border px-5 py-10 text-center text-sm text-muted-foreground"
                  >
                    No {filter} sessions.
                  </td>
                </tr>
              ) : (
                visible.map((r) => {
                  const s = r.session;
                  return (
                    <tr key={r.id}>
                      <Td>
                        {s ? (
                          <>
                            <strong className="font-semibold text-foreground">
                              {formatInTz(s.start_at, tz, "EEE d MMM")}
                            </strong>
                            <div className="text-xs text-muted-foreground">
                              {formatInTz(s.start_at, tz, "h:mm a")} ·{" "}
                              {durationMin(s.start_at, s.end_at)} min
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Td>
                      <Td className="text-foreground">
                        {s?.class_category?.name ?? "Yoga session"}
                      </Td>
                      <Td>{s?.teacher?.display_name ?? "Teacher"}</Td>
                      <Td>
                        <StatusPill row={r} />
                      </Td>
                      <Td className="text-right">
                        <RowActions
                          row={r}
                          bucket={filter}
                          onCancel={() => setCancelTarget(r)}
                        />
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={cancelTarget !== null} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Cancel this <span className="italic text-accent">session?</span>
            </DialogTitle>
            <DialogDescription>
              {cancelTarget?.session && (
                <>
                  {cancelTarget.session.class_category?.name ?? "Yoga session"} ·{" "}
                  {cancelTarget.session.teacher?.display_name} ·{" "}
                  {formatInTz(
                    cancelTarget.session.start_at,
                    tz,
                    "EEE d MMM, h:mm a"
                  )}
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
              placeholder="Let your teacher know why, if you'd like."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              Keep session
            </Button>
            <Button variant="destructive" onClick={confirmCancel} disabled={cancelling}>
              {cancelling ? <Loader2 className="size-4 animate-spin" /> : "Cancel session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RowActions({
  row,
  bucket,
  onCancel,
}: {
  row: Row;
  bucket: Filter;
  onCancel: () => void;
}) {
  if (bucket === "upcoming") {
    const link = row.session?.meet_link;
    return (
      <div className="flex items-center justify-end gap-2">
        {link ? (
          <Button asChild size="sm" className="h-8 rounded-full px-3 text-xs">
            <a href={link} target="_blank" rel="noreferrer">
              <Video className="size-3.5" />
              Join
            </a>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            {row.session?.meet_status === "failed" ? "Link unavailable" : "Link soon"}
          </span>
        )}
        <Button asChild size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs">
          <Link href="/dashboard/book">Reschedule</Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 rounded-full px-3 text-xs"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    );
  }
  return (
    <div className="flex justify-end">
      <Button asChild size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs">
        <Link href="/dashboard/book">Book again</Link>
      </Button>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "bg-background px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
        className
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={cn("border-t border-border px-5 py-3 align-middle text-muted-foreground", className)}>
      {children}
    </td>
  );
}
