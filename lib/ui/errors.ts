// Map raw Supabase/Postgres error strings to human-friendly UI copy so backend
// phrasing (auth rate limits, RLS policy text, PG error codes) never reaches a
// toast. Pattern-match the few cases worth special-casing; everything else gets a
// safe generic message.

function isRateLimit(m: string): boolean {
  return m.includes("rate limit") || m.includes("too many") || m.includes("429");
}

/** For the login / email-OTP flow. */
export function friendlyAuthError(message?: string | null): string {
  const m = (message ?? "").toLowerCase();
  if (isRateLimit(m)) return "Too many attempts. Please wait a minute and try again.";
  // GoTrue answers 500 `unexpected_failure` / "Error sending confirmation email"
  // when the mailer itself fails: custom SMTP unset, so the built-in sender is
  // in play and refuses any address outside the Supabase org. Distinct copy
  // because the user has done nothing wrong and retrying will not help them.
  if (m.includes("error sending")) {
    return "We couldn't send that code. Please try another sign-in option, or contact hello@myyogaclasses.fit.";
  }
  if (m.includes("expired") || m.includes("invalid") || m.includes("token")) {
    return "That code looks invalid or has expired. Please request a new one.";
  }
  return "Something went wrong. Please try again.";
}

/** For authenticated DB writes (onboarding, profile). */
export function friendlyFormError(message?: string | null): string {
  const m = (message ?? "").toLowerCase();
  if (isRateLimit(m)) return "Too many attempts. Please wait a minute and try again.";
  return "Couldn't save your details just now. Please try again.";
}
