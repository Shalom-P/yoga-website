import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The authenticated user for this request, resolved at most once.
 *
 * `supabase.auth.getUser()` is a network round trip to the Supabase auth server,
 * not a cookie read — measured 330-850ms from a dev machine. A full page load
 * runs the guard twice, once in the route group's layout and once in the page,
 * and those two calls are sequential, so the second one is pure added latency
 * for an answer we already have. React's cache() memoises per request (not
 * across requests, so this is not a session cache), collapsing them into one.
 *
 * Client-side navigation between sibling routes re-renders only the page, so it
 * was already making a single call; this is the fix for full loads and reloads.
 * The middleware's own getUser() is a separate request-level concern and still
 * runs — it refreshes the cookie and does role routing before we get here.
 */
const getAuthedUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});

/**
 * The caller's profile row, resolved at most once per request. Same reasoning as
 * getAuthedUser: requireAdmin()/requireTeacher() run in both the layout and the
 * page, and the role cannot change mid-render.
 */
const getRole = cache(async (userId: string) => {
  const { supabase } = await getAuthedUser();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return data;
});

/** Get the current user or redirect to login. */
export async function requireUser(nextPath = "/dashboard") {
  const { supabase, user } = await getAuthedUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return { user, supabase };
}

/** Get the current admin user or bounce. */
export async function requireAdmin() {
  const { supabase, user } = await getAuthedUser();
  if (!user) redirect("/login?next=/admin");
  const profile = await getRole(user.id);
  if (profile?.role !== "admin") redirect("/");
  return { user, profile, supabase };
}

/** Get the current teacher user or bounce. Mirrors requireAdmin(). */
export async function requireTeacher(nextPath = "/teacher") {
  const { supabase, user } = await getAuthedUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  const profile = await getRole(user.id);
  if (profile?.role !== "teacher") redirect("/");
  return { user, profile, supabase };
}

// NOTE: there is deliberately no "getCurrentUser without redirect" helper here.
// Its one consumer was the (marketing) layout, where the cookies() call inside
// createSupabaseServerClient opted the whole route group into dynamic rendering
// and disabled ISR. Static pages that need auth-aware UI should resolve it
// client-side (see MarketingNav).
