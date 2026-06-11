import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { postAuthTarget, safeNext } from "@/lib/auth/redirects";

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
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Users with NULL experience_level haven't finished onboarding — route
      // them there (carrying ?next=); onboarded users go to their destination.
      const { data: profile } = await supabase
        .from("profiles")
        .select("experience_level")
        .eq("id", user.id)
        .maybeSingle();
      return NextResponse.redirect(
        new URL(postAuthTarget(next, Boolean(profile?.experience_level)), url.origin)
      );
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
