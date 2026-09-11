"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { useBrowserTz, useHasMounted } from "@/components/dashboard/local-time";
import { generateSlots, type Availability, type Slot } from "@/lib/booking/slots";

type Props = {
  teacherId: string;
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

export function TeacherSlotPicker({
  teacherId,
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
  const [busy, setBusy] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const now = new Date();
    const slots = generateSlots(availability, teacherTimezone, now, blockedDates ?? []);
    const buckets = new Map<string, Slot[]>();
    for (const s of slots) {
      const dayKey = formatInTimeZone(s.at, customerTz, "yyyy-MM-dd");
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
    book(slot);
  }

  async function book(slot: Slot) {
    setBusy(slot.at.toISOString());
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
    setBusy(null);
    if (res.ok) {
      // Paid bookings go to the bookings list; the free trial gets the upsell.
      router.push(isPaid ? "/dashboard/bookings?booked=1" : "/dashboard/plan?booked=1");
      return;
    }
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
      <div className="mt-10 rounded-2xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
        Checking your local time…
      </div>
    );
  }

  if (grouped.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
        No times available in the next 7 days. Check back soon or pick another teacher.
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error === "trial_already_claimed" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                You&apos;ve already claimed your free 1:1. Choose a plan to keep booking sessions.
              </span>
              <Button asChild size="sm" className="shrink-0 rounded-full">
                <Link href="/dashboard/plan">View plans &amp; pricing</Link>
              </Button>
            </div>
          ) : error === "insufficient_credits" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>You&apos;re out of prepaid sessions. Buy a pack to keep booking.</span>
              <Button asChild size="sm" className="shrink-0 rounded-full">
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

      <div className="text-xs text-muted-foreground">
        Times shown in your local time ({customerTz}). Teacher is in {teacherTimezone}.
      </div>

      {grouped.map(([dayKey, slots]) => (
        <div key={dayKey}>
          <div className="text-sm font-medium mb-2">
            {formatInTimeZone(slots[0].at, customerTz, "EEE, d LLL")}
          </div>
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => {
              const label = formatInTimeZone(s.at, customerTz, "h:mm a");
              const teacherLabel = formatInTimeZone(s.at, teacherTimezone, "h:mm a");
              const id = s.at.toISOString();
              return (
                <Button
                  key={id}
                  variant="outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => onSlotClick(s)}
                  className="rounded-full text-xs"
                  title={`Teacher's time: ${teacherLabel} · ${s.durationMinutes} min`}
                >
                  {busy === id ? "Booking…" : label}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
