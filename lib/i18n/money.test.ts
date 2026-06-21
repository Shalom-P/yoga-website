import { describe, it, expect } from "vitest";
import { formatMoney } from "@/lib/i18n/money";

describe("formatMoney", () => {
  it("formats INR (whole rupees by default)", () => {
    expect(formatMoney(750000, "INR")).toBe("₹7,500");
    // Indian lakh grouping past ₹1,00,000.
    expect(formatMoney(20000000, "INR")).toBe("₹2,00,000");
    expect(formatMoney(0, "INR")).toBe("₹0");
  });

  it("formats AED", () => {
    // en-AE renders AED with the ISO code as the symbol.
    expect(formatMoney(35000, "AED")).toMatch(/AED|د\.إ/);
    expect(formatMoney(35000, "AED")).toContain("350");
  });

  it("shows minor units when asked", () => {
    expect(formatMoney(35050, "AED", { withCents: true })).toMatch(/350\.50/);
  });

  it("still renders historical AUD rows", () => {
    expect(formatMoney(18000, "AUD")).toBe("$180");
  });
});
