/**
 * Whether a requested slot falls inside a teacher's weekly availability.
 *
 * **Zero dependencies, on purpose.** This module is imported by the Next.js
 * route handler (Node) AND by the `book-session` Supabase Edge Function (Deno),
 * so it may not import `date-fns`, `server-only`, or anything behind the `@/`
 * alias. Everything here is `Intl` and string maths, which both runtimes have
 * natively.
 *
 * Booking is the one flow where two implementations silently cost money and
 * double-book a teacher, so there is exactly one copy of these rules and both
 * runtimes call it.
 */

export type AvailabilityWindow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number | null;
};

/**
 * Postgres `time` columns serialize as "06:00", "06:00:00" or "06:00:00.000".
 * Normalise to "HH:mm:ss" so the lexical comparisons below are sound. The client
 * slot picker pads identically.
 */
export function padHms(hms: string): string {
  const parts = hms.split(":");
  const hh = (parts[0] ?? "00").padStart(2, "0");
  const mm = (parts[1] ?? "00").padStart(2, "0");
  const ss = (parts[2] ?? "00").slice(0, 2).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/** Wall-clock parts of an instant, as seen in `tz`. */
function zonedParts(instant: Date, tz: string): { ymd: string; hms: string } {
  // en-CA gives ISO-ordered dates; hourCycle h23 avoids the "24:00" some ICU
  // builds emit for midnight under hour12:false.
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(instant)) p[part.type] = part.value;
  return {
    ymd: `${p.year}-${p.month}-${p.day}`,
    hms: `${p.hour}:${p.minute}:${p.second}`,
  };
}

/** "yyyy-MM-dd" as seen in `tz`. Used to match one-off date overrides. */
export function teacherDateISO(instant: Date, tz: string): string {
  return zonedParts(instant, tz).ymd;
}

/** "HH:mm:ss" as seen in `tz`. */
export function teacherHms(instant: Date, tz: string): string {
  return zonedParts(instant, tz).hms;
}

/**
 * Day of week as seen in `tz`, in **Postgres's** convention: 0=Sun..6=Sat,
 * matching `teacher_availability.day_of_week`.
 *
 * Derived from the zoned calendar date rather than from a locale weekday string,
 * so there is no 1=Mon..7=Sun to 0=Sun..6=Sat remap to get wrong. The previous
 * implementation went through date-fns `"i"` and corrected `7 -> 0` by hand;
 * an off-by-one there books people into slots the teacher never offered.
 */
export function teacherDayOfWeek(instant: Date, tz: string): number {
  const [y, m, d] = teacherDateISO(instant, tz).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * True when [start, end) sits inside one of the teacher's weekly windows.
 *
 * Two rules that look incidental and are not:
 *  - a slot crossing midnight in the teacher TZ is rejected outright (v1), and
 *  - the requested duration must EQUAL the window's granularity, so a client
 *    cannot book a longer-than-offered slot that merely happens to fit.
 */
export function slotInsideAvailability(
  start: Date,
  end: Date,
  durationMinutes: number,
  tz: string,
  windows: AvailabilityWindow[],
): boolean {
  const dow = teacherDayOfWeek(start, tz);
  if (dow !== teacherDayOfWeek(end, tz)) return false;

  const startHms = teacherHms(start, tz);
  const endHms = teacherHms(end, tz);

  return windows.some(
    (w) =>
      w.day_of_week === dow &&
      durationMinutes === (w.slot_duration_minutes || 60) &&
      startHms >= padHms(w.start_time) &&
      endHms <= padHms(w.end_time),
  );
}
