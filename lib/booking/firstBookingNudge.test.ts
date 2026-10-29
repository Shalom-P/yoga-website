import { describe, expect, it } from "vitest";
import { FIRST_BOOKING_NUDGE_STAGES, nudgeSignupWindow } from "./firstBookingNudge";

const NOW = new Date("2026-10-29T12:00:00Z");

describe("nudgeSignupWindow", () => {
  it("covers sign-ups 1 to 12 hours old for the 1h stage", () => {
    expect(nudgeSignupWindow("1h", NOW)).toEqual({
      from: "2026-10-29T00:00:00.000Z",
      to: "2026-10-29T11:00:00.000Z",
    });
  });

  it("covers sign-ups 1 to 3 days old for the 24h stage", () => {
    expect(nudgeSignupWindow("24h", NOW)).toEqual({
      from: "2026-10-26T12:00:00.000Z",
      to: "2026-10-28T12:00:00.000Z",
    });
  });

  it("never lets one sign-up fall into both stages at the same moment", () => {
    const [first, second] = FIRST_BOOKING_NUDGE_STAGES;
    expect(first.maxAgeMs).toBeLessThan(second.minAgeMs);
  });
});
