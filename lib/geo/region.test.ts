import { describe, it, expect } from "vitest";
import {
  isBillingMarket,
  countryFromHeaders,
  currencyForCountry,
  currencyForTimezone,
  localeForCurrency,
  resolveRegion,
  DEFAULT_CURRENCY,
} from "@/lib/geo/region";

describe("no service-area gate", () => {
  // The studio used to block non-admin visitors outside the UAE and India from
  // buying packs and claiming the free 1:1. That gate is gone, so the property
  // worth pinning is that nothing anywhere resolves to "blocked": every request
  // gets a currency and can therefore transact.
  it("every one of the 676 possible ISO alpha-2 codes resolves to a currency", () => {
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const a of A) {
      for (const b of A) {
        const { currency } = resolveRegion({ country: `${a}${b}`, timezone: null });
        expect(currency).toBeTruthy();
      }
    }
  });

  it("every IANA timezone the world's browsers can report resolves to a currency", () => {
    const zones = Intl.supportedValuesOf("timeZone");
    expect(zones.length).toBeGreaterThan(300); // sanity: the sweep is real
    for (const z of zones) {
      const { currency } = resolveRegion({ country: null, timezone: z });
      expect(currency).toBeTruthy();
    }
  });

  it("the formerly blocked cases now transact in the fallback currency", () => {
    for (const [country, timezone] of [
      ["US", "America/New_York"],
      ["AU", "Australia/Sydney"],
      ["GB", "Europe/London"],
      ["SG", "Asia/Singapore"],
    ] as const) {
      expect(resolveRegion({ country, timezone })).toEqual({
        country: null,
        currency: DEFAULT_CURRENCY,
        locale: localeForCurrency(DEFAULT_CURRENCY),
      });
    }
  });
});

describe("isBillingMarket", () => {
  it("accepts IN and AE, case-insensitive", () => {
    expect(isBillingMarket("IN")).toBe(true);
    expect(isBillingMarket("ae")).toBe(true);
  });
  it("is false elsewhere, which means fallback currency, not blocked", () => {
    expect(isBillingMarket("US")).toBe(false);
    expect(isBillingMarket(null)).toBe(false);
    expect(isBillingMarket(undefined)).toBe(false);
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

  it("handles the legacy Asia/Calcutta id that ICU browsers actually report", () => {
    // Chrome/Safari/Edge return "Asia/Calcutta" from
    // Intl.DateTimeFormat().resolvedOptions().timeZone — not "Asia/Kolkata".
    // Missing the alias would bill Indian customers in the fallback currency.
    expect(currencyForTimezone("Asia/Calcutta")).toBe("INR");
    for (const z of ["Asia/Kolkata", "Asia/Calcutta", "Asia/Dubai"]) {
      const reported = new Intl.DateTimeFormat("en", { timeZone: z }).resolvedOptions().timeZone;
      expect(currencyForTimezone(reported)).toBe(currencyForTimezone(z));
    }
  });

  it("GeoIP wins over timezone, because it decides what the customer is charged", () => {
    // UAE GeoIP but an India timezone spoofed in the body → AED.
    expect(resolveRegion({ country: "AE", timezone: "Asia/Kolkata" })).toEqual({
      country: "AE",
      currency: "AED",
      locale: "en-AE",
    });
    // A US visitor cannot claim AED pricing by POSTing Asia/Dubai... they get
    // the country's answer, which is the fallback.
    expect(resolveRegion({ country: "US", timezone: "Asia/Dubai" }).currency).toBe(
      DEFAULT_CURRENCY,
    );
  });

  it("falls back to timezone when there is no GeoIP header (local/off-platform)", () => {
    expect(resolveRegion({ country: null, timezone: "Asia/Kolkata" })).toEqual({
      country: null,
      currency: "INR",
      locale: "en-IN",
    });
    expect(resolveRegion({ country: null, timezone: "Asia/Dubai" }).currency).toBe("AED");
  });

  it("defaults when nothing resolves", () => {
    expect(resolveRegion({ country: null, timezone: null }).currency).toBe(DEFAULT_CURRENCY);
  });
});
