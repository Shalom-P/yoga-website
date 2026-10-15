import { describe, expect, it } from "vitest";
import { isProfileComplete, postAuthTarget } from "./redirects";

describe("isProfileComplete", () => {
  const full = { full_name: "Asha Rao", phone: "+919876543210", experience_level: "beginner" };

  it("accepts a profile with name, phone and level", () => {
    expect(isProfileComplete(full)).toBe(true);
  });

  it("rejects a missing profile", () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete(undefined)).toBe(false);
  });

  it("rejects an email-only profile", () => {
    expect(isProfileComplete({ full_name: null, phone: null, experience_level: null })).toBe(false);
  });

  it("rejects a blank or whitespace name", () => {
    expect(isProfileComplete({ ...full, full_name: "" })).toBe(false);
    expect(isProfileComplete({ ...full, full_name: "   " })).toBe(false);
  });

  it("rejects a missing phone even when onboarding was otherwise finished", () => {
    expect(isProfileComplete({ ...full, phone: null })).toBe(false);
    expect(isProfileComplete({ ...full, phone: " " })).toBe(false);
  });

  it("rejects name and phone without the onboarding form", () => {
    expect(isProfileComplete({ ...full, experience_level: null })).toBe(false);
  });
});

describe("postAuthTarget", () => {
  it("sends an incomplete profile to onboarding, keeping the destination", () => {
    expect(postAuthTarget("/dashboard/book", false)).toBe("/onboarding?next=%2Fdashboard%2Fbook");
    expect(postAuthTarget("/dashboard", false)).toBe("/onboarding");
  });

  it("never sends a complete profile back to onboarding", () => {
    expect(postAuthTarget("/onboarding", true)).toBe("/dashboard");
    expect(postAuthTarget("/dashboard/book", true)).toBe("/dashboard/book");
  });
});
