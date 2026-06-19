import { describe, it, expect } from "vitest";
import { friendlyAuthError, friendlyFormError } from "@/lib/ui/errors";

describe("friendlyAuthError", () => {
  it("special-cases rate limits", () => {
    expect(friendlyAuthError("email rate limit exceeded")).toMatch(/too many attempts/i);
  });
  it("maps invalid/expired OTP codes", () => {
    expect(friendlyAuthError("Token has expired or is invalid")).toMatch(/invalid|expired/i);
  });
  it("falls back to a generic message and never echoes raw text", () => {
    const raw = "new row violates row-level security policy for table profiles";
    expect(friendlyAuthError(raw)).not.toContain("row-level security");
    expect(friendlyAuthError(null)).toMatch(/something went wrong/i);
  });
});

describe("friendlyFormError", () => {
  it("special-cases rate limits", () => {
    expect(friendlyFormError("Too Many Requests")).toMatch(/too many attempts/i);
  });
  it("uses a save-oriented generic fallback and hides raw text", () => {
    const raw = "duplicate key value violates unique constraint";
    expect(friendlyFormError(raw)).not.toContain("unique constraint");
    expect(friendlyFormError(raw)).toMatch(/couldn't save/i);
  });
});
