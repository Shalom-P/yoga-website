import { describe, expect, it } from "vitest";

import {
  bookingConversion,
  CONSENT_REQUIRED_REGIONS,
  googlePageUrl,
  googleReferrer,
  googleTagAllowedFor,
  googleTagWantedOn,
  parseConversionLabel,
  parseGoogleAdsId,
  purchaseConversion,
} from "./googleAds";

const ORIGIN = "https://www.myyogaclasses.fit";

describe("googleTagWantedOn", () => {
  it("loads for everyone wherever a pack can be bought", () => {
    for (const path of ["/", "/pricing", "/dashboard/plan"]) {
      expect(googleTagWantedOn(path), path).toBe(true);
    }
  });

  it("stays off every other page for an organic visit", () => {
    for (const path of ["/classes/diabetes", "/teachers/dr-x", "/about", "/login", "/dashboard", "/dashboard/book/dr-x"]) {
      expect(googleTagWantedOn(path, "?utm_source=newsletter"), path).toBe(false);
    }
  });

  it("loads on any public or customer page reached from a Google ad click", () => {
    expect(googleTagWantedOn("/classes/diabetes", "?gclid=Cj0K")).toBe(true);
    expect(googleTagWantedOn("/teachers/dr-x", "?gad_source=1&gbraid=0AAA")).toBe(true);
    expect(googleTagWantedOn("/about", "?wbraid=Cl0K")).toBe(true);
  });

  it("never loads in the staff areas or on the medical documents screen, click id or not", () => {
    for (const path of ["/admin", "/admin/payments", "/teacher", "/teacher/documents", "/dashboard/documents"]) {
      expect(googleTagWantedOn(path, "?gclid=Cj0K"), path).toBe(false);
    }
  });

  it("doesn't mistake the public /teachers listing for the /teacher staff area", () => {
    expect(googleTagWantedOn("/teachers/dr-x", "?gclid=Cj0K")).toBe(true);
  });
});

describe("googlePageUrl", () => {
  it("keeps the page, and only ad click ids and UTM tags from the query", () => {
    expect(
      googlePageUrl(ORIGIN, "/classes/diabetes", "?gclid=Cj0K&utm_source=google&utm_term=yoga&ref=x"),
    ).toBe(`${ORIGIN}/classes/diabetes?gclid=Cj0K&utm_source=google&utm_term=yoga`);
    expect(googlePageUrl(ORIGIN, "/", "?gbraid=a&wbraid=b&gad_source=1")).toBe(
      `${ORIGIN}/?gbraid=a&wbraid=b&gad_source=1`,
    );
    expect(googlePageUrl(ORIGIN, "/pricing")).toBe(`${ORIGIN}/pricing`);
  });

  it("never passes on a promo code or a return path", () => {
    expect(googlePageUrl(ORIGIN, "/dashboard/plan", "?planSlug=pack-5&promo=SAVE10")).toBe(
      `${ORIGIN}/dashboard/plan`,
    );
    expect(googlePageUrl(ORIGIN, "/", "?next=%2Fdashboard%2Fbook%2Fdr-x")).toBe(`${ORIGIN}/`);
  });
});

describe("googleReferrer", () => {
  it("keeps only the site the visitor came from", () => {
    expect(googleReferrer("https://forum.example/diabetes/thread-1?u=2")).toBe("https://forum.example/");
    expect(googleReferrer(`${ORIGIN}/classes/diabetes?promo=SAVE10`)).toBe(`${ORIGIN}/`);
    expect(googleReferrer("https://www.google.com/")).toBe("https://www.google.com/");
  });

  it("returns nothing for a missing or unparseable referrer", () => {
    expect(googleReferrer("")).toBe("");
    expect(googleReferrer("not a url")).toBe("");
  });
});

describe("googleTagAllowedFor", () => {
  const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

  it("allows an ordinary browser", () => {
    expect(googleTagAllowedFor(safari)).toBe(true);
    expect(googleTagAllowedFor(safari, false)).toBe(true);
  });

  it("refuses the iOS app and Global Privacy Control, like Meta", () => {
    expect(googleTagAllowedFor(`${safari} MyYogaClassesiOS`)).toBe(false);
    expect(googleTagAllowedFor(safari, true)).toBe(false);
  });
});

describe("purchaseConversion", () => {
  const paid = { transactionId: "pay_Q1w2E3r4", amountMinor: 449900, currency: "inr" };

  it("sends the charged amount in major units, keyed on the payment id", () => {
    expect(purchaseConversion("AW-18466176637", "XsfRCOvX-4MdEP38reVE", paid)).toEqual({
      send_to: "AW-18466176637/XsfRCOvX-4MdEP38reVE",
      value: 4499,
      currency: "INR",
      transaction_id: "pay_Q1w2E3r4",
    });
    expect(purchaseConversion("AW-1", "L", { ...paid, amountMinor: 43550, currency: "AED" })?.value).toBe(435.5);
  });

  it("sends nothing when unconfigured or the purchase is malformed", () => {
    expect(purchaseConversion(undefined, "L", paid)).toBeNull();
    expect(purchaseConversion("AW-1", undefined, paid)).toBeNull();
    expect(purchaseConversion("AW-1", "L", { ...paid, transactionId: "" })).toBeNull();
    expect(purchaseConversion("AW-1", "L", { ...paid, amountMinor: Number.NaN })).toBeNull();
    expect(purchaseConversion("AW-1", "L", { ...paid, amountMinor: -1 })).toBeNull();
  });
});

describe("bookingConversion", () => {
  const booking = { bookingId: "6d0f3d6e-1b2c-4a5e-9f70-0c1d2e3f4a5b" };

  it("sends the booking id as the transaction id and nothing else", () => {
    const params = bookingConversion("AW-18466176637", "AbCdEfGhIjKlMnOpQrSt", booking);
    expect(params).toEqual({
      send_to: "AW-18466176637/AbCdEfGhIjKlMnOpQrSt",
      transaction_id: booking.bookingId,
    });
    // No value, currency, teacher or time: the label alone says a 1:1 was booked.
    expect(Object.keys(params ?? {}).sort()).toEqual(["send_to", "transaction_id"]);
  });

  it("sends nothing when unconfigured or without a booking id", () => {
    expect(bookingConversion(undefined, "L", booking)).toBeNull();
    expect(bookingConversion("AW-1", undefined, booking)).toBeNull();
    expect(bookingConversion("AW-1", "L", { bookingId: "" })).toBeNull();
  });
});

describe("config parsing", () => {
  it("accepts a Google Ads tag id and nothing else", () => {
    expect(parseGoogleAdsId(" AW-18466176637 ")).toBe("AW-18466176637");
    for (const bad of [undefined, "", "AW-", "G-ABC123", "GTM-XYZ", "AW-1\"></script>"]) {
      expect(parseGoogleAdsId(bad), String(bad)).toBeUndefined();
    }
  });

  it("accepts a conversion label and nothing else", () => {
    expect(parseConversionLabel("XsfRCOvX-4MdEP38reVE")).toBe("XsfRCOvX-4MdEP38reVE");
    expect(parseConversionLabel("AW-1/label")).toBeUndefined();
    expect(parseConversionLabel("")).toBeUndefined();
  });
});

describe("CONSENT_REQUIRED_REGIONS", () => {
  it("covers the EEA, the UK and Switzerland", () => {
    expect(CONSENT_REQUIRED_REGIONS).toHaveLength(32);
    for (const code of ["DE", "FR", "IE", "NO", "IS", "LI", "GB", "CH"]) {
      expect(CONSENT_REQUIRED_REGIONS).toContain(code);
    }
    expect(CONSENT_REQUIRED_REGIONS).not.toContain("IN");
    expect(CONSENT_REQUIRED_REGIONS).not.toContain("AE");
  });
});
