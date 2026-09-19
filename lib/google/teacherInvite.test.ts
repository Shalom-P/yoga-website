import { describe, it, expect } from "vitest";
import { teacherInviteEmail, sessionAttendees } from "./teacherInvite";

describe("teacherInviteEmail", () => {
  it("prefers the linked login over the contact fallback", () => {
    expect(
      teacherInviteEmail({ contact_email: "fallback@gmail.com", profile: { email: "Real@Studio.com" } }),
    ).toBe("real@studio.com");
  });

  it("falls back to contact_email when there is no linked profile", () => {
    expect(teacherInviteEmail({ contact_email: "Teacher@Gmail.com", profile: null })).toBe(
      "teacher@gmail.com",
    );
  });

  it("returns null when neither exists, so callers skip the invite", () => {
    expect(teacherInviteEmail({ contact_email: null, profile: null })).toBeNull();
    expect(teacherInviteEmail({})).toBeNull();
  });

  // A malformed address must not reach Google: it would 400 the whole event
  // insert and leave the session with no Meet link at all.
  it("rejects malformed addresses rather than passing them to Google", () => {
    for (const bad of ["not-an-email", "  ", "a@b", "@nope.com", "two@@at.com"]) {
      expect(teacherInviteEmail({ contact_email: bad }), bad).toBeNull();
    }
  });
});

describe("sessionAttendees", () => {
  it("includes the teacher alongside the student", () => {
    expect(sessionAttendees(["s@x.com"], "t@y.com")).toEqual(["s@x.com", "t@y.com"]);
  });

  it("omits the teacher when unresolved", () => {
    expect(sessionAttendees(["s@x.com"], null)).toEqual(["s@x.com"]);
  });

  it("de-duplicates and drops empties", () => {
    expect(sessionAttendees(["S@x.com", null, "", "s@x.com"], "S@X.com")).toEqual(["s@x.com"]);
  });

  it("returns an empty list when nothing resolves", () => {
    expect(sessionAttendees([null, undefined], null)).toEqual([]);
  });
});
