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
  if (isRateLimit(m)) return "Too many attempts — please wait a minute and try again.";
  if (m.includes("expired") || m.includes("invalid") || m.includes("token")) {
    return "That code looks invalid or has expired — request a new one.";
  }
  return "Something went wrong — please try again.";
}

/** For authenticated DB writes (onboarding, profile). */
export function friendlyFormError(message?: string | null): string {
  const m = (message ?? "").toLowerCase();
  if (isRateLimit(m)) return "Too many attempts — please wait a minute and try again.";
  return "Couldn't save your details just now — please try again.";
}
