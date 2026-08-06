import { describe, it, expect } from "vitest";
import { getTimezoneOptions } from "@/lib/timezone";

// Guards the timezone-picker search trap: ICU's zone list has "Asia/Calcutta"
// (not "Asia/Kolkata"), so with raw ids as labels a search for "India" matched
// only the Indian-Ocean "Indian/*" zones and "Kolkata" matched nothing. A real
// customer got stored as Indian/Reunion (UTC+4, 90 min off IST) that way.
describe("getTimezoneOptions", () => {
  const options = getTimezoneOptions();
  const labelFor = (value: string) => options.find((o) => o.value === value)?.label;

  it("searching 'india' must surface Asia/Kolkata before any Indian/* ocean zone", () => {
    const matches = options.filter((o) => o.label.toLowerCase().includes("india"));
    expect(matches[0]?.value).toBe("Asia/Kolkata");
  });

  it("searching 'kolkata' and 'dubai' both find their market zone", () => {
    expect(options.some((o) => /kolkata/i.test(o.label))).toBe(true);
    const dubai = options.filter((o) => /dubai/i.test(o.label));
    expect(dubai.some((o) => o.value === "Asia/Dubai")).toBe(true);
  });

  it("featured market zones lead the list", () => {
    expect(options[0]?.value).toBe("Asia/Kolkata");
    expect(options[1]?.value).toBe("Asia/Dubai");
  });

  it("the Asia/Calcutta alias is not offered as a duplicate entry", () => {
    expect(labelFor("Asia/Calcutta")).toBeUndefined();
  });

  it("no duplicate values and the wider IANA list is still there", () => {
    const values = options.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values.length).toBeGreaterThan(300);
  });
});
