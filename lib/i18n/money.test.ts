import { describe, it, expect } from "vitest";
import { formatAud } from "@/lib/i18n/money";

describe("formatAud", () => {
  it("formats integer cents as whole AUD by default", () => {
    expect(formatAud(18000)).toBe("$180");
    expect(formatAud(34000)).toBe("$340");
    expect(formatAud(0)).toBe("$0");
  });

  it("shows cents when asked", () => {
    expect(formatAud(18050, { withCents: true })).toBe("$180.50");
  });
});
