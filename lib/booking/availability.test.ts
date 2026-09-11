import { describe, it, expect } from "vitest";
import { formatInTimeZone } from "date-fns-tz";
import {
  padHms,
  teacherDayOfWeek,
  teacherHms,
  teacherDateISO,
  slotInsideAvailability,
  type AvailabilityWindow,
} from "@/lib/booking/availability";

// The implementation this replaced, kept verbatim so the port is provably
// equivalent rather than merely plausible.
function legacyDayOfWeek(startUtc: Date, tz: string): number {
  const iso = Number(formatInTimeZone(startUtc, tz, "i"));
  return iso === 7 ? 0 : iso;
}

const IST = "Asia/Kolkata";

describe("teacherDayOfWeek matches the date-fns implementation it replaced", () => {
  it("agrees across a full week in IST, including the Sunday 7 -> 0 boundary", () => {
    // 2026-09-06 is a Sunday. Walk a week at several times of day.
    for (let day = 0; day < 7; day++) {
      for (const hour of [0, 5, 12, 18, 23]) {
        const d = new Date(Date.UTC(2026, 8, 6 + day, hour, 30));
        expect(teacherDayOfWeek(d, IST)).toBe(legacyDayOfWeek(d, IST));
      }
    }
  });

  it("agrees where the UTC date and the teacher date differ", () => {
    // 19:00 UTC is already the NEXT day in IST (+05:30), which is exactly the
    // case a naive UTC getUTCDay() would get wrong.
    const d = new Date("2026-09-12T19:00:00Z"); // Sat in UTC, Sun in IST
    expect(teacherDayOfWeek(d, IST)).toBe(legacyDayOfWeek(d, IST));
    expect(teacherDayOfWeek(d, IST)).toBe(0);
    expect(teacherDateISO(d, IST)).toBe("2026-09-13");
  });

  it("agrees across timezones with half-hour and DST offsets", () => {
    for (const tz of ["Asia/Kolkata", "Asia/Dubai", "Europe/London", "America/New_York", "Australia/Sydney"]) {
      for (const iso of ["2026-01-15T03:00:00Z", "2026-07-15T03:00:00Z", "2026-03-29T01:30:00Z"]) {
        const d = new Date(iso);
        expect(teacherDayOfWeek(d, tz), `${tz} ${iso}`).toBe(legacyDayOfWeek(d, tz));
      }
    }
  });
});

describe("teacherHms matches formatInTimeZone", () => {
  it("agrees, including midnight which some ICU builds render as 24:00", () => {
    for (const iso of ["2026-09-12T18:30:00Z", "2026-09-12T06:15:45Z", "2026-01-01T00:00:00Z"]) {
      const d = new Date(iso);
      expect(teacherHms(d, IST)).toBe(formatInTimeZone(d, IST, "HH:mm:ss"));
    }
    // 18:30Z == 00:00 IST exactly.
    expect(teacherHms(new Date("2026-09-12T18:30:00Z"), IST)).toBe("00:00:00");
  });
});

describe("padHms", () => {
  it("normalises every shape Postgres emits", () => {
    expect(padHms("6:00")).toBe("06:00:00");
    expect(padHms("06:00:00")).toBe("06:00:00");
    expect(padHms("06:00:00.000")).toBe("06:00:00");
  });
});

describe("slotInsideAvailability", () => {
  // Sunday 06:00-08:00 IST, 60-minute slots.
  const windows: AvailabilityWindow[] = [
    { day_of_week: 0, start_time: "06:00:00", end_time: "08:00:00", slot_duration_minutes: 60 },
  ];
  // 2026-09-13 is a Sunday. 00:30Z == 06:00 IST.
  const start = new Date("2026-09-13T00:30:00Z");
  const hour = (d: Date, mins: number) => new Date(d.getTime() + mins * 60_000);

  it("accepts a slot inside the window", () => {
    expect(slotInsideAvailability(start, hour(start, 60), 60, IST, windows)).toBe(true);
  });

  it("rejects a slot ending after the window", () => {
    const late = new Date("2026-09-13T02:00:00Z"); // 07:30 IST, ends 08:30
    expect(slotInsideAvailability(late, hour(late, 60), 60, IST, windows)).toBe(false);
  });

  it("rejects a duration the window does not offer, even if it fits", () => {
    // 30 minutes fits inside 06:00-08:00 but the window's granularity is 60.
    expect(slotInsideAvailability(start, hour(start, 30), 30, IST, windows)).toBe(false);
  });

  it("rejects the wrong day", () => {
    const monday = new Date("2026-09-14T00:30:00Z");
    expect(slotInsideAvailability(monday, hour(monday, 60), 60, IST, windows)).toBe(false);
  });

  it("rejects a slot crossing midnight in the teacher timezone", () => {
    const late = new Date("2026-09-13T18:00:00Z"); // 23:30 IST Sunday
    const w: AvailabilityWindow[] = [
      { day_of_week: 0, start_time: "00:00:00", end_time: "23:59:59", slot_duration_minutes: 60 },
    ];
    expect(slotInsideAvailability(late, hour(late, 60), 60, IST, w)).toBe(false);
  });

  it("treats a null granularity as 60 minutes", () => {
    const w: AvailabilityWindow[] = [
      { day_of_week: 0, start_time: "06:00:00", end_time: "08:00:00", slot_duration_minutes: null },
    ];
    expect(slotInsideAvailability(start, hour(start, 60), 60, IST, w)).toBe(true);
  });
});
