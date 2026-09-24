import { describe, it, expect } from "vitest";
import {
  DEFAULT_CUSTOMER_TZ,
  formatCustomerTime,
  formatInTz,
  formatTeacherTime,
  teacherLocalToUtc,
} from "@/lib/timezone";

// formatInTz went through date-fns-tz's formatInTimeZone, which rebuilds the
// zone's wall time with the runtime's local setters. An IST time inside the
// hour the runtime's own clock skips for DST came out an hour late: 02:30 on 8
// Mar 2026 read 03:30 in a Los Angeles browser. The UTC server has no such
// hour, so it rendered the right time and hydration failed against it. These
// pin the formatters to the target zone's clock whatever zone the process is in.

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

// UTC is the server, India and the UAE are where most viewers sit, and the last
// three observe DST, whose spring-forward hour is where a local-clock formatter
// slips.
const RUNTIME_ZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "America/Los_Angeles",
  "Europe/London",
  "Australia/Sydney",
];

// An instant whose IST wall time sits in the hour a DST runtime skips in 2026.
// All three are Sundays, the day clocks change.
const GAPS = [
  // Los Angeles skips 02:00 to 03:00.
  { runtime: "America/Los_Angeles", at: "2026-03-07T21:00:00Z", ist: "2026-03-08T02:30", line: "8 Mar, 2:30 AM" },
  // London skips 01:00 to 02:00.
  { runtime: "Europe/London", at: "2026-03-28T20:00:00Z", ist: "2026-03-29T01:30", line: "29 Mar, 1:30 AM" },
  // Sydney skips 02:00 to 03:00.
  { runtime: "Australia/Sydney", at: "2026-10-03T21:00:00Z", ist: "2026-10-04T02:30", line: "4 Oct, 2:30 AM" },
];

const WALL = "yyyy-MM-dd'T'HH:mm";

/** IST is UTC+05:30 all year, so its wall clock is plain arithmetic. */
function istWall(ms: number): string {
  return new Date(ms + 330 * 60_000).toISOString().slice(0, 16);
}

describe("formatInTz in a DST runtime", () => {
  it("the zone switch and the gaps are real, so the checks below prove something", () => {
    expect(inZone("UTC", () => new Date("2026-10-01T04:30:00Z").getHours())).toBe(4);
    expect(inZone("Asia/Kolkata", () => new Date("2026-10-01T04:30:00Z").getHours())).toBe(10);
    // A local clock moves each skipped time on by an hour, which is the slip.
    expect(inZone("America/Los_Angeles", () => new Date(2026, 2, 8, 2, 30).getHours())).toBe(3);
    expect(inZone("Europe/London", () => new Date(2026, 2, 29, 1, 30).getHours())).toBe(2);
    expect(inZone("Australia/Sydney", () => new Date(2026, 9, 4, 2, 30).getHours())).toBe(3);
  });

  it.each(GAPS)("shows IST $ist when the runtime is in $runtime", ({ runtime, at, ist, line }) => {
    inZone(runtime, () => {
      expect(formatInTz(at, DEFAULT_CUSTOMER_TZ, WALL)).toBe(ist);
      expect(formatInTz(at, DEFAULT_CUSTOMER_TZ)).toBe(`Sun ${line}`);
      expect(formatCustomerTime(at)).toBe(`Sunday ${line}`);
      expect(formatTeacherTime(at)).toBe(`Sun ${line} IST`);
    });
  });

  it.each(RUNTIME_ZONES)(
    "keeps the IST clock for every quarter hour of each gap day when the runtime is in %s",
    (tz) => {
      const wrong = inZone(tz, () => {
        const out: string[] = [];
        for (const { ist } of GAPS) {
          const dayStart = Date.parse(`${ist.slice(0, 10)}T00:00:00+05:30`);
          for (let ms = dayStart; ms < dayStart + 24 * 3_600_000; ms += 15 * 60_000) {
            const shown = formatInTz(new Date(ms), DEFAULT_CUSTOMER_TZ, WALL);
            if (shown !== istWall(ms)) out.push(`${istWall(ms)} shown as ${shown}`);
          }
        }
        return out;
      });
      expect(wrong).toEqual([]);
    },
  );

  it("holds for other zones too", () => {
    // A Dubai profile on a London laptop, and a London one in Los Angeles.
    expect(inZone("Europe/London", () => formatInTz("2026-03-28T21:30:00Z", "Asia/Dubai", WALL))).toBe(
      "2026-03-29T01:30",
    );
    expect(
      inZone("America/Los_Angeles", () => formatInTz("2026-03-08T02:30:00Z", "Europe/London", WALL)),
    ).toBe("2026-03-08T02:30");
  });
});

describe("SessionEditDialog's seed and re-send", () => {
  // The dialog seeds its IST date and time inputs with formatInTz, and a
  // duration-only edit sends them back through teacherLocalToUtc, so a start
  // shown an hour late moved the class an hour.
  it.each(RUNTIME_ZONES)("an untouched start saves unchanged when the runtime is in %s", (tz) => {
    inZone(tz, () => {
      for (const wall of ["2026-10-01T10:00", "2026-10-01T00:00", ...GAPS.map((g) => g.ist)]) {
        const [date, time] = wall.split("T");
        const start = teacherLocalToUtc(date, time);
        const resent = teacherLocalToUtc(
          formatInTz(start, DEFAULT_CUSTOMER_TZ, "yyyy-MM-dd"),
          formatInTz(start, DEFAULT_CUSTOMER_TZ, "HH:mm"),
        );
        expect(resent.toISOString(), wall).toBe(start.toISOString());
      }
    });
  });
});

describe("formatInTz output", () => {
  // 19:30 IST on Thursday 4 Jun 2026, in the +00:00 form PostgREST returns.
  const at = "2026-06-04T14:00:00+00:00";

  // The patterns the app passes.
  const PATTERNS: [string, string][] = [
    ["EEE d MMM, h:mm a", "Thu 4 Jun, 7:30 PM"],
    ["EEEE d MMM, h:mm a", "Thursday 4 Jun, 7:30 PM"],
    ["EEEE, d MMMM", "Thursday, 4 June"],
    ["EEE · h:mm a", "Thu · 7:30 PM"],
    ["EEE, d LLL", "Thu, 4 Jun"],
    ["EEE d MMM", "Thu 4 Jun"],
    ["d MMM, h:mm a", "4 Jun, 7:30 PM"],
    ["d MMM yyyy, h:mm a", "4 Jun 2026, 7:30 PM"],
    ["d MMM yyyy", "4 Jun 2026"],
    ["yyyy-MM-dd", "2026-06-04"],
    ["h:mm a", "7:30 PM"],
    ["HH:mm", "19:30"],
  ];

  it.each(RUNTIME_ZONES)("renders each app pattern when the runtime is in %s", (tz) => {
    inZone(tz, () => {
      for (const [pattern, shown] of PATTERNS) {
        expect(formatInTz(at, DEFAULT_CUSTOMER_TZ, pattern), pattern).toBe(shown);
      }
      expect(formatInTz(new Date(at), "Asia/Dubai", "h:mm a")).toBe("6:00 PM");
    });
  });

  it.each(RUNTIME_ZONES)("follows the target zone's own DST when the runtime is in %s", (tz) => {
    inZone(tz, () => {
      // London falls back at 01:00Z on 25 Oct 2026, so 01:30 happens twice...
      expect(formatInTz("2026-10-25T00:30:00Z", "Europe/London", "HH:mm")).toBe("01:30");
      expect(formatInTz("2026-10-25T01:30:00Z", "Europe/London", "HH:mm")).toBe("01:30");
      // ...and springs forward at 01:00Z on 29 Mar, so 01:30 never does.
      expect(formatInTz("2026-03-29T00:59:00Z", "Europe/London", "HH:mm")).toBe("00:59");
      expect(formatInTz("2026-03-29T01:00:00Z", "Europe/London", "HH:mm")).toBe("02:00");
    });
  });

  it("still throws on an unknown zone, and still reads a blank one as UTC", () => {
    // The roster drawer catches the throw to fall back to IST.
    expect(() => formatInTz(at, "Not/AZone")).toThrow(RangeError);
    expect(inZone("America/Los_Angeles", () => formatInTz(at, "", "HH:mm"))).toBe("14:00");
  });
});
