import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOnboardingPath, postAuthTarget, safeNext } from "@/lib/auth/redirects";

// Two ways a session can be established here:
//   * OAuth / PKCE          → ?code=...                  (Google, and the PKCE
//                             magic link variant)
//   * Email magic-link click → ?token_hash=...&type=...  (what Supabase emails
//                             when the Magic Link template renders a link rather
//                             than a {{ .Token }} 6-digit code)
// The inline 6-digit code is verified client-side in LoginForm; this route is
// the fallback for users who click the link in the email instead.
const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "magiclink",
  "signup",
  "invite",
  "recovery",
  "email_change",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = url.searchParams.get("type");
  const next = safeNext(url.searchParams.get("next"));

  const hasMagicLink =
    tokenHash && typeParam && EMAIL_OTP_TYPES.has(typeParam as EmailOtpType);

  // The provider can bounce us here with ?error=... instead of a code. Without
  // this branch the request falls through to the redirect at the bottom and the
  // user is silently sent to `next`, where the middleware bounces them to /login
  // with no explanation at all.
  //
  // The most common cause is a phone-number-only Apple ID (common in IN/CN): it
  // has no email address, so with Supabase's "Allow users without an email"
  // switched off GoTrue refuses to create the account. Retrying can never work,
  // so the copy has to send them to a different method rather than say "try
  // again".
  //
  // `error_description` is provider-controlled text and LoginForm renders
  // ?error= inside a trusted role="alert" banner, so it is NEVER forwarded
  // verbatim. It is only pattern-matched here to pick one of our own strings.
  const providerError = url.searchParams.get("error");
  if (providerError && !code && !hasMagicLink) {
    const description = url.searchParams.get("error_description") ?? "";
    const missingEmail = /email/i.test(description);
    const message = missingEmail
      ? "That Apple ID has no email address attached, so we can't finish signing you in. Please continue with Google or email instead."
      : "Sign-in didn't finish. Please try again, or continue with Google or email.";
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, url.origin),
    );
  }

  if (code || hasMagicLink) {
    const supabase = await createSupabaseServerClient();

    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          type: typeParam as EmailOtpType,
          token_hash: tokenHash as string,
        });

    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Teachers skip the customer onboarding form (they have no experience_level
      // and don't book) — land them in their own area. Otherwise: users with NULL
      // experience_level haven't finished onboarding, so route them there (carrying
      // ?next=); onboarded customers go straight to their destination.
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, experience_level")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role === "teacher") {
        const target = next === "/dashboard" || isOnboardingPath(next) ? "/teacher" : next;
        return NextResponse.redirect(new URL(target, url.origin));
      }
      return NextResponse.redirect(
        new URL(postAuthTarget(next, Boolean(profile?.experience_level)), url.origin)
      );
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
