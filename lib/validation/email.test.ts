import { describe, it, expect } from "vitest";
import { isValidEmail } from "@/lib/validation/email";

describe("isValidEmail", () => {
  it("accepts well-formed addresses (trimming whitespace)", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("  person@example.com  ")).toBe(true);
  });
  it("rejects malformed / empty values", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a@b.c")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });
});
