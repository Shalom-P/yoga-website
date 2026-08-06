import { describe, it, expect } from "vitest";
import { generateSlots, padHms, type Availability } from "@/lib/booking/slots";

const TZ = "Asia/Kolkata";
// A Sunday 05:30 IST, so the whole following week is in range.
const NOW = new Date("2026-08-09T00:00:00Z");

describe("padHms", () => {
  it("normalizes every Postgres time serialization", () => {
    expect(padHms("06:00")).toBe("06:00:00");
    expect(padHms("06:00:00")).toBe("06:00:00");
    expect(padHms("06:00:00.000")).toBe("06:00:00");
    expect(padHms("6:5")).toBe("06:05:00");
  });
});

describe("generateSlots", () => {
  // Live-data shape that surfaced the bug: an umbrella window plus one-hour
  // windows inside it on the same day (Dr Sangeeta's real Monday rows).
  const overlapping: Availability[] = [
    { day_of_week: 1, start_time: "06:00:00", end_time: "12:00:00", slot_duration_minutes: 60 },
    { day_of_week: 1, start_time: "08:00:00", end_time: "09:00:00", slot_duration_minutes: 60 },
    { day_of_week: 1, start_time: "09:00:00", end_time: "10:00:00", slot_duration_minutes: 60 },
  ];

  it("overlapping windows never produce duplicate slots", () => {
    const slots = generateSlots(overlapping, TZ, NOW, []);
    const keys = slots.map((s) => s.at.toISOString());
    expect(new Set(keys).size).toBe(keys.length);
    // The umbrella window alone yields 06..11 starts = 6 slots.
    expect(slots).toHaveLength(6);
  });

  it("slots come back in chronological order", () => {
    const times = generateSlots(overlapping, TZ, NOW, []).map((s) => s.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("a blocked date removes that whole day", () => {
    // NOW is Sunday 9 Aug in IST, so the Monday windows fall on 10 Aug.
    const slots = generateSlots(overlapping, TZ, NOW, ["2026-08-10"]);
    expect(slots).toHaveLength(0);
  });

  it("slots within 15 minutes of now are not offered", () => {
    const justBefore: Availability[] = [
      // 05:30-06:30 IST window on Sunday = exactly NOW.
      { day_of_week: 0, start_time: "05:30:00", end_time: "07:30:00", slot_duration_minutes: 60 },
    ];
    const slots = generateSlots(justBefore, TZ, NOW, []);
    // The 05:30 slot (== now) is dropped; 06:30 survives.
    expect(slots.map((s) => s.at.toISOString())).toEqual(["2026-08-09T01:00:00.000Z"]);
  });

  it("the window's own duration is carried onto the slot", () => {
    const thirty: Availability[] = [
      { day_of_week: 1, start_time: "06:00:00", end_time: "07:00:00", slot_duration_minutes: 30 },
    ];
    const slots = generateSlots(thirty, TZ, NOW, []);
    expect(slots).toHaveLength(2);
    expect(slots.every((s) => s.durationMinutes === 30)).toBe(true);
  });
});
