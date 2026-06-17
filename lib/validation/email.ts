// One shared client-side email shape check so login and newsletter agree on
// what "looks like an email" (the server / Supabase always re-validates). This
// is a convenience gate, not authoritative validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  return EMAIL_RE.test(value.trim());
}
