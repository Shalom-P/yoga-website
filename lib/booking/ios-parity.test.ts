import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { generateSlots } from "@/lib/booking/slots";

const S = process.env.SCRATCH;
// This test compares against output from the compiled Swift generator, which
// `scripts/verify-slots.sh` in the iOS repo produces. Skip when run on its own
// rather than failing a suite that has no way to generate it.
const swiftOutput = S ? `${S}/swift-slots.txt` : null;
const haveSwift = !!swiftOutput && existsSync(swiftOutput);

describe("the iOS slot grid agrees with the web implementation", () => {
  it.skipIf(!haveSwift)("produces byte-identical start times for the same availability", () => {
    const availability = [
      { day_of_week: 0, start_time: "06:00", end_time: "08:00", slot_duration_minutes: 60 },
      { day_of_week: 0, start_time: "06:00:00", end_time: "07:00:00", slot_duration_minutes: 60 },
      { day_of_week: 1, start_time: "06:00:00", end_time: "09:00:00", slot_duration_minutes: 60 },
      { day_of_week: 2, start_time: "18:00:00", end_time: "20:00:00", slot_duration_minutes: 60 },
      { day_of_week: 3, start_time: "05:30:00", end_time: "07:30:00", slot_duration_minutes: 60 },
      { day_of_week: 4, start_time: "06:00:00.000", end_time: "08:00:00.000", slot_duration_minutes: 60 },
      { day_of_week: 5, start_time: "06:00:00", end_time: "07:30:00", slot_duration_minutes: 30 },
      { day_of_week: 6, start_time: "22:30:00", end_time: "23:30:00", slot_duration_minutes: 60 },
    ];
    const web = generateSlots(
      availability as never,
      "Asia/Kolkata",
      new Date("2026-09-12T03:00:00Z"),
      ["2026-09-15"],
    ).map((s) => s.at.toISOString().replace(".000Z", "Z"));

    const swift = readFileSync(swiftOutput!, "utf8").trim().split("\n");

    expect(swift.length).toBeGreaterThan(0);
    expect(swift).toEqual(web);
  });
});
