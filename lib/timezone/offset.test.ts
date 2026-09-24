import { describe, it, expect } from "vitest";
import { tzOffsetLabel } from "@/lib/timezone";

// LocalTzLabel renders this on the server and in the hydration pass, where the
// Intl short name (tzShort) is unsafe: it follows the runtime's locale, so the
// en-US server said "GMT+4" for Asia/Dubai while an en-GB browser said "GST",
// and React threw away every UAE customer's dashboard on hydration.
describe("tzOffsetLabel", () => {
  // Fixed instants, so the DST cases don't depend on when the suite runs.
  const january = new Date("2026-01-15T12:00:00Z");
  const july = new Date("2026-07-15T12:00:00Z");

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
  });

  it("follows DST at the given instant", () => {
    expect(tzOffsetLabel("Europe/London", july)).toBe("GMT+1");
    expect(tzOffsetLabel("America/New_York", january)).toBe("GMT-5");
    expect(tzOffsetLabel("America/New_York", july)).toBe("GMT-4");
    expect(tzOffsetLabel("Australia/Sydney", january)).toBe("GMT+11");
    expect(tzOffsetLabel("Australia/Sydney", july)).toBe("GMT+10");
  });

  it("throws on an unknown zone, like tzShort", () => {
    expect(() => tzOffsetLabel("Not/AZone", july)).toThrow(RangeError);
  });
});
