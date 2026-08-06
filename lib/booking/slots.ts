// Pure slot-expansion logic for the booking slot picker. No React, no network —
// kept out of the component so it can be unit-tested (see slots.test.ts) and so
// the padding stays in lockstep with the server-side check in
// app/api/bookings/confirm/route.ts (its padHms must behave identically).

import { addDays, addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export type Availability = {
  day_of_week: number; // 0 = Sun..6 = Sat
  start_time: string; // "06:00:00"
  end_time: string; // "12:00:00"
  slot_duration_minutes: number;
};

// A bookable slot plus the duration of the window it came from, so the duration
// the customer saw is exactly what gets POSTed to the API (not a hardcoded 60).
export type Slot = { at: Date; durationMinutes: number };

export function padHms(hms: string): string {
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
export function generateSlots(
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
  // Admins can save overlapping windows (e.g. 06:00-12:00 plus 08:00-09:00 on
  // the same day), which yields the same start time from multiple windows —
  // duplicate buttons with duplicate React keys, listed out of order. Keep the
  // first slot per start time and sort chronologically.
  const seen = new Set<number>();
  return out
    .filter((s) => {
      const t = s.at.getTime();
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}
