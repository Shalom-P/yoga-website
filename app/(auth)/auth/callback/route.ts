import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Only same-origin relative paths are accepted as redirect targets.
// `new URL(arg, base)` ignores the base when arg is absolute, so an unvalidated
// `?next=https://evil.com` would otherwise become an open redirect.
function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/dashboard";
  }
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
    }
    // Check whether onboarding is complete. If experience_level is NULL the user
    // hasn't finished onboarding yet — redirect there instead of straight to the
    // dashboard. Preserve an explicit ?next= so we can bounce them on to their
    // original destination after onboarding finishes.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("experience_level")
        .eq("id", user.id)
        .single();
      if (!profile?.experience_level) {
        const onboardingNext = next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : "";
        return NextResponse.redirect(new URL(`/onboarding${onboardingNext}`, url.origin));
      }
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
