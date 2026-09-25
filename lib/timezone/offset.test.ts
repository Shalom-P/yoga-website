import { describe, it, expect } from "vitest";
import { tzDiffLabel, tzOffsetLabel } from "@/lib/timezone";

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

// UTC is the server; the rest are browsers, three of them in zones with DST.
const RUNTIME_ZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "America/Los_Angeles",
  "Europe/London",
  "Australia/Sydney",
];

// Fixed instants, so the DST cases don't depend on when the suite runs.
const january = new Date("2026-01-15T12:00:00Z");
const july = new Date("2026-07-15T12:00:00Z");

// Half an hour either side of each zone's 2026 clock changes, with the offset
// label and how far IST runs ahead (the slot picker's teacher chip). date-fns-tz
// getTimezoneOffset read the instant as a wall time in the zone, which put one
// of each New York and Sydney pair on the wrong side of the switch in every
// runtime zone, and London's 01:30Z on 25 Oct in a Los Angeles runtime.
const AROUND_DST = [
  // New York: 02:00 EST jumps to 03:00 EDT at 07:00Z on 8 Mar, back at 06:00Z on 1 Nov.
  { zone: "America/New_York", at: "2026-03-08T06:30:00Z", label: "GMT-5", istAhead: "+10:30" },
  { zone: "America/New_York", at: "2026-03-08T07:30:00Z", label: "GMT-4", istAhead: "+9:30" },
  { zone: "America/New_York", at: "2026-11-01T05:30:00Z", label: "GMT-4", istAhead: "+9:30" },
  { zone: "America/New_York", at: "2026-11-01T06:30:00Z", label: "GMT-5", istAhead: "+10:30" },
  // London: 01:00Z on 29 Mar and 25 Oct.
  { zone: "Europe/London", at: "2026-03-29T00:30:00Z", label: "GMT", istAhead: "+5:30" },
  { zone: "Europe/London", at: "2026-03-29T01:30:00Z", label: "GMT+1", istAhead: "+4:30" },
  { zone: "Europe/London", at: "2026-10-25T00:30:00Z", label: "GMT+1", istAhead: "+4:30" },
  { zone: "Europe/London", at: "2026-10-25T01:30:00Z", label: "GMT", istAhead: "+5:30" },
  // Sydney: 16:00Z on 4 Apr (03:00 AEDT on the 5th) and on 3 Oct (02:00 AEST on the 4th).
  { zone: "Australia/Sydney", at: "2026-04-04T15:30:00Z", label: "GMT+11", istAhead: "-5:30" },
  { zone: "Australia/Sydney", at: "2026-04-04T16:30:00Z", label: "GMT+10", istAhead: "-4:30" },
  { zone: "Australia/Sydney", at: "2026-10-03T15:30:00Z", label: "GMT+10", istAhead: "-4:30" },
  { zone: "Australia/Sydney", at: "2026-10-03T16:30:00Z", label: "GMT+11", istAhead: "-5:30" },
];

// LocalTzLabel renders this on the server and in the hydration pass, where the
// Intl short name (tzShort) is unsafe: it follows the runtime's locale, so the
// en-US server said "GMT+4" for Asia/Dubai while an en-GB browser said "GST",
// and React threw away every UAE customer's dashboard on hydration.
describe("tzOffsetLabel", () => {
  it("labels the served markets by offset, not by an Intl name", () => {
    expect(tzOffsetLabel("Asia/Dubai", july)).toBe("GMT+4");
    expect(tzOffsetLabel("Asia/Kolkata", july)).toBe("GMT+5:30");
    // The ICU alias browsers report for India must read the same.
    expect(tzOffsetLabel("Asia/Calcutta", july)).toBe("GMT+5:30");
  });

  it("pads the minutes on non-whole-hour offsets, either side of GMT", () => {
    expect(tzOffsetLabel("Asia/Kathmandu", july)).toBe("GMT+5:45");
    expect(tzOffsetLabel("America/St_Johns", january)).toBe("GMT-3:30");
  });

  it("reads plain GMT at a zero offset", () => {
    expect(tzOffsetLabel("UTC", july)).toBe("GMT");
    expect(tzOffsetLabel("Europe/London", january)).toBe("GMT");
    // date-fns-tz read a blank zone as UTC, and a blank one still gets here.
    expect(tzOffsetLabel("", july)).toBe("GMT");
  });

  it("follows DST at the given instant", () => {
    expect(tzOffsetLabel("Europe/London", july)).toBe("GMT+1");
    expect(tzOffsetLabel("America/New_York", january)).toBe("GMT-5");
    expect(tzOffsetLabel("America/New_York", july)).toBe("GMT-4");
    expect(tzOffsetLabel("Australia/Sydney", january)).toBe("GMT+11");
    expect(tzOffsetLabel("Australia/Sydney", july)).toBe("GMT+10");
  });

  it("the zone switch is real, so the runtime loops below prove something", () => {
    const at = new Date("2026-03-08T06:30:00Z");
    expect(inZone("UTC", () => at.getHours())).toBe(6);
    expect(inZone("America/Los_Angeles", () => at.getHours())).toBe(22);
    expect(inZone("Australia/Sydney", () => at.getHours())).toBe(17);
  });

  it.each(AROUND_DST)("$zone at $at reads $label in every runtime zone", ({ zone, at, label }) => {
    for (const runtime of RUNTIME_ZONES) {
      expect(inZone(runtime, () => tzOffsetLabel(zone, new Date(at))), runtime).toBe(label);
    }
  });

  it("throws on an unknown zone, like tzShort", () => {
    expect(() => tzOffsetLabel("Not/AZone", july)).toThrow(RangeError);
  });
});

// The slot picker's "Teacher · Asia/Kolkata (+1:30)" chip: how far the
// teacher's clock runs ahead of the customer's.
describe("tzDiffLabel", () => {
  it("reads how far the first zone's clock runs ahead of the second's", () => {
    expect(tzDiffLabel("Asia/Kolkata", "Asia/Dubai", july)).toBe("+1:30");
    expect(tzDiffLabel("Asia/Dubai", "Asia/Kolkata", july)).toBe("-1:30");
    expect(tzDiffLabel("Asia/Kolkata", "America/New_York", july)).toBe("+9:30");
    expect(tzDiffLabel("Asia/Kolkata", "Australia/Sydney", july)).toBe("-4:30");
  });

  it("always shows the minutes", () => {
    expect(tzDiffLabel("UTC", "Asia/Dubai", july)).toBe("-4:00");
  });

  it("says 'same time' when the clocks agree, alias included", () => {
    expect(tzDiffLabel("Asia/Kolkata", "Asia/Kolkata", july)).toBe("same time");
    expect(tzDiffLabel("Asia/Kolkata", "Asia/Calcutta", july)).toBe("same time");
  });

  it.each(AROUND_DST)(
    "IST runs $istAhead ahead of $zone at $at in every runtime zone",
    ({ zone, at, istAhead }) => {
      for (const runtime of RUNTIME_ZONES) {
        expect(
          inZone(runtime, () => tzDiffLabel("Asia/Kolkata", zone, new Date(at))),
          runtime,
        ).toBe(istAhead);
      }
    },
  );

  it("reads a blank zone as UTC", () => {
    expect(tzDiffLabel("Asia/Kolkata", "", july)).toBe("+5:30");
  });

  it("throws on an unknown zone on either side", () => {
    expect(() => tzDiffLabel("Not/AZone", "Asia/Kolkata", july)).toThrow(RangeError);
    expect(() => tzDiffLabel("Asia/Kolkata", "Not/AZone", july)).toThrow(RangeError);
  });
});
