import { describe, expect, it } from "vitest";
import { isProfileComplete, postAuthTarget, safeNext } from "./redirects";

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

describe("safeNext", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeNext("/dashboard/plan?x=1#top")).toBe("/dashboard/plan?x=1#top");
    expect(safeNext("/teacher")).toBe("/teacher");
  });

  it("falls back for empty and absolute or protocol-relative targets", () => {
    for (const bad of [null, undefined, "", "https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "evil.com"]) {
      expect(safeNext(bad)).toBe("/dashboard");
    }
  });

  it("rejects control-character tricks the URL parser strips", () => {
    // searchParams.get() decodes %09/%0A/%0D before safeNext sees them.
    for (const bad of ["/\t/evil.com", "/\n/evil.com", "/\r\\evil.com", "/\u0000/evil.com", "/\t\t/evil.com"]) {
      expect(safeNext(bad)).toBe("/dashboard");
      expect(new URL(safeNext(bad), "https://www.myyogaclasses.fit").origin).toBe("https://www.myyogaclasses.fit");
    }
  });

  it("uses the supplied fallback", () => {
    expect(safeNext("//evil.com", "/teacher")).toBe("/teacher");
  });
});
