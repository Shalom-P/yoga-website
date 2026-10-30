import { describe, expect, it } from "vitest";
import { signupAlertDue } from "./signupAlert";

const now = new Date("2026-10-30T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

const complete = { full_name: "Asha Rao", phone: "+919876543210", experience_level: "beginner" };
const unfinished = { full_name: "Asha Rao", phone: "+919876543210", experience_level: null };

describe("signupAlertDue", () => {
  it("alerts as soon as onboarding is complete", () => {
    expect(signupAlertDue({ ...complete, created_at: minutesAgo(2) }, now)).toBe(true);
  });

  it("waits for an unfinished profile, then alerts after an hour", () => {
    expect(signupAlertDue({ ...unfinished, created_at: minutesAgo(30) }, now)).toBe(false);
    expect(signupAlertDue({ ...unfinished, created_at: minutesAgo(60) }, now)).toBe(true);
  });

  it("alerts after an hour even with no name or phone", () => {
    const bare = { full_name: null, phone: null, experience_level: null };
    expect(signupAlertDue({ ...bare, created_at: minutesAgo(90) }, now)).toBe(true);
  });

  it("never alerts about sign-ups older than a week", () => {
    expect(signupAlertDue({ ...complete, created_at: minutesAgo(8 * 24 * 60) }, now)).toBe(false);
  });

  it("ignores an unparseable created_at", () => {
    expect(signupAlertDue({ ...complete, created_at: "not a date" }, now)).toBe(false);
  });
});
