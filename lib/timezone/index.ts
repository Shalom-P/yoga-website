import { TZDate } from "@date-fns/tz";
import { format, getTimezoneOffset, toDate } from "date-fns-tz";

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

/**
 * Format a UTC timestamp in a given IANA timezone.
 *
 * Not `formatInTimeZone`: date-fns-tz rebuilds the zone's wall time with the
 * runtime's local setters, so a wall time the runtime's own clock skips comes
 * out an hour late. IST 02:30 on 8 Mar 2026 read 03:30 in a Los Angeles
 * browser, where that night jumps from 02:00 to 03:00. UTC, IST and Dubai have
 * no such gap, so the server was right and hydration failed. A TZDate reads
 * the zone's fields from the instant itself, whatever zone the runtime is in.
 * Parsing and the zone-name tokens (`zzz`, `xxx`) stay with date-fns-tz.
 */
export function formatInTz(
  isoOrDate: string | Date,
  timeZone: string,
  pattern = "EEE d MMM, h:mm a"
) {
  const at = toDate(isoOrDate, { timeZone });
  // formatInTimeZone treated a blank zone as UTC; keep that rather than throw.
  return format(new TZDate(at, timeZone || "UTC"), pattern, { timeZone, originalDate: at });
}

/** "Tuesday 4 Jun, 7:30 PM" in the customer's TZ. */
export function formatCustomerTime(iso: string, customerTz = DEFAULT_CUSTOMER_TZ) {
  return formatInTz(iso, customerTz, "EEEE d MMM, h:mm a");
}

/** "Tue 4 Jun, 3:00 PM IST" — the teacher-side display. */
export function formatTeacherTime(iso: string) {
  return `${formatInTz(iso, TEACHER_TZ, "EEE d MMM, h:mm a")} IST`;
}

/**
 * The calendar day a timestamp falls on in IST, the zone the studio operates
 * in: "4 Jun 2026", or "-" when there is none. Admin tables use this instead of
 * `toLocaleDateString`, which formats in the runtime's own zone: UTC on the
 * server, the admin's zone in the browser. The two disagree for anything
 * stamped between 00:00 and 05:30 IST, which fails hydration and shows a day
 * that depends on where the admin is sitting.
 */
export function dayInIst(at: string | Date | null | undefined): string {
  if (!at) return "-";
  return formatInTz(at, DEFAULT_CUSTOMER_TZ, "d MMM yyyy");
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

/**
 * First instant of an IST calendar day ("2026-06-04"). With `istDayEnd`, this
 * turns a date-only admin input into the timestamps the backend compares. Both
 * read back as that same day through `dayInIst` or `formatInTz(at,
 * DEFAULT_CUSTOMER_TZ, "yyyy-MM-dd")`, whatever zone the admin's browser is in.
 */
export function istDayStart(date: string): Date {
  return toDate(`${date}T00:00:00`, { timeZone: DEFAULT_CUSTOMER_TZ });
}

/** Last instant (23:59:59.999) of an IST calendar day. See `istDayStart`. */
export function istDayEnd(date: string): Date {
  return toDate(`${date}T23:59:59.999`, { timeZone: DEFAULT_CUSTOMER_TZ });
}

/**
 * Short zone name e.g. "GST" / "IST" / "GMT+4", useful in slot pickers.
 *
 * Intl picks the name from the runtime's default locale, so the en-US server
 * and the browser can disagree: Asia/Dubai is "GMT+4" in en-US but "GST" in
 * en-GB or en-AE, and Asia/Kolkata is "IST" in en-IN. Safe in a Server
 * Component, which renders once. A client component must not render it until
 * mounted, or hydration fails: use tzOffsetLabel before then (LocalTzLabel).
 */
export function tzShort(timeZone: string, at: Date = new Date()) {
  return format(at, "zzz", { timeZone });
}

/**
 * The zone's UTC offset as "GMT+4" / "GMT+5:30" / "GMT-3:30", or "GMT" at zero.
 * Plain arithmetic on the offset rather than an Intl name, so the server and
 * every browser produce the same text. Throws a RangeError for an unknown zone,
 * like tzShort.
 */
export function tzOffsetLabel(timeZone: string, at: Date = new Date()) {
  const offsetMs = getTimezoneOffset(timeZone, at);
  if (Number.isNaN(offsetMs)) throw new RangeError(`Invalid time zone specified: ${timeZone}`);
  const offsetMin = Math.round(offsetMs / 60_000);
  if (offsetMin === 0) return "GMT";
  const abs = Math.abs(offsetMin);
  const minutes = abs % 60;
  return `GMT${offsetMin < 0 ? "-" : "+"}${Math.floor(abs / 60)}${
    minutes ? `:${String(minutes).padStart(2, "0")}` : ""
  }`;
}
