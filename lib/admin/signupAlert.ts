/**
 * When the owner's "new sign-up" email goes out (migration 0049).
 *
 * The reminders cron sends one email per new customer account. It waits for
 * the profile to be complete (name, phone, experience level) so the email can
 * say who signed up and how to reach them, but no longer than an hour: someone
 * who stops halfway through onboarding is still worth knowing about, and is
 * reported as not having finished.
 *
 * Sign-ups older than `SIGNUP_ALERT_MAX_AGE_MS` are never alerted, so a profile
 * that somehow missed the 0049 backfill cannot trigger a late, confusing email.
 *
 * Pure and dependency-free so it can be unit-tested.
 */

import { isProfileComplete } from "@/lib/auth/redirects";

const HOUR_MS = 60 * 60 * 1000;

/** Who hears about new sign-ups. */
export const SIGNUP_ALERT_TO = "poshithsreddy@gmail.com";

/** Wait at most this long for onboarding before alerting anyway. */
export const SIGNUP_ALERT_ONBOARDING_GRACE_MS = 1 * HOUR_MS;

/** Never alert about a sign-up older than this. */
export const SIGNUP_ALERT_MAX_AGE_MS = 7 * 24 * HOUR_MS;

export type SignupAlertProfile = {
  full_name: string | null;
  phone: string | null;
  experience_level: string | null;
  created_at: string;
};

/** True when the alert for this profile should be sent at `now`. */
export function signupAlertDue(profile: SignupAlertProfile, now: Date): boolean {
  const age = now.getTime() - new Date(profile.created_at).getTime();
  if (!Number.isFinite(age) || age > SIGNUP_ALERT_MAX_AGE_MS) return false;
  return isProfileComplete(profile) || age >= SIGNUP_ALERT_ONBOARDING_GRACE_MS;
}
