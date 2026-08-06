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
  it("accepts the legacy Asia/Calcutta id that ICU browsers actually report", () => {
    // Chrome/Safari/Edge return "Asia/Calcutta" from
    // Intl.DateTimeFormat().resolvedOptions().timeZone — not "Asia/Kolkata".
    expect(isServiceTimezone("Asia/Calcutta")).toBe(true);
    expect(currencyForTimezone("Asia/Calcutta")).toBe("INR");
    expect(canTransactFromTimezone({ isAdmin: false, timezone: "Asia/Calcutta" })).toBe(true);
    expect(
      canTransactFromRequest({ isAdmin: false, country: null, timezone: "Asia/Calcutta" }),
    ).toBe(true);
  });
  it("rejects everything else and empty values", () => {
    expect(isServiceTimezone("Australia/Sydney")).toBe(false);
    expect(isServiceTimezone("America/New_York")).toBe(false);
    expect(isServiceTimezone(null)).toBe(false);
    expect(isServiceTimezone(undefined)).toBe(false);
  });
});

describe("world sweep — every IANA timezone and every possible country code", () => {
  // The full set of ids a browser can report for the served markets. ICU
  // canonicalizes Kolkata → Calcutta, so browsers never report "Asia/Kolkata",
  // but a stored profile or a non-ICU runtime still can.
  const SERVED_ZONE_IDS = ["Asia/Kolkata", "Asia/Calcutta", "Asia/Dubai"];

  it("exactly the India/UAE zone ids pass; all other world zones are blocked", () => {
    const zones = Intl.supportedValuesOf("timeZone");
    expect(zones.length).toBeGreaterThan(300); // sanity: the sweep is real
    const passing = zones.filter((z) => isServiceTimezone(z));
    // Nothing outside the served markets slips through (Muscat, Karachi,
    // Colombo, Tehran etc. share offsets with served zones but must fail).
    for (const z of passing) expect(SERVED_ZONE_IDS).toContain(z);
    // Both markets are represented in what the world's browsers can report.
    expect(passing.some((z) => currencyForTimezone(z) === "INR")).toBe(true);
    expect(passing.some((z) => currencyForTimezone(z) === "AED")).toBe(true);
  });

  it("every served id still passes after ICU canonicalization (what browsers report)", () => {
    for (const z of SERVED_ZONE_IDS) {
      const reported = new Intl.DateTimeFormat("en", { timeZone: z }).resolvedOptions().timeZone;
      expect(isServiceTimezone(reported)).toBe(true);
      expect(currencyForTimezone(reported)).toBe(currencyForTimezone(z));
    }
  });

  it("all 676 possible ISO alpha-2 codes: only IN and AE transact", () => {
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const a of A) {
      for (const b of A) {
        const code = `${a}${b}`;
        expect(isServiceCountry(code)).toBe(code === "IN" || code === "AE");
      }
    }
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
