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
// The zones our markets actually search for, with labels that make them
// findable. Raw IANA ids are a trap here: ICU's list has "Asia/Calcutta" (not
// "Asia/Kolkata"), so searching "India" matches only the Indian-Ocean
// "Indian/*" zones and "Kolkata" matches nothing at all — a real customer
// ended up stored as Indian/Reunion (UTC+4, 90 min off IST) that way.
const FEATURED_ZONES: { value: string; label: string }[] = [
  { value: "Asia/Kolkata", label: "India · IST (Asia/Kolkata)" },
  { value: "Asia/Dubai", label: "UAE · Dubai, Abu Dhabi (Asia/Dubai)" },
];
// Alias ids hidden from the list because a featured entry covers them (a
// profile that already stores one still renders — the select synthesizes a
// label for unknown ids).
const ALIASED_ZONE_IDS = new Set(["Asia/Calcutta"]);

export function getTimezoneOptions(): { value: string; label: string }[] {
  let ids: string[] = [];
  try {
    ids = Intl.supportedValuesOf?.("timeZone") ?? [];
  } catch {
    ids = [];
  }
  if (!ids.length) {
    ids = ["UTC", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles"];
  }
  const featured = new Set(FEATURED_ZONES.map((z) => z.value));
  return [
    ...FEATURED_ZONES,
    ...ids
      .filter((id) => !featured.has(id) && !ALIASED_ZONE_IDS.has(id))
      .map((id) => ({ value: id, label: id.replace(/_/g, " ") })),
  ];
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
