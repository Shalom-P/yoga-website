// Only same-origin relative paths are accepted as redirect targets.
// `new URL(arg, base)` ignores the base when arg is absolute, so an unvalidated
// `?next=https://evil.com` would otherwise become an open redirect. `//` and
// `/\` are protocol-relative escapes browsers also follow.
//
// The URL parser also strips tab/LF/CR before resolving, so `/\t/evil.com`
// becomes `//evil.com` in a Location header or `location.href`. So reject any
// control character or backslash outright, then confirm by actually parsing
// that the result stays on our origin, and return the normalised path.
const PROBE_ORIGIN = "https://safe-next.invalid";
export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F\\]/.test(raw)) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  try {
    const u = new URL(raw, PROBE_ORIGIN);
    if (u.origin !== PROBE_ORIGIN) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}

export function isOnboardingPath(path: string): boolean {
  return path === "/onboarding" || /^\/onboarding[/?#]/.test(path);
}

// Where an authenticated user should land, given their (sanitized) requested
// destination and whether they've completed onboarding. Single source of truth
// for the OAuth callback, the phone-OTP flow, and the middleware /login guard:
//   * not onboarded → the onboarding form, carrying the destination along
//   * onboarded     → the destination, except never back to the onboarding form
//                     (stale "?next=/onboarding" links from old CTAs/emails)
export function postAuthTarget(next: string, onboarded: boolean): string {
  if (!onboarded) {
    return next !== "/dashboard" && !isOnboardingPath(next)
      ? `/onboarding?next=${encodeURIComponent(next)}`
      : "/onboarding";
  }
  return isOnboardingPath(next) ? "/dashboard" : next;
}

// The fields a customer must have before they can use the signed-in area.
// Name and phone are how a teacher or the studio reaches them about a session;
// experience_level is only ever written by the onboarding form (web or native),
// so it marks that the form was actually submitted.
export type ProfileCompleteness = {
  full_name?: string | null;
  phone?: string | null;
  experience_level?: string | null;
};

export function isProfileComplete(profile: ProfileCompleteness | null | undefined): boolean {
  return Boolean(
    profile?.full_name?.trim() && profile.phone?.trim() && profile.experience_level
  );
}
