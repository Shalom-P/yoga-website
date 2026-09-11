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

/** A market with a currency of its own. Not an allow-list: see the note above. */
export type Market = "IN" | "AE";
export type Currency = "INR" | "AED";

/** Currency used when the request resolves to no specific market. */
export const DEFAULT_CURRENCY: Currency = "INR";

// Each market maps from its IANA zone ids. Browsers (Chrome/Safari/Edge, all
// ICU-based) report the LEGACY id "Asia/Calcutta" from
// Intl.DateTimeFormat().resolvedOptions().timeZone, never "Asia/Kolkata" —
// missing that alias silently billed every Indian customer in the fallback
// currency instead of their own.
const MARKET_BY_TIMEZONE: Record<string, Market> = {
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN", // legacy alias — what ICU browsers actually report
  "Asia/Dubai": "AE",
};
const CURRENCY_BY_MARKET: Record<Market, Currency> = { IN: "INR", AE: "AED" };
const LOCALE_BY_CURRENCY: Record<Currency, string> = { INR: "en-IN", AED: "en-AE" };

/**
 * True when an ISO country code has a currency of its own. This is a *billing*
 * question only. It is not a permission check and must never be used as one.
 */
export function isBillingMarket(country: string | null | undefined): country is Market {
  if (!country) return false;
  return country.toUpperCase() in CURRENCY_BY_MARKET;
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

/** Currency for an ISO country, or null when it is not a market of its own. */
export function currencyForCountry(country: string | null | undefined): Currency | null {
  if (!isBillingMarket(country)) return null;
  return CURRENCY_BY_MARKET[country.toUpperCase() as Market];
}

/** Currency for an IANA timezone, or null when it is not a market of its own. */
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
 * Always resolves to a currency, so a pricing page shows a price everywhere.
 */
export function resolveRegion({
  country,
  timezone,
}: {
  country?: string | null;
  timezone?: string | null;
}): ResolvedRegion {
  // When GeoIP is present it decides outright, INCLUDING when the country has no
  // currency of its own. Falling through to the timezone here would let any
  // visitor pick their own billing currency by changing their clock, which is
  // the spoof the old service-area gate used to make unreachable.
  const currency = country
    ? currencyForCountry(country) ?? DEFAULT_CURRENCY
    : currencyForTimezone(timezone) ?? DEFAULT_CURRENCY;
  const resolvedCountry = isBillingMarket(country) ? (country.toUpperCase() as Market) : null;
  return { country: resolvedCountry, currency, locale: localeForCurrency(currency) };
}
