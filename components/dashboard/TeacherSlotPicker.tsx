"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { useBrowserTz, useHasMounted } from "@/components/dashboard/local-time";
import { isServiceTimezone, OUTSIDE_SERVICE_AREA } from "@/lib/geo/region";

type Availability = {
  day_of_week: number; // 0 = Sun..6 = Sat
  start_time: string; // "06:00:00"
  end_time: string; // "12:00:00"
  slot_duration_minutes: number;
};

// A bookable slot plus the duration of the window it came from, so the duration
// the customer saw is exactly what gets POSTed to the API (not a hardcoded 60).
type Slot = { at: Date; durationMinutes: number };

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
  /** Admins may book from any location; customers must be in the UAE or India. */
  isAdmin: boolean;
};

function padHms(hms: string): string {
  // Postgres `time` columns can serialize as "06:00", "06:00:00", or "06:00:00.000".
  // Normalize to "HH:mm:ss" so the date string we hand to fromZonedTime parses cleanly.
  const parts = hms.split(":");
  const hh = (parts[0] ?? "00").padStart(2, "0");
  const mm = (parts[1] ?? "00").padStart(2, "0");
  const ss = (parts[2] ?? "00").slice(0, 2).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// For the next 7 days in the teacher's local TZ, expand each weekly window
// into discrete slots. Anchor on noon in teacher TZ so day-arithmetic stays
// stable across DST jumps and never spills into a neighbouring date.
function generateSlots(
  availability: Availability[],
  teacherTz: string,
  now: Date,
  blockedDates: string[],
): Slot[] {
  const out: Slot[] = [];
  const blocked = new Set(blockedDates);
  const todayStr = formatInTimeZone(now, teacherTz, "yyyy-MM-dd");
  const noonAnchorUtc = fromZonedTime(`${todayStr}T12:00:00`, teacherTz);
  for (let i = 0; i < 7; i++) {
    const dayAnchorUtc = addDays(noonAnchorUtc, i);
    const dateStr = formatInTimeZone(dayAnchorUtc, teacherTz, "yyyy-MM-dd");
    // A one-off blocked date overrides the recurring weekly availability.
    if (blocked.has(dateStr)) continue;
    // date-fns-tz formats "i" as 1=Mon..7=Sun; Postgres day_of_week is 0=Sun..6=Sat.
    const isoDow = Number(formatInTimeZone(dayAnchorUtc, teacherTz, "i"));
    const dow = isoDow === 7 ? 0 : isoDow;
    for (const window of availability.filter((a) => a.day_of_week === dow)) {
      const dur = window.slot_duration_minutes || 60;
      const windowStartUtc = fromZonedTime(`${dateStr}T${padHms(window.start_time)}`, teacherTz);
      const windowEndUtc = fromZonedTime(`${dateStr}T${padHms(window.end_time)}`, teacherTz);
      let cur = windowStartUtc;
      while (addMinutes(cur, dur).getTime() <= windowEndUtc.getTime()) {
        if (cur.getTime() > now.getTime() + 15 * 60_000) {
          out.push({ at: cur, durationMinutes: dur });
        }
        cur = addMinutes(cur, dur);
      }
    }
  }
  return out;
}

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

  // Service-area gate for the free 1:1 trial. Non-admins outside the UAE/India
  // can't claim it (the server enforces this too). Paid bookings that spend
  // already-purchased credits are unaffected.
  const outsideServiceArea = !isAdmin && !isServiceTimezone(customerTz);
  const trialBlocked = outsideServiceArea && freeTrialAvailable;

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
    if (trialBlocked) {
      setError(OUTSIDE_SERVICE_AREA);
      return;
    }
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

  // For a trial-eligible non-admin, hold off on the slot grid until the real
  // browser timezone resolves, otherwise an out-of-area user sees a flash of
  // bookable slots before the banner. Admins and paid bookings are unaffected.
  if (!isAdmin && freeTrialAvailable && !tzResolved) {
    return (
      <div className="mt-10 rounded-2xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
        Checking your location…
      </div>
    );
  }

  // Outside the service area + free trial still unclaimed → nothing is bookable
  // here. Show why instead of a slot grid the booking API would reject anyway.
  if (trialBlocked) {
    return (
      <div className="mt-10 rounded-2xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          The free 1:1 trial is available to customers in the UAE and India.
        </p>
        <p className="mt-1.5">
          We detected your timezone as {customerTz}, which is outside our service
          area, so we can&apos;t book a trial class for you right now. If this looks
          wrong, check your device&apos;s time &amp; timezone settings.
        </p>
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
              <span>You&apos;re out of session credits. Buy a pack to keep booking.</span>
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
          ) : error === OUTSIDE_SERVICE_AREA ? (
            "The free 1:1 trial is available to customers in the UAE and India only."
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
