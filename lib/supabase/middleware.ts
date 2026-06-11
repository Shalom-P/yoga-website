import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { postAuthTarget, safeNext } from "@/lib/auth/redirects";
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
  const isAuthArea = path.startsWith("/dashboard") || path.startsWith("/admin");
  const isAdminArea = path.startsWith("/admin");

  if (isAuthArea && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return makeRedirect(url);
  }

  // Signed-in users have no business on /login: send them to their destination,
  // routing half-onboarded ones through /onboarding first. Living here (not in
  // the page) keeps /login statically prerenderable for the logged-out majority.
  if (path === "/login" && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("experience_level")
      .eq("id", user.id)
      .maybeSingle();
    const next = safeNext(req.nextUrl.searchParams.get("next"));
    return makeRedirect(
      new URL(postAuthTarget(next, Boolean(profile?.experience_level)), req.url)
    );
  }

  if (isAdminArea && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      return makeRedirect(new URL("/", req.url));
    }
  }

  return res;
}
