import { describe, it, expect } from "vitest";
import { sessionsNotCredits } from "@/lib/copy/sessions";

describe("sessionsNotCredits", () => {
  it("rewrites the bullets actually stored in plan_features", () => {
    // These are the live DB strings this exists to fix.
    expect(sessionsNotCredits("Credits never expire")).toBe("Sessions never expire");
    expect(sessionsNotCredits("Credit never expires")).toBe("Session never expires");
  });

  it("preserves the leading capital", () => {
    expect(sessionsNotCredits("Credits are personal to you")).toBe(
      "Sessions are personal to you"
    );
    expect(sessionsNotCredits("your credits never expire")).toBe(
      "your sessions never expire"
    );
  });

  it("collapses the compound form instead of doubling the noun", () => {
    expect(sessionsNotCredits("You're out of session credits.")).toBe(
      "You're out of sessions."
    );
    expect(sessionsNotCredits("one session credit")).toBe("one session");
    // Hyphenated variant used in admin copy.
    expect(sessionsNotCredits("how many session-credits a purchase grants")).toBe(
      "how many sessions a purchase grants"
    );
  });

  it("gives refund phrasing natural wording", () => {
    expect(sessionsNotCredits("Cancel before the session, credit refunded")).toBe(
      "Cancel before the session, session returned"
    );
  });

  it("never rewrites a credit card", () => {
    expect(sessionsNotCredits("No credit card required")).toBe("No credit card required");
    expect(sessionsNotCredits("we accept credit cards")).toBe("we accept credit cards");
  });

  it("leaves words that merely contain 'credit' alone", () => {
    expect(sessionsNotCredits("your account was credited")).toBe(
      "your account was credited"
    );
    expect(sessionsNotCredits("Keep your account credentials confidential")).toBe(
      "Keep your account credentials confidential"
    );
  });

  it("is a no-op on copy with no credit wording", () => {
    const s = "Buy a one-time pack of 1:1 sessions, no subscription.";
    expect(sessionsNotCredits(s)).toBe(s);
  });
});
