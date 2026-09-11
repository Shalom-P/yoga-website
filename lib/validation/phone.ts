import {
  isValidPhoneNumber,
  parsePhoneNumber,
  type CountryCode,
} from "libphonenumber-js";

// Customers are welcome from any country, so <PhoneField> offers every calling
// code rather than an allow-list. There is deliberately no default country: for
// a worldwide audience any pre-selection is wrong for most people, and seeding a
// calling code would also satisfy a native `required` check before a single
// digit is typed. Callers that know better can pass `defaultCountry`.

// One shared message so login, booking, and profile all say the same thing.
export const PHONE_ERROR_MESSAGE =
  "Enter a valid mobile number including your country code, for example +971 50 123 4567.";

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
