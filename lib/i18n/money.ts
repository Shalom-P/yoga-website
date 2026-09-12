// Currency formatting. Which currency a customer is billed in is decided by
// lib/geo/region.ts; historical rows may still be AUD from the pre-2026 market.
// `Intl` handles each currency's symbol and grouping (en-IN groups in lakh/crore).
const LOCALE_BY_CURRENCY: Record<string, string> = {
  INR: "en-IN",
  AED: "en-AE",
  USD: "en-US",
  GBP: "en-GB",
  EUR: "en-IE",
  AUD: "en-AU",
};

/**
 * Format integer minor units (paise/fils/cents) as a localized currency string.
 * Whole units by default; pass `{ withCents: true }` to show the fraction.
 */
export function formatMoney(
  cents: number,
  currency: string,
  opts: { withCents?: boolean } = {},
) {
  const locale = LOCALE_BY_CURRENCY[currency] ?? "en";
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    ...(opts.withCents
      ? { minimumFractionDigits: 2 }
      : { maximumFractionDigits: 0 }),
  });
  return formatter.format(cents / 100);
}
