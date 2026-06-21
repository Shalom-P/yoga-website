import { format, formatInTimeZone, toDate } from "date-fns-tz";

// Default fallback only — the onboarding/profile picker stores the customer's
// real device-detected IANA zone. India is the larger of the two served markets
// (UAE + India) and shares this zone with the teachers, so it's a safe default.
export const DEFAULT_CUSTOMER_TZ = "Asia/Kolkata";
export const TEACHER_TZ = "Asia/Kolkata";

/**
 * Full IANA timezone list for the picker, as `{ value, label }` (the shape
 * base-ui's Combobox auto-handles). `value` is the IANA id; `label` spaces the
 * underscores for readability and still contains the id so search matches it.
 * Falls back to a curated worldwide set on the rare runtime without
 * `Intl.supportedValuesOf`, so the picker is never empty.
 */
export function getTimezoneOptions(): { value: string; label: string }[] {
  let ids: string[] = [];
  try {
    ids = Intl.supportedValuesOf?.("timeZone") ?? [];
  } catch {
    ids = [];
  }
  if (!ids.length) {
    ids = Array.from(
      new Set([
        "Asia/Kolkata",
        "Asia/Dubai",
        "UTC",
        "Asia/Singapore",
        "Europe/London",
        "America/New_York",
        "America/Los_Angeles",
      ])
    );
  }
  return ids.map((id) => ({ value: id, label: id.replace(/_/g, " ") }));
}

/** Format a UTC timestamp in a given IANA timezone. */
export function formatInTz(
  isoOrDate: string | Date,
  timeZone: string,
  pattern = "EEE d MMM, h:mm a"
) {
  return formatInTimeZone(isoOrDate, timeZone, pattern);
}

/** "Tuesday 4 Jun, 7:30 PM" in the customer's TZ. */
export function formatCustomerTime(iso: string, customerTz = DEFAULT_CUSTOMER_TZ) {
  return formatInTimeZone(iso, customerTz, "EEEE d MMM, h:mm a");
}

/** "Tue 4 Jun, 3:00 PM IST" — the teacher-side display. */
export function formatTeacherTime(iso: string) {
  return `${formatInTimeZone(iso, TEACHER_TZ, "EEE d MMM, h:mm a")} IST`;
}

/** Returns the user's best-guess TZ from the browser. SSR safe. */
export function detectBrowserTimezone(): string {
  if (typeof Intl === "undefined") return DEFAULT_CUSTOMER_TZ;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_CUSTOMER_TZ;
  } catch {
    return DEFAULT_CUSTOMER_TZ;
  }
}

/** Construct a UTC Date from a teacher-local wall-clock time. */
export function teacherLocalToUtc(date: string, time: string): Date {
  // date "2026-06-04", time "07:00" → Date interpreted in TEACHER_TZ
  return toDate(`${date}T${time}:00`, { timeZone: TEACHER_TZ });
}

/** Short ISO marker e.g. "GST" / "IST" for a timezone, useful in slot pickers. */
export function tzShort(timeZone: string, at: Date = new Date()) {
  return format(at, "zzz", { timeZone });
}
