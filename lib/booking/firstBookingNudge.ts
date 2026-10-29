/**
 * When the "book your first session" emails go out (migration 0048).
 *
 * A customer who finished onboarding and has no booking gets at most two
 * nudges, one ~1 hour and one ~24 hours after sign-up. Each stage only looks at
 * sign-ups inside a bounded window, so:
 *   - the first deploy does not email the whole back catalogue of old sign-ups,
 *   - someone who signed up 30 hours before the deploy gets only the 24h email,
 *     never both at once,
 *   - a cron outage of up to `maxAge - minAge` still catches everyone.
 *
 * Pure and dependency-free so it can be unit-tested.
 */

export type FirstBookingNudgeStage = "1h" | "24h";

const HOUR_MS = 60 * 60 * 1000;

export const FIRST_BOOKING_NUDGE_STAGES: ReadonlyArray<{
  stage: FirstBookingNudgeStage;
  /** Sign-up must be at least this old. */
  minAgeMs: number;
  /** ...and no older than this. */
  maxAgeMs: number;
}> = [
  { stage: "1h", minAgeMs: 1 * HOUR_MS, maxAgeMs: 12 * HOUR_MS },
  { stage: "24h", minAgeMs: 24 * HOUR_MS, maxAgeMs: 72 * HOUR_MS },
];

/**
 * The `profiles.created_at` range a stage covers at `now`, as ISO strings:
 * `from` is the oldest eligible sign-up (inclusive), `to` the newest (inclusive).
 */
export function nudgeSignupWindow(
  stage: FirstBookingNudgeStage,
  now: Date,
): { from: string; to: string } {
  const s = FIRST_BOOKING_NUDGE_STAGES.find((x) => x.stage === stage);
  if (!s) throw new Error(`unknown nudge stage: ${stage}`);
  return {
    from: new Date(now.getTime() - s.maxAgeMs).toISOString(),
    to: new Date(now.getTime() - s.minAgeMs).toISOString(),
  };
}
