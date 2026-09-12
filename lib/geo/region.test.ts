import { describe, it, expect } from "vitest";
import {
  isBillingMarket,
  countryFromHeaders,
  currencyForCountry,
  currencyForTimezone,
  localeForCurrency,
  resolveRegion,
  INTERNATIONAL_CURRENCY,
  SUPPORTED_CURRENCIES,
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

  it("the formerly blocked cases all transact, in their own currency or USD", () => {
    const expected = {
      US: "USD",
      GB: "GBP",
      DE: "EUR",
      AU: INTERNATIONAL_CURRENCY, // no currency of its own here
      SG: INTERNATIONAL_CURRENCY,
    } as const;
    for (const [country, currency] of Object.entries(expected)) {
      expect(resolveRegion({ country, timezone: null }).currency).toBe(currency);
    }
  });

  it("only ever resolves to a currency the app supports", () => {
    const supported = new Set<string>(SUPPORTED_CURRENCIES);
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const a of A) {
      for (const b of A) {
        expect(supported.has(resolveRegion({ country: `${a}${b}`, timezone: null }).currency)).toBe(
          true,
        );
      }
    }
    for (const z of Intl.supportedValuesOf("timeZone")) {
      expect(supported.has(resolveRegion({ country: null, timezone: z }).currency)).toBe(true);
    }
  });
});

describe("isBillingMarket", () => {
  it("accepts countries with a currency of their own, case-insensitive", () => {
    expect(isBillingMarket("IN")).toBe(true);
    expect(isBillingMarket("ae")).toBe(true);
    expect(isBillingMarket("US")).toBe(true);
    expect(isBillingMarket("gb")).toBe(true);
    expect(isBillingMarket("DE")).toBe(true); // eurozone
  });
  it("is false elsewhere, which means the international currency, not blocked", () => {
    expect(isBillingMarket("AU")).toBe(false);
    expect(isBillingMarket("SG")).toBe(false);
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
    expect(currencyForCountry("US")).toBe("USD");
    expect(currencyForCountry("GB")).toBe("GBP");
    expect(currencyForCountry("AU")).toBeNull(); // no currency of its own
  });

  it("gives every eurozone member the same EUR price", () => {
    for (const c of ["DE", "FR", "IT", "ES", "NL", "IE", "PT", "AT", "FI", "GR"]) {
      expect(currencyForCountry(c)).toBe("EUR");
    }
  });

  it("maps timezone → currency", () => {
    expect(currencyForTimezone("Asia/Dubai")).toBe("AED");
    expect(currencyForTimezone("Asia/Kolkata")).toBe("INR");
    expect(currencyForTimezone("Europe/London")).toBe("GBP");
    expect(currencyForTimezone("America/New_York")).toBe("USD");
    expect(currencyForTimezone("Europe/Paris")).toBe("EUR");
    expect(currencyForTimezone("Australia/Sydney")).toBeNull(); // no mapping
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
    // A US visitor cannot claim AED pricing by POSTing Asia/Dubai: they get the
    // country's answer. This is the whole reason GeoIP outranks the timezone —
    // the timezone is client-supplied and decides what someone is charged.
    expect(resolveRegion({ country: "US", timezone: "Asia/Dubai" }).currency).toBe("USD");
    // ...and an unpriced-country visitor cannot reach into a cheaper currency either.
    expect(resolveRegion({ country: "AU", timezone: "Asia/Kolkata" }).currency).toBe(
      INTERNATIONAL_CURRENCY,
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

  it("falls back to the international currency when nothing resolves", () => {
    expect(resolveRegion({ country: null, timezone: null }).currency).toBe(
      INTERNATIONAL_CURRENCY,
    );
  });

  it("gives every supported currency a real locale", () => {
    for (const c of SUPPORTED_CURRENCIES) {
      expect(localeForCurrency(c)).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
  });
});
