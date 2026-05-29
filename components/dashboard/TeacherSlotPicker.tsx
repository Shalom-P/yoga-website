"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { Button } from "@/components/ui/button";

type Availability = {
  day_of_week: number; // 0 = Sun..6 = Sat
  start_time: string; // "06:00:00"
  end_time: string; // "12:00:00"
  slot_duration_minutes: number;
};

type Props = {
  teacherId: string;
  teacherTimezone: string;
  customerTimezone: string;
  availability: Availability[];
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
): Date[] {
  const out: Date[] = [];
  const todayStr = formatInTimeZone(now, teacherTz, "yyyy-MM-dd");
  const noonAnchorUtc = fromZonedTime(`${todayStr}T12:00:00`, teacherTz);
  for (let i = 0; i < 7; i++) {
    const dayAnchorUtc = addDays(noonAnchorUtc, i);
    const dateStr = formatInTimeZone(dayAnchorUtc, teacherTz, "yyyy-MM-dd");
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
          out.push(cur);
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
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const now = new Date();
    const slots = generateSlots(availability, teacherTimezone, now);
    const buckets = new Map<string, Date[]>();
    for (const s of slots) {
      const dayKey = formatInTimeZone(s, customerTimezone, "yyyy-MM-dd");
      const arr = buckets.get(dayKey) ?? [];
      arr.push(s);
      buckets.set(dayKey, arr);
    }
    return Array.from(buckets.entries()).slice(0, 7);
  }, [availability, teacherTimezone, customerTimezone]);

  async function book(slot: Date) {
    setBusy(slot.toISOString());
    setError(null);
    const res = await fetch("/api/bookings/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        teacherId,
        startAt: slot.toISOString(),
        durationMinutes: 60,
        isFreeTrial: true,
      }),
    });
    setBusy(null);
    if (res.ok) {
      router.push("/dashboard?booked=1");
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setError(body.error ?? "booking_failed");
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
          {error === "trial_already_claimed"
            ? "You've already claimed your free 1:1. Upgrade to a plan to book more sessions."
            : error === "slot_taken"
            ? "That slot was just booked by someone else. Try another time."
            : "Couldn't book that slot. Please try again."}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Times shown in your local time ({customerTimezone}). Teacher is in {teacherTimezone}.
      </div>

      {grouped.map(([dayKey, slots]) => (
        <div key={dayKey}>
          <div className="text-sm font-medium mb-2">
            {formatInTimeZone(slots[0], customerTimezone, "EEE, d LLL")}
          </div>
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => {
              const label = formatInTimeZone(s, customerTimezone, "h:mm a");
              const teacherLabel = formatInTimeZone(s, teacherTimezone, "h:mm a");
              const id = s.toISOString();
              return (
                <Button
                  key={id}
                  variant="outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => book(s)}
                  className="rounded-full text-xs"
                  title={`Teacher's time: ${teacherLabel}`}
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
