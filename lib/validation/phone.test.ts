import { describe, it, expect } from "vitest";
import { phoneErrorMessage, toE164, toPhoneCountry } from "@/lib/validation/phone";

describe("toPhoneCountry", () => {
  it("accepts an ISO country in any case (the edge sends it uppercase)", () => {
    expect(toPhoneCountry("IN")).toBe("IN");
    expect(toPhoneCountry("ae")).toBe("AE");
    expect(toPhoneCountry(" gb ")).toBe("GB");
  });
  it("returns undefined when there is no country the field can use", () => {
    expect(toPhoneCountry(null)).toBeUndefined();
    expect(toPhoneCountry(undefined)).toBeUndefined();
    expect(toPhoneCountry("")).toBeUndefined();
    expect(toPhoneCountry("XX")).toBeUndefined();
    expect(toPhoneCountry("EU")).toBeUndefined();
  });
});

describe("phoneErrorMessage", () => {
  it("gives an example in the visitor's own format", () => {
    expect(phoneErrorMessage("IN")).toMatch(/^Enter a valid mobile number, for example \+91 [\d ]+\.$/);
    expect(phoneErrorMessage("AE")).toContain("+971 ");
  });
  it("points at the flag menu when no country is known", () => {
    expect(phoneErrorMessage()).toContain("flag menu");
  });
});

describe("toE164", () => {
  // Why the field pre-selects a country: with none selected it hands over "+"
  // plus whatever was typed, so a 10-digit Indian mobile arrives as +98...
  it("rejects a 10-digit Indian mobile once the field has prefixed it with +", () => {
    expect(toE164("+9876543210")).toBeNull();
  });
  it("accepts the same number with India's calling code or country", () => {
    expect(toE164("+91 98765 43210")).toBe("+919876543210");
    expect(toE164("98765 43210", "IN")).toBe("+919876543210");
  });
  it("returns null for empty input", () => {
    expect(toE164("")).toBeNull();
    expect(toE164(null)).toBeNull();
  });
});
