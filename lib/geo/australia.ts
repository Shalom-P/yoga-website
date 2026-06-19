/**
 * Australia-only transaction gate.
 *
 * The studio serves customers physically in Australia (AU customers, IN
 * teachers — see CLAUDE.md). Non-admin visitors located elsewhere are blocked
 * from buying session packs and from claiming the free 1:1 trial.
 *
 * We key the check off the visitor's *live browser timezone*, not
 * `profiles.timezone`: the onboarding form clamps the stored value to the AU
 * list (defaulting to Sydney), so it always looks Australian and can't tell us
 * where the user actually is. The browser TZ reflects their current location.
 *
 * This module is pure and dependency-free on purpose so both client components
 * and Node route handlers can import it.
 */

/** Shared error code returned by the gated API routes and matched client-side. */
export const OUTSIDE_AUSTRALIA_ERROR = "outside_australia";

/**
 * True when an IANA timezone id sits inside Australia. Uses the `Australia/`
 * prefix so it covers every Australian zone (Sydney, Perth, Adelaide,
 * Lord_Howe, Eucla, Broken_Hill, …), not just the seven in `AU_TIMEZONES`.
 */
export function isAustralianTimezone(tz: string | null | undefined): boolean {
  if (!tz) return false;
  return tz.startsWith("Australia/");
}

/**
 * Central rule: may this visitor make a purchase / claim the free trial?
 * Admins are always allowed (they may operate from anywhere). Everyone else
 * must be in an Australian timezone.
 */
export function canTransactFromTimezone({
  isAdmin,
  timezone,
}: {
  isAdmin: boolean;
  timezone: string | null | undefined;
}): boolean {
  return isAdmin || isAustralianTimezone(timezone);
}
