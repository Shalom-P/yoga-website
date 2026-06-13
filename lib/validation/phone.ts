import {
  isValidPhoneNumber,
  parsePhoneNumber,
  type CountryCode,
} from "libphonenumber-js";

// Numbers we issue/accept: +61 AU customers and +91 IN teachers. Used to scope
// the country dropdown in <PhoneField> and to default new entries to Australia.
export const PHONE_COUNTRIES: CountryCode[] = ["AU", "IN"];
export const DEFAULT_PHONE_COUNTRY: CountryCode = "AU";

// One shared message so login, booking, and profile all say the same thing.
export const PHONE_ERROR_MESSAGE =
  "Enter a valid mobile number with country code, e.g. +61 4XX XXX XXX.";

/**
 * True when `value` is a valid phone number. Accepts E.164 ("+61402281827") or a
 * formatted string ("+61 402 281 827"); pass `country` to validate a national
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
 * Normalize any accepted input to canonical E.164 ("+61402281827"), or null if
 * it isn't a valid number. Run this on every write so stored numbers have one
 * shape — SMS reminders and Supabase phone-OTP both key off the exact string.
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
