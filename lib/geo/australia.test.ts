import { describe, it, expect } from "vitest";
import {
  isAustralianTimezone,
  canTransactFromTimezone,
  canTransactFromRequest,
  countryFromHeaders,
} from "@/lib/geo/australia";

describe("isAustralianTimezone", () => {
  it("accepts any Australia/* zone", () => {
    expect(isAustralianTimezone("Australia/Sydney")).toBe(true);
    expect(isAustralianTimezone("Australia/Perth")).toBe(true);
    expect(isAustralianTimezone("Australia/Eucla")).toBe(true);
  });
  it("rejects non-AU zones and empty values", () => {
    expect(isAustralianTimezone("Asia/Kolkata")).toBe(false);
    expect(isAustralianTimezone("America/New_York")).toBe(false);
    expect(isAustralianTimezone(null)).toBe(false);
    expect(isAustralianTimezone(undefined)).toBe(false);
  });
});

describe("countryFromHeaders", () => {
  it("reads and upper-cases x-vercel-ip-country", () => {
    expect(countryFromHeaders(new Headers({ "x-vercel-ip-country": "au" }))).toBe("AU");
  });
  it("returns null when absent", () => {
    expect(countryFromHeaders(new Headers())).toBeNull();
  });
});

describe("canTransactFromRequest", () => {
  it("admins are always allowed regardless of location", () => {
    expect(
      canTransactFromRequest({ isAdmin: true, country: "US", timezone: "America/New_York" })
    ).toBe(true);
  });

  it("trusts GeoIP country over a spoofed AU timezone (the bypass we closed)", () => {
    // Attacker POSTs Australia/Sydney from the US — GeoIP wins.
    expect(
      canTransactFromRequest({ isAdmin: false, country: "US", timezone: "Australia/Sydney" })
    ).toBe(false);
  });

  it("allows AU GeoIP", () => {
    expect(
      canTransactFromRequest({ isAdmin: false, country: "AU", timezone: "Asia/Kolkata" })
    ).toBe(true);
  });

  it("falls back to timezone only when no GeoIP header (local/off-platform)", () => {
    expect(
      canTransactFromRequest({ isAdmin: false, country: null, timezone: "Australia/Sydney" })
    ).toBe(true);
    expect(
      canTransactFromRequest({ isAdmin: false, country: null, timezone: "Asia/Kolkata" })
    ).toBe(false);
  });
});

describe("canTransactFromTimezone (legacy helper)", () => {
  it("admin bypass + AU timezone", () => {
    expect(canTransactFromTimezone({ isAdmin: true, timezone: "Asia/Kolkata" })).toBe(true);
    expect(canTransactFromTimezone({ isAdmin: false, timezone: "Australia/Sydney" })).toBe(true);
    expect(canTransactFromTimezone({ isAdmin: false, timezone: "Asia/Kolkata" })).toBe(false);
  });
});
