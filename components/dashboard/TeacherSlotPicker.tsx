"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, addMinutes, startOfDay } from "date-fns";
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

function parseHms(hms: string): { h: number; m: number } {
  const [h = "0", m = "0"] = hms.split(":");
  return { h: Number(h), m: Number(m) };
}

// For the next 7 days in the teacher's local TZ, expand each weekly window
// into discrete slots. Convert each slot's local start back to UTC.
function generateSlots(
  availability: Availability[],
  teacherTz: string,
  now: Date,
): Date[] {
  const out: Date[] = [];
  const todayInTeacherTz = formatInTimeZone(now, teacherTz, "yyyy-MM-dd");
  const teacherDayBase = startOfDay(new Date(`${todayInTeacherTz}T00:00:00`));
  for (let i = 0; i < 7; i++) {
    const day = addDays(teacherDayBase, i);
    const dow = day.getDay();
    for (const window of availability.filter((a) => a.day_of_week === dow)) {
      const { h: sh, m: sm } = parseHms(window.start_time);
      const { h: eh, m: em } = parseHms(window.end_time);
      const dur = window.slot_duration_minutes || 60;
      let cur = new Date(day);
      cur.setHours(sh, sm, 0, 0);
      const windowEnd = new Date(day);
      windowEnd.setHours(eh, em, 0, 0);
      while (addMinutes(cur, dur).getTime() <= windowEnd.getTime()) {
        const dateStr = formatInTimeZone(cur, "UTC", "yyyy-MM-dd'T'HH:mm:ss");
        const utcSlot = fromZonedTime(dateStr, teacherTz);
        if (utcSlot.getTime() > now.getTime() + 15 * 60_000) {
          out.push(utcSlot);
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
