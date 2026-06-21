import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isOnboardingPath, postAuthTarget, safeNext } from "@/lib/auth/redirects";
import type { Database } from "@/lib/supabase/types";

export async function updateSession(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  // No-op if Supabase isn't wired up yet — lets the marketing site render in dev/preview.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return res;
  }

  // Cookies the auth refresh wrote during this middleware pass. They live on `res`,
  // but redirect responses are fresh objects, so we re-apply them to any redirect.
  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          toSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
            pendingCookies.push({ name, value, options });
          });
        },
      },
    }
  );

  const makeRedirect = (url: URL | string) => {
    const redirect = NextResponse.redirect(url);
    pendingCookies.forEach(({ name, value, options }) =>
      redirect.cookies.set(name, value, options)
    );
    return redirect;
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const isAdminArea = path.startsWith("/admin");
  const isTeacherArea = path.startsWith("/teacher");
  const isDashboardArea = path.startsWith("/dashboard");
  const isAuthArea = isDashboardArea || isAdminArea || isTeacherArea;

  if (isAuthArea && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return makeRedirect(url);
  }

  // Where a teacher should land when they hit a default destination (no useful
  // ?next=). Their home is /teacher, not the customer /dashboard or /onboarding.
  const teacherTarget = (next: string) =>
    next === "/dashboard" || isOnboardingPath(next) ? "/teacher" : next;

  // Signed-in users have no business on /login: send them to their destination,
  // routing half-onboarded customers through /onboarding first and teachers to
  // their own area. Living here (not in the page) keeps /login statically
  // prerenderable for the logged-out majority.
  if (path === "/login" && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, experience_level")
      .eq("id", user.id)
      .maybeSingle();
    const next = safeNext(req.nextUrl.searchParams.get("next"));
    if (profile?.role === "teacher") {
      return makeRedirect(new URL(teacherTarget(next), req.url));
    }
    return makeRedirect(
      new URL(postAuthTarget(next, Boolean(profile?.experience_level)), req.url)
    );
  }

  if ((isAdminArea || isTeacherArea || isDashboardArea) && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = profile?.role;
    if (isAdminArea && role !== "admin") {
      return makeRedirect(new URL(role === "teacher" ? "/teacher" : "/", req.url));
    }
    if (isTeacherArea && role !== "teacher") {
      // Admins manage teachers from /admin; everyone else is a customer.
      return makeRedirect(new URL(role === "admin" ? "/admin" : "/dashboard", req.url));
    }
    if (isDashboardArea && role === "teacher") {
      // The customer dashboard isn't a teacher's home — keep them out of the
      // booking flow and on their own surface.
      return makeRedirect(new URL("/teacher", req.url));
    }
  }

  return res;
}
