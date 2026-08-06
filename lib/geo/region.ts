/**
 * Service-area gate + region/currency resolution.
 *
 * The studio serves customers physically in the **UAE and India** (teachers are
 * in India — see CLAUDE.md). Non-admin visitors located elsewhere are blocked
 * from buying session packs and from claiming the free 1:1 trial.
 *
 * Two responsibilities, kept together because both key off the same signal
 * (GeoIP country, with the live browser timezone as a fallback):
 *   1. the transaction gate (may this visitor buy / claim the trial?), and
 *   2. currency resolution (UAE → AED, India → INR).
 *
 * We prefer the edge GeoIP country (which a caller cannot forge) and only fall
 * back to the self-reported browser timezone when no GeoIP header is present
 * (local dev / self-hosted). This closes the "POST a fake timezone" bypass on
 * the purchase and free-trial routes AND prevents a UAE visitor being charged
 * INR (or vice versa) by spoofing.
 *
 * This module is pure and dependency-free on purpose so both client components
 * and Node route handlers can import it.
 */

export type Market = "IN" | "AE";
export type Currency = "INR" | "AED";

/** Countries whose customers may transact. */
export const SERVICE_COUNTRIES: readonly Market[] = ["IN", "AE"];

/** Shared error code returned by the gated API routes and matched client-side. */
export const OUTSIDE_SERVICE_AREA = "outside_service_area";

/** Default currency when the region can't be resolved (India is the larger market). */
export const DEFAULT_CURRENCY: Currency = "INR";

// Each market maps from its IANA zone ids. Browsers (Chrome/Safari/Edge, all
// ICU-based) report the LEGACY id "Asia/Calcutta" from
// Intl.DateTimeFormat().resolvedOptions().timeZone, never "Asia/Kolkata" —
// missing that alias silently locked every Indian customer out of booking.
const MARKET_BY_TIMEZONE: Record<string, Market> = {
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN", // legacy alias — what ICU browsers actually report
  "Asia/Dubai": "AE",
};
const CURRENCY_BY_MARKET: Record<Market, Currency> = { IN: "INR", AE: "AED" };
const LOCALE_BY_CURRENCY: Record<Currency, string> = { INR: "en-IN", AED: "en-AE" };

/** True when an ISO country code is one we serve. */
export function isServiceCountry(country: string | null | undefined): boolean {
  if (!country) return false;
  return (SERVICE_COUNTRIES as readonly string[]).includes(country.toUpperCase());
}

/** True when an IANA timezone id belongs to a market we serve. */
export function isServiceTimezone(tz: string | null | undefined): boolean {
  if (!tz) return false;
  return tz in MARKET_BY_TIMEZONE;
}

/**
 * The edge-provided ISO country for the request, if any. On Vercel this is the
 * `x-vercel-ip-country` header (a GeoIP lookup the client cannot forge). Returns
 * null off-platform (local dev, self-hosted), where we fall back to timezone.
 */
export function countryFromHeaders(headers: Headers): string | null {
  const c = headers.get("x-vercel-ip-country");
  return c ? c.trim().toUpperCase() : null;
}

/**
 * Client-side rule (no GeoIP available): admins always; everyone else must be in
 * a served timezone. Used by the slot picker for an early UX gate.
 */
export function canTransactFromTimezone({
  isAdmin,
  timezone,
}: {
  isAdmin: boolean;
  timezone: string | null | undefined;
}): boolean {
  return isAdmin || isServiceTimezone(timezone);
}

/**
 * Authoritative server-side gate. Prefers the edge GeoIP country (which a caller
 * cannot spoof by POSTing a fake timezone); only falls back to the self-reported
 * browser timezone when no GeoIP header is present (local/off-platform).
 */
export function canTransactFromRequest({
  isAdmin,
  country,
  timezone,
}: {
  isAdmin: boolean;
  country: string | null | undefined;
  timezone: string | null | undefined;
}): boolean {
  if (isAdmin) return true;
  // GeoIP present → it is the source of truth (ignore the client timezone).
  if (country) return isServiceCountry(country);
  // No GeoIP (local dev / non-Vercel host) → fall back to browser timezone.
  return isServiceTimezone(timezone);
}

/** Currency for a served ISO country, or null if not served. */
export function currencyForCountry(country: string | null | undefined): Currency | null {
  if (!isServiceCountry(country)) return null;
  return CURRENCY_BY_MARKET[country!.toUpperCase() as Market];
}

/** Currency for a served timezone, or null if not served. */
export function currencyForTimezone(tz: string | null | undefined): Currency | null {
  if (!tz) return null;
  const market = MARKET_BY_TIMEZONE[tz];
  return market ? CURRENCY_BY_MARKET[market] : null;
}

/** The `Intl` locale to format a currency with (en-IN groups in lakh/crore). */
export function localeForCurrency(currency: Currency): string {
  return LOCALE_BY_CURRENCY[currency] ?? "en";
}

export type ResolvedRegion = {
  country: Market | null;
  currency: Currency;
  locale: string;
};

/**
 * Resolve the billing context for a request. GeoIP country is the source of
 * truth; the browser/profile timezone is a fallback for local/off-platform.
 * Falls back to {@link DEFAULT_CURRENCY} so a pricing page always shows *a* price.
 */
export function resolveRegion({
  country,
  timezone,
}: {
  country?: string | null;
  timezone?: string | null;
}): ResolvedRegion {
  const currency = currencyForCountry(country) ?? currencyForTimezone(timezone) ?? DEFAULT_CURRENCY;
  const resolvedCountry = isServiceCountry(country) ? (country!.toUpperCase() as Market) : null;
  return { country: resolvedCountry, currency, locale: localeForCurrency(currency) };
}
