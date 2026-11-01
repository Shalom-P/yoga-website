import { describe, expect, it } from "vitest";
import { isSessionCancellable, isSessionInProgress, isSessionUpcoming } from "./sessionWindow";

const session = { start_at: "2026-11-01T13:30:00Z", end_at: "2026-11-01T14:30:00Z" };
const at = (iso: string) => new Date(iso).getTime();

describe("session window", () => {
  it("before the start: upcoming and cancellable", () => {
    const now = at("2026-11-01T13:29:00Z");
    expect(isSessionUpcoming(session, now)).toBe(true);
    expect(isSessionInProgress(session, now)).toBe(false);
    expect(isSessionCancellable(session, now)).toBe(true);
  });

  it("a class in progress stays upcoming but can no longer be cancelled", () => {
    for (const iso of ["2026-11-01T13:30:00Z", "2026-11-01T13:31:00Z", "2026-11-01T14:29:59Z"]) {
      const now = at(iso);
      expect(isSessionUpcoming(session, now)).toBe(true);
      expect(isSessionInProgress(session, now)).toBe(true);
      expect(isSessionCancellable(session, now)).toBe(false);
    }
  });

  it("from the end: past", () => {
    const now = at("2026-11-01T14:30:00Z");
    expect(isSessionUpcoming(session, now)).toBe(false);
    expect(isSessionInProgress(session, now)).toBe(false);
    expect(isSessionCancellable(session, now)).toBe(false);
  });
});
