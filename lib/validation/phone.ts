import {
  getExampleNumber,
  isSupportedCountry,
  isValidPhoneNumber,
  parsePhoneNumber,
  type CountryCode,
} from "libphonenumber-js";
import mobileExamples from "libphonenumber-js/mobile/examples";

// Customers are welcome from any country, so <PhoneField> offers every calling
// code rather than an allow-list, and pre-selects the visitor's own country
// (edge GeoIP, through toPhoneCountry). Leaving it blank is not neutral: with no
// country selected, react-phone-number-input puts a "+" in front of whatever is
// typed, so a 10-digit Indian mobile typed the usual way ("98765 43210") reads
// as +98, an Iranian number, and is rejected. For a Google sign-in the phone is
// the only onboarding field the customer has to fill in themselves.

/**
 * The country to pre-select in <PhoneField>, from an ISO code such as the edge
 * GeoIP country (`countryFromHeaders`). Undefined when there is none, or when
 * libphonenumber has no numbering plan for it, so the field falls back to no
 * pre-selection rather than being handed a country it can't format.
 */
export function toPhoneCountry(code: string | null | undefined): CountryCode | undefined {
  const c = code?.trim().toUpperCase();
  return c && isSupportedCountry(c) ? c : undefined;
}

/**
 * Toast for a number that doesn't validate. One shared message so onboarding and
 * profile say the same thing. With the visitor's country it gives an example in
 * that country's own format ("+91 81234 56789"); with none it points at the flag
 * menu, which is the actual fix for a number the field has prefixed with "+".
 */
export function phoneErrorMessage(country?: CountryCode): string {
  const example = country && getExampleNumber(country, mobileExamples)?.formatInternational();
  return example
    ? `Enter a valid mobile number, for example ${example}.`
    : "Enter a valid mobile number. Pick your country from the flag menu, then type the number.";
}

/**
 * True when `value` is a valid phone number. Accepts E.164 ("+971501234567") or a
 * formatted string ("+971 50 123 4567"); pass `country` to validate a national
 * number typed without a leading "+". Never throws (libphonenumber can on junk).
 */
export function isValidPhone(
  value: string | null | undefined,
  country?: CountryCode,
): boolean {
  if (!value?.trim()) return false;
  try {
    return country ? isValidPhoneNumber(value, country) : isValidPhoneNumber(value);
  } catch {
    return false;
  }
}

/**
 * Normalize any accepted input to canonical E.164 ("+971501234567"), or null if
 * it isn't a valid number. Run this on every write so the stored number has one
 * canonical shape. Phone is a required contact field (collected during sign-up)
 * but is never an auth factor — login is email OTP / OAuth, not SMS — so this is
 * purely about storing a consistent, reachable value.
 */
export function toE164(
  value: string | null | undefined,
  country?: CountryCode,
): string | null {
  if (!value?.trim()) return null;
  try {
    const parsed = country ? parsePhoneNumber(value, country) : parsePhoneNumber(value);
    return parsed?.isValid() ? parsed.number : null;
  } catch {
    return null;
  }
}
