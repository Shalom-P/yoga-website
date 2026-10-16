// `/login?error=` carries a CODE, never display text. LoginForm renders the
// result inside a trusted role="alert" banner, so anything taken verbatim from
// the URL would let an attacker put their own words ("account locked, call
// +91...") on our real domain. Unknown or legacy values map to generic copy.
// Pure: imported by the callback route, the native bridge and LoginForm.

export type LoginErrorCode = "apple_no_email" | "signin_incomplete" | "link_invalid";

const COPY: Record<LoginErrorCode, string> = {
  apple_no_email:
    "That Apple ID has no email address attached, so we can't finish signing you in. Please continue with Google or email instead.",
  signin_incomplete: "Sign-in didn't finish. Please try again, or continue with Google or email.",
  link_invalid: "That sign-in link is invalid or has expired. Please request a new one.",
};

export function loginErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return (COPY as Record<string, string>)[code] ?? COPY.signin_incomplete;
}

/** Pick a code from provider/GoTrue text without ever forwarding the text. */
export function loginErrorCodeFrom(description: string | null | undefined): LoginErrorCode {
  const d = (description ?? "").toLowerCase();
  if (/email/.test(d) && /apple|provider|missing|no email/.test(d)) return "apple_no_email";
  if (/expired|invalid|token|otp/.test(d)) return "link_invalid";
  return "signin_incomplete";
}

export function loginErrorPath(code: LoginErrorCode): string {
  return `/login?error=${code}`;
}
