import { describe, it, expect } from "vitest";
import {
  DEFAULT_CUSTOMER_TZ,
  dayInIst,
  formatInTz,
  istDayEnd,
  istDayStart,
} from "@/lib/timezone";

// Admin tables used `new Date(x).toLocaleDateString("en-GB")`, which formats in
// the runtime's zone: UTC while the server renders, the admin's own zone once
// the browser hydrates. For anything stamped between 00:00 and 05:30 IST the
// two named different days and React threw a hydration mismatch. These pin the
// IST helpers to one answer whatever zone the process is in.

/** Run `fn` with the process in `tz`. Node applies a TZ change immediately. */
function inZone<T>(tz: string, fn: () => T): T {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  }
}

// UTC is the server; the others are admin laptops (India, UAE, and one far west).
const RUNTIME_ZONES = ["UTC", "Asia/Kolkata", "Asia/Dubai", "America/Los_Angeles"];

// 00:30 IST on 1 Oct: still 30 Sep in UTC and anywhere west of it.
const AFTER_IST_MIDNIGHT = "2026-09-30T19:00:00Z";

describe("dayInIst", () => {
  it("the zone switch is real, so the checks below prove something", () => {
    expect(inZone("UTC", () => new Date(AFTER_IST_MIDNIGHT).getDate())).toBe(30);
    expect(inZone("Asia/Kolkata", () => new Date(AFTER_IST_MIDNIGHT).getDate())).toBe(1);
  });

  it.each(RUNTIME_ZONES)("names the IST day when the runtime is in %s", (tz) => {
    expect(inZone(tz, () => dayInIst(AFTER_IST_MIDNIGHT))).toBe("1 Oct 2026");
  });

  it("turns over at 18:30 UTC, which is midnight IST", () => {
    expect(dayInIst("2026-09-30T18:29:59.999Z")).toBe("30 Sep 2026");
    expect(dayInIst("2026-09-30T18:30:00Z")).toBe("1 Oct 2026");
  });

  it("reads the +00:00 offset form PostgREST returns", () => {
    expect(dayInIst("2026-09-30T19:00:00+00:00")).toBe("1 Oct 2026");
  });

  it("shows '-' when there is no timestamp", () => {
    expect(dayInIst(null)).toBe("-");
    expect(dayInIst(undefined)).toBe("-");
    expect(dayInIst("")).toBe("-");
  });
});

describe("istDayStart / istDayEnd", () => {
  it.each(RUNTIME_ZONES)("bound the IST day when the runtime is in %s", (tz) => {
    inZone(tz, () => {
      expect(istDayStart("2026-10-01").toISOString()).toBe("2026-09-30T18:30:00.000Z");
      expect(istDayEnd("2026-10-01").toISOString()).toBe("2026-10-01T18:29:59.999Z");
    });
  });

  // The discount form wrote the admin's local midnight and read it back with
  // `.slice(0, 10)`, the UTC date, so every re-save moved `valid_from` back a day.
  it.each(["2026-10-01", "2026-12-31", "2027-01-01", "2028-02-29"])(
    "%s reads back as the same day after a save, in every runtime zone",
    (day) => {
      for (const tz of RUNTIME_ZONES) {
        inZone(tz, () => {
          for (const stored of [istDayStart(day), istDayEnd(day)]) {
            expect(formatInTz(stored, DEFAULT_CUSTOMER_TZ, "yyyy-MM-dd")).toBe(day);
          }
          expect(dayInIst(istDayEnd(day))).toBe(dayInIst(istDayStart(day)));
        });
      }
    },
  );
});
