"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBrowserTz, useHasMounted } from "@/components/dashboard/local-time";
import { generateSlots, type Availability, type Slot } from "@/lib/booking/slots";
import { formatInTz, tzDiffLabel } from "@/lib/timezone";
import { cn } from "@/lib/utils";

type Props = {
  teacherId: string;
  teacherName: string;
  teacherTimezone: string;
  customerTimezone: string;
  availability: Availability[];
  /** True until the customer has used their free 1:1 trial. */
  freeTrialAvailable: boolean;
  /** Session-credits available for paid bookings (after the trial is used). */
  creditBalance: number;
  /** Teacher-TZ "yyyy-MM-dd" dates the teacher has blocked off (no bookings). */
  blockedDates?: string[];
  /** Admins skip the wait for browser-timezone resolution below. */
  isAdmin: boolean;
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border border-border bg-foreground/6 px-2.5 py-1.5">{children}</span>
  );
}

export function TeacherSlotPicker({
  teacherId,
  teacherName,
  teacherTimezone,
  customerTimezone,
  availability,
  freeTrialAvailable,
  creditBalance,
  blockedDates,
  isAdmin,
}: Props) {
  const router = useRouter();
  // Show slot times in the timezone the customer is actually in right now.
  const customerTz = useBrowserTz(customerTimezone);
  // The SSR/first-paint customerTz is the stored profile fallback, so the real
  // location isn't known until the client resolves it. Gate trial-eligible
  // rendering on this to avoid flashing a bookable grid at out-of-area users.
  const tzResolved = useHasMounted();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The canvas books in two steps: pick a slot, then confirm it in a sticky
  // bar that spells out both clocks and the cost. Booking spends a credit and
  // puts a class on a teacher's calendar, so a stray tap should not commit it.
  const [selected, setSelected] = useState<Slot | null>(null);

  const teacherFirstName = teacherName.split(" ")[0];

  const grouped = useMemo(() => {
    const now = new Date();
    const slots = generateSlots(availability, teacherTimezone, now, blockedDates ?? []);
    const buckets = new Map<string, Slot[]>();
    for (const s of slots) {
      const dayKey = formatInTz(s.at, customerTz, "yyyy-MM-dd");
      const arr = buckets.get(dayKey) ?? [];
      arr.push(s);
      buckets.set(dayKey, arr);
    }
    return Array.from(buckets.entries()).slice(0, 7);
  }, [availability, teacherTimezone, customerTz, blockedDates]);

  // Once the free trial is used, every booking is paid and spends a credit.
  const isPaid = !freeTrialAvailable;

  function onSlotClick(slot: Slot) {
    if (isPaid && creditBalance <= 0) {
      setError("insufficient_credits");
      return;
    }
    setError(null);
    setSelected((current) =>
      current && current.at.getTime() === slot.at.getTime() ? null : slot,
    );
  }

  async function book() {
    const slot = selected;
    if (!slot) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/bookings/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        teacherId,
        startAt: slot.at.toISOString(),
        durationMinutes: slot.durationMinutes,
        isFreeTrial: freeTrialAvailable,
        clientTimezone: customerTz,
      }),
    });
    if (res.ok) {
      // Paid bookings go to the bookings list; the free trial gets the upsell.
      router.push(isPaid ? "/dashboard/bookings?booked=1" : "/dashboard/plan?booked=1");
      return;
    }
    setBusy(false);
    setSelected(null);
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setError(body.error ?? "booking_failed");
  }

  // Hold off on the slot grid until the real browser timezone resolves. The
  // first paint uses the stored profile zone (useBrowserTz), so rendering
  // immediately would group slots into the wrong days and then reshuffle.
  // This used to exist to avoid flashing bookable slots at an out-of-area user
  // before the service-area banner; that gate is gone, the timezone race is not.
  if (!isAdmin && freeTrialAvailable && !tzResolved) {
    return (
      <p className="myc-glass mt-8 p-6 text-sm text-muted-foreground">
        Checking your local time…
      </p>
    );
  }

  if (grouped.length === 0) {
    return (
      <p className="myc-glass mt-8 p-6 text-sm text-muted-foreground">
        No times available in the next 7 days. Check back soon or pick another teacher.
      </p>
    );
  }

  return (
    <div className="mt-7">
      {error && (
        <div className="mb-5 border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
          {error === "trial_already_claimed" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                You&apos;ve already had your introductory 1:1. Buy a pack to keep booking.
              </span>
              <Button asChild size="sm" className="shrink-0">
                <Link href="/dashboard/plan">View packs &amp; pricing</Link>
              </Button>
            </div>
          ) : error === "insufficient_credits" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>You&apos;re out of prepaid sessions. Buy a pack to keep booking.</span>
              <Button asChild size="sm" className="shrink-0">
                <Link href="/dashboard/plan">Buy a pack</Link>
              </Button>
            </div>
          ) : error === "slot_taken" ? (
            "That slot was just booked by someone else. Try another time."
          ) : error === "slot_in_past" ? (
            "That time has just passed. Pick a slot at least 15 minutes from now."
          ) : error === "slot_unavailable" ? (
            "The teacher isn't available then anymore. Pick another time."
          ) : (
            "Couldn't book that slot. Please try again."
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-muted-foreground">
        <Chip>Your time · {customerTz}</Chip>
        <Chip>
          Teacher · {teacherTimezone} ({tzDiffLabel(teacherTimezone, customerTz)})
        </Chip>
        {isPaid && creditBalance > 0 && (
          <Chip>
            Each slot uses 1 of {creditBalance} session{creditBalance === 1 ? "" : "s"}
          </Chip>
        )}
        {isPaid && creditBalance <= 0 && (
          <Link
            href="/dashboard/plan"
            className="border border-accent/50 bg-accent/12 px-2.5 py-1.5 font-medium text-foreground transition-colors hover:bg-accent/20"
          >
            No sessions left. Buy a pack →
          </Link>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {grouped.map(([dayKey, slots]) => (
          <div
            key={dayKey}
            className="grid items-start gap-4 border-t border-border pt-4 [grid-template-columns:minmax(0,1fr)] sm:[grid-template-columns:minmax(0,140px)_minmax(0,1fr)]"
          >
            <div className="pt-1.5 text-[14.5px] font-semibold">
              {formatInTz(slots[0].at, customerTz, "EEE, d LLL")}
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                {slots.length} slot{slots.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => {
                const label = formatInTz(s.at, customerTz, "h:mm a");
                const teacherLabel = formatInTz(s.at, teacherTimezone, "h:mm a");
                const id = s.at.toISOString();
                const on = selected?.at.getTime() === s.at.getTime();
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    disabled={busy}
                    onClick={() => onSlotClick(s)}
                    title={`Teacher's time: ${teacherLabel} · ${s.durationMinutes} min`}
                    className={cn(
                      "border px-3.5 py-2 text-[13.5px] font-medium transition-colors disabled:opacity-50",
                      on
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border bg-foreground/6 hover:border-accent",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* borderColor inline: .myc-glass-bar sets `border` as an unlayered
          shorthand, so a Tailwind border-colour utility is discarded. */}
      {selected && (
        <div
          style={{ borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)" }}
          className="myc-glass-bar sticky bottom-5 mt-7 flex flex-wrap items-center justify-between gap-3.5 px-5 py-4"
        >
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Selected
            </div>
            <div className="mt-0.5 font-[family-name:var(--font-cormorant)] text-[22px] font-semibold">
              {formatInTz(selected.at, customerTz, "EEE d MMM")},{" "}
              {formatInTz(selected.at, customerTz, "h:mm a")} with {teacherFirstName}
            </div>
            <div className="text-[13px] text-muted-foreground">
              {selected.durationMinutes} min ·{" "}
              {formatInTz(selected.at, teacherTimezone, "h:mm a")} for {teacherFirstName}
              {isPaid ? " · uses 1 session" : ""}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(null)}
              disabled={busy}
              className="border border-border bg-foreground/6 px-4 py-[11px] text-sm font-medium transition-colors hover:bg-foreground/12 disabled:opacity-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={book}
              disabled={busy}
              className="inline-flex items-center gap-2 border border-accent bg-accent px-[18px] py-[11px] text-sm font-semibold text-accent-foreground transition-colors hover:bg-[var(--myc-accent-hover)] disabled:opacity-70"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? "Booking…" : "Confirm booking"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
