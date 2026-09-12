/**
 * Region and currency resolution.
 *
 * **The studio is open to customers anywhere.** This module used to double as a
 * service-area gate that blocked non-admin visitors outside the UAE and India
 * from buying session packs and from claiming the free 1:1. That gate has been
 * removed. What remains is the billing half: deciding which currency to charge.
 *
 * Two markets have a currency of their own (UAE → AED, India → INR); everywhere
 * else falls back to {@link DEFAULT_CURRENCY}. GeoIP country is still preferred
 * over the self-reported browser timezone, and that preference still matters
 * even without a gate: it decides what a customer is *charged*, so a caller must
 * not be able to pick their own currency by POSTing a timezone.
 *
 * Removing the gate does not by itself make payment work everywhere. Razorpay
 * settles INR on an Indian account, and International/AED acceptance is an
 * account-level setting. A customer outside India can now reach Checkout and may
 * still be declined by the provider until that is enabled. That is configuration,
 * not code.
 *
 * This module is pure and dependency-free on purpose so both client components
 * and Node route handlers can import it.
 */

/**
 * Every currency the platform knows how to price in.
 *
 * Listing one here does NOT make it sellable. A currency only goes live once
 * every active plan has a `plan_prices` row for it — see `pricedCurrencies()`
 * in lib/razorpay/catalog.ts. Until then resolution falls back to
 * {@link DEFAULT_CURRENCY}, so adding an entry to this file is inert and safe:
 * the switch is pricing the packs in /admin/plans, not deploying code.
 */
export const SUPPORTED_CURRENCIES = ["INR", "AED", "USD", "GBP", "EUR"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/** ISO country codes that have a currency of their own here. */
export type Market =
  | "IN"
  | "AE"
  | "US"
  | "GB"
  | (typeof EUROZONE)[number];

/**
 * Currency used when nothing more specific applies, and the safety net when a
 * better-matched currency has no prices yet. INR because it is the one currency
 * the packs are always priced in (`plans.price_base_cents` is INR-denominated).
 */
export const DEFAULT_CURRENCY: Currency = "INR";

/**
 * What an unmatched country gets *once it is priced*. Kept separate from
 * DEFAULT_CURRENCY: this is the intent ("bill the rest of the world in USD"),
 * DEFAULT_CURRENCY is the fallback that keeps the sale possible meanwhile.
 */
export const INTERNATIONAL_CURRENCY: Currency = "USD";

/** Euro-area members, so a single EUR price covers all of them. */
const EUROZONE = [
  "AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
] as const;

const CURRENCY_BY_COUNTRY: Record<string, Currency> = {
  IN: "INR",
  AE: "AED",
  US: "USD",
  GB: "GBP",
  ...Object.fromEntries(EUROZONE.map((c) => [c, "EUR" as Currency])),
};

// Timezone is only ever a fallback for when the edge gave us no GeoIP country
// (local dev, off-platform). Browsers (Chrome/Safari/Edge, all ICU-based) report
// the LEGACY id "Asia/Calcutta" from
// Intl.DateTimeFormat().resolvedOptions().timeZone, never "Asia/Kolkata" —
// missing that alias silently billed every Indian customer in the fallback
// currency instead of their own. Only zones that map unambiguously to one
// currency are listed; anything else falls through to the default.
const CURRENCY_BY_TIMEZONE: Record<string, Currency> = {
  "Asia/Kolkata": "INR",
  "Asia/Calcutta": "INR", // legacy alias — what ICU browsers actually report
  "Asia/Dubai": "AED",
  "Europe/London": "GBP",
  "Europe/Dublin": "EUR",
  "Europe/Paris": "EUR",
  "Europe/Berlin": "EUR",
  "Europe/Madrid": "EUR",
  "Europe/Rome": "EUR",
  "Europe/Amsterdam": "EUR",
  "Europe/Brussels": "EUR",
  "Europe/Vienna": "EUR",
  "Europe/Lisbon": "EUR",
  "Europe/Athens": "EUR",
  "Europe/Helsinki": "EUR",
  "America/New_York": "USD",
  "America/Chicago": "USD",
  "America/Denver": "USD",
  "America/Phoenix": "USD",
  "America/Los_Angeles": "USD",
  "America/Anchorage": "USD",
  "Pacific/Honolulu": "USD",
};

const LOCALE_BY_CURRENCY: Record<Currency, string> = {
  INR: "en-IN",
  AED: "en-AE",
  USD: "en-US",
  GBP: "en-GB",
  EUR: "en-IE",
};

/**
 * True when an ISO country code has a currency of its own. This is a *billing*
 * question only. It is not a permission check and must never be used as one.
 */
export function isBillingMarket(country: string | null | undefined): country is Market {
  if (!country) return false;
  return country.toUpperCase() in CURRENCY_BY_COUNTRY;
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

/** Currency for an ISO country, or null when it has no currency of its own. */
export function currencyForCountry(country: string | null | undefined): Currency | null {
  if (!country) return null;
  return CURRENCY_BY_COUNTRY[country.toUpperCase()] ?? null;
}

/** Currency for an IANA timezone, or null when the zone maps to no one currency. */
export function currencyForTimezone(tz: string | null | undefined): Currency | null {
  if (!tz) return null;
  return CURRENCY_BY_TIMEZONE[tz] ?? null;
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
 * Always resolves to a currency, so a pricing page shows a price everywhere.
 *
 * This returns the currency we would LIKE to bill in. It is not a promise that
 * the packs are priced in it — callers that take money must pass the result
 * through `effectiveCurrency()` (lib/razorpay/catalog.ts), which downgrades to
 * DEFAULT_CURRENCY when a currency has no prices yet.
 */
export function resolveRegion({
  country,
  timezone,
}: {
  country?: string | null;
  timezone?: string | null;
}): ResolvedRegion {
  // When GeoIP is present it decides outright, INCLUDING when the country has no
  // currency of its own (it gets the international currency, not the timezone's).
  // Falling through to the timezone here would let any visitor pick their own
  // billing currency by changing their clock, which is the spoof the old
  // service-area gate used to make unreachable.
  const currency = country
    ? currencyForCountry(country) ?? INTERNATIONAL_CURRENCY
    : currencyForTimezone(timezone) ?? INTERNATIONAL_CURRENCY;
  const resolvedCountry = isBillingMarket(country) ? (country.toUpperCase() as Market) : null;
  return { country: resolvedCountry, currency, locale: localeForCurrency(currency) };
}
