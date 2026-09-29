import { describe, it, expect } from "vitest";
import { istWallTime, istWallTimeToUtc } from "@/lib/timezone";

// The promotional-media schedule wrote `new Date(<datetime-local value>)`, the
// ADMIN's browser zone, and read it back with `.slice(0, 16)`, the UTC wall
// time. For an admin in IST a banner set for 10:00 was stored as 04:30Z,
// reopened as 04:30 and re-saved as 04:30 IST: 5h30m earlier on every save (4h
// from Dubai). These pin both halves to the IST wall clock whatever zone the
// process is in.

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

// UTC is the server, India and the UAE are where admins sit, and the last three
// observe DST, whose spring-forward hour is where a local-clock formatter slips.
const RUNTIME_ZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "America/Los_Angeles",
  "Europe/London",
  "Australia/Sydney",
];

// IST wall times, as a datetime-local input gives them. The last three exist in
// IST but not on the local clock of one of the DST zones above.
const WALL_TIMES = [
  "2026-10-01T10:00",
  "2026-10-01T00:00", // IST midnight, still 30 Sep in UTC
  "2026-12-31T23:59",
  "2028-02-29T12:00",
  "2026-03-08T02:30", // Los Angeles skips 02:00 to 03:00
  "2026-03-29T01:30", // London skips 01:00 to 02:00
  "2026-10-04T02:30", // Sydney skips 02:00 to 03:00
];

describe("istWallTime / istWallTimeToUtc", () => {
  it("the zone switch and the DST gap are real, so the checks below prove something", () => {
    expect(inZone("UTC", () => new Date("2026-10-01T04:30:00Z").getHours())).toBe(4);
    expect(inZone("Asia/Kolkata", () => new Date("2026-10-01T04:30:00Z").getHours())).toBe(10);
    // 02:30 on 8 Mar does not exist in Los Angeles; the local clock moves it on to 03:30.
    expect(inZone("America/Los_Angeles", () => new Date(2026, 2, 8, 2, 30).getHours())).toBe(3);
  });

  it("the old write and read-back moved an IST admin's banner 5h30m earlier per save", () => {
    const resaved = inZone("Asia/Kolkata", () => {
      const stored = new Date("2026-10-01T10:00").toISOString();
      return new Date(stored.slice(0, 16)).toISOString();
    });
    expect(resaved).toBe("2026-09-30T23:00:00.000Z");
  });

  it.each(RUNTIME_ZONES)("reads and shows 10:00 as IST when the runtime is in %s", (tz) => {
    inZone(tz, () => {
      expect(istWallTimeToUtc("2026-10-01T10:00").toISOString()).toBe("2026-10-01T04:30:00.000Z");
      // The +00:00 offset form PostgREST returns for a timestamptz.
      expect(istWallTime("2026-10-01T04:30:00+00:00")).toBe("2026-10-01T10:00");
    });
  });

  it.each(RUNTIME_ZONES)("what is typed is what reopens, when the runtime is in %s", (tz) => {
    inZone(tz, () => {
      for (const wall of WALL_TIMES) {
        expect(istWallTime(istWallTimeToUtc(wall)), wall).toBe(wall);
      }
    });
  });

  it.each(RUNTIME_ZONES)(
    "reopening and saving untouched keeps the stored instant, when the runtime is in %s",
    (tz) => {
      inZone(tz, () => {
        for (const wall of WALL_TIMES) {
          const stored = istWallTimeToUtc(wall).toISOString();
          let resaved = stored;
          for (let save = 0; save < 3; save++) {
            resaved = istWallTimeToUtc(istWallTime(resaved)).toISOString();
          }
          expect(resaved, wall).toBe(stored);
        }
      });
    },
  );

  it("shows whole minutes, as the input does, for a timestamp with seconds in it", () => {
    expect(istWallTime("2026-10-01T04:30:45.123456+00:00")).toBe("2026-10-01T10:00");
  });
});
