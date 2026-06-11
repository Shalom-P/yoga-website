// Only same-origin relative paths are accepted as redirect targets.
// `new URL(arg, base)` ignores the base when arg is absolute, so an unvalidated
// `?next=https://evil.com` would otherwise become an open redirect. `//` and
// `/\` are protocol-relative escapes browsers also follow.
export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  return raw;
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
