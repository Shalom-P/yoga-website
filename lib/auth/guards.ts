import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Get the current user or redirect to login. */
export async function requireUser(nextPath = "/dashboard") {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return { user, supabase };
}

/** Get the current admin user or bounce. */
export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/");
  return { user, profile, supabase };
}

/** Get the current teacher user or bounce. Mirrors requireAdmin(). */
export async function requireTeacher(nextPath = "/teacher") {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "teacher") redirect("/");
  return { user, profile, supabase };
}

// NOTE: there is deliberately no "getCurrentUser without redirect" helper here.
// Its one consumer was the (marketing) layout, where the cookies() call inside
// createSupabaseServerClient opted the whole route group into dynamic rendering
// and disabled ISR. Static pages that need auth-aware UI should resolve it
// client-side (see MarketingNav).
