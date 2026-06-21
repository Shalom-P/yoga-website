import { describe, it, expect } from "vitest";
import {
  isServiceCountry,
  isServiceTimezone,
  canTransactFromTimezone,
  canTransactFromRequest,
  countryFromHeaders,
  currencyForCountry,
  currencyForTimezone,
  resolveRegion,
} from "@/lib/geo/region";

describe("isServiceTimezone", () => {
  it("accepts the served markets' zones", () => {
    expect(isServiceTimezone("Asia/Kolkata")).toBe(true);
    expect(isServiceTimezone("Asia/Dubai")).toBe(true);
  });
  it("rejects everything else and empty values", () => {
    expect(isServiceTimezone("Australia/Sydney")).toBe(false);
    expect(isServiceTimezone("America/New_York")).toBe(false);
    expect(isServiceTimezone(null)).toBe(false);
    expect(isServiceTimezone(undefined)).toBe(false);
  });
});

describe("isServiceCountry", () => {
  it("accepts IN and AE, case-insensitive", () => {
    expect(isServiceCountry("IN")).toBe(true);
    expect(isServiceCountry("ae")).toBe(true);
  });
  it("rejects others", () => {
    expect(isServiceCountry("AU")).toBe(false);
    expect(isServiceCountry("US")).toBe(false);
    expect(isServiceCountry(null)).toBe(false);
  });
});

describe("countryFromHeaders", () => {
  it("reads and upper-cases x-vercel-ip-country", () => {
    expect(countryFromHeaders(new Headers({ "x-vercel-ip-country": "ae" }))).toBe("AE");
  });
  it("returns null when absent", () => {
    expect(countryFromHeaders(new Headers())).toBeNull();
  });
});

describe("canTransactFromRequest", () => {
  it("admins are always allowed regardless of location", () => {
    expect(
      canTransactFromRequest({ isAdmin: true, country: "US", timezone: "America/New_York" }),
    ).toBe(true);
  });

  it("trusts GeoIP country over a spoofed served timezone (the bypass we closed)", () => {
    // Attacker POSTs Asia/Kolkata from the US — GeoIP wins.
    expect(
      canTransactFromRequest({ isAdmin: false, country: "US", timezone: "Asia/Kolkata" }),
    ).toBe(false);
  });

  it("allows IN and AE GeoIP", () => {
    expect(
      canTransactFromRequest({ isAdmin: false, country: "IN", timezone: "America/New_York" }),
    ).toBe(true);
    expect(
      canTransactFromRequest({ isAdmin: false, country: "AE", timezone: "America/New_York" }),
    ).toBe(true);
  });

  it("blocks the former AU market", () => {
    expect(
      canTransactFromRequest({ isAdmin: false, country: "AU", timezone: "Australia/Sydney" }),
    ).toBe(false);
  });

  it("falls back to timezone only when no GeoIP header (local/off-platform)", () => {
    expect(
      canTransactFromRequest({ isAdmin: false, country: null, timezone: "Asia/Dubai" }),
    ).toBe(true);
    expect(
      canTransactFromRequest({ isAdmin: false, country: null, timezone: "America/New_York" }),
    ).toBe(false);
  });
});

describe("canTransactFromTimezone (client-side helper)", () => {
  it("admin bypass + served timezone", () => {
    expect(canTransactFromTimezone({ isAdmin: true, timezone: "America/New_York" })).toBe(true);
    expect(canTransactFromTimezone({ isAdmin: false, timezone: "Asia/Kolkata" })).toBe(true);
    expect(canTransactFromTimezone({ isAdmin: false, timezone: "Australia/Sydney" })).toBe(false);
  });
});

describe("currency resolution", () => {
  it("maps country → currency", () => {
    expect(currencyForCountry("AE")).toBe("AED");
    expect(currencyForCountry("IN")).toBe("INR");
    expect(currencyForCountry("US")).toBeNull();
  });
  it("maps timezone → currency", () => {
    expect(currencyForTimezone("Asia/Dubai")).toBe("AED");
    expect(currencyForTimezone("Asia/Kolkata")).toBe("INR");
    expect(currencyForTimezone("America/New_York")).toBeNull();
  });
  it("resolveRegion: GeoIP wins over timezone", () => {
    // UAE GeoIP but an India timezone spoofed in the body → AED (GeoIP is truth).
    expect(resolveRegion({ country: "AE", timezone: "Asia/Kolkata" })).toEqual({
      country: "AE",
      currency: "AED",
      locale: "en-AE",
    });
  });
  it("resolveRegion: timezone fallback when no GeoIP", () => {
    expect(resolveRegion({ country: null, timezone: "Asia/Kolkata" })).toEqual({
      country: null,
      currency: "INR",
      locale: "en-IN",
    });
  });
  it("resolveRegion: defaults to INR when nothing resolves", () => {
    expect(resolveRegion({ country: null, timezone: "America/New_York" })).toEqual({
      country: null,
      currency: "INR",
      locale: "en-IN",
    });
  });
});
