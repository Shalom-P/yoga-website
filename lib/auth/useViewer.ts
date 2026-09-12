"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/supabase/types";

/**
 * Who is looking at a public page, resolved entirely in the browser.
 *
 * The (marketing) group is static/ISR, and a single `cookies()` read in a
 * server component opts the whole group out of it with no build error (PR #63).
 * So anything on a marketing page that needs to know about the signed-in user
 * has to ask the browser Supabase client instead of the server.
 *
 * Display only. Every real gate is middleware plus the server guards in
 * `lib/auth/guards.ts`; a tampered client here just shows someone a link they
 * will be redirected away from.
 */

export type Viewer = {
  /**
   * `null` until the local session cookie has been read. The nav treats that
   * as signed out (the common case, and the CTA must not wait on it), but a
   * surface that would rather show a placeholder can tell the two apart.
   */
  signedIn: boolean | null;
  email: string;
  /** Display name, falling back to the email local-part. */
  name: string;
  /**
   * Assumed `customer` until the profiles row lands, which is the right guess
   * for almost every visitor and only changes which links the menu offers.
   */
  role: UserRole;
};

const LOADING: Viewer = { signedIn: null, email: "", name: "", role: "customer" };
const SIGNED_OUT: Viewer = { signedIn: false, email: "", name: "", role: "customer" };

/* NEXT_PUBLIC_* is inlined at build time, so this is a constant, and starting
   from the right value keeps the effect free of a synchronous setState. With
   no Supabase configured the marketing site still renders, signed out, which
   is the zero-env preview story. */
const CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/**
 * The role is not a JWT claim, so it costs a PostgREST read. Cache the promise
 * per user id: the nav and the sticky CTA both mount this hook, and the nav
 * survives client-side navigation between marketing pages, so an uncached
 * lookup would repeat on every mount for one value that cannot change.
 */
const roleCache = new Map<string, Promise<UserRole>>();

function fetchRole(userId: string): Promise<UserRole> {
  const cached = roleCache.get(userId);
  if (cached) return cached;
  // Promise.resolve() because a PostgrestBuilder is only a PromiseLike: it has
  // no .catch(), so a thrown network error would escape unhandled.
  const pending = Promise.resolve(
    createSupabaseBrowserClient().from("profiles").select("role").eq("id", userId).maybeSingle(),
  )
    // A read that fails must not strand the menu: fall back to the customer
    // links, which middleware redirects if the guess was wrong. PostgREST
    // reports a rejected row in `error` with data null, so the ?? covers the
    // RLS/401 case and the .catch only the request never landing at all.
    .then(({ data }) => (data?.role ?? "customer") as UserRole)
    .catch(() => "customer" as UserRole);
  roleCache.set(userId, pending);
  return pending;
}

export function useViewer(): Viewer {
  const [viewer, setViewer] = useState<Viewer>(CONFIGURED ? LOADING : SIGNED_OUT);

  useEffect(() => {
    if (!CONFIGURED) return;

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    const apply = (user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | undefined) => {
      if (cancelled) return;
      if (!user) {
        setViewer(SIGNED_OUT);
        return;
      }
      const email = user.email ?? "";
      const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
      const name = fullName || email.split("@")[0] || "Member";
      setViewer({ signedIn: true, email, name, role: "customer" });
      fetchRole(user.id).then((role) => {
        // Ignore a role that arrives after a sign-out or a switch of account.
        if (!cancelled) setViewer((v) => (v.signedIn && v.email === email ? { ...v, role } : v));
      });
    };

    // getSession() reads the local auth cookie, no network round trip.
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user));
    // The nav stays mounted across marketing navigations, so also follow
    // sign-in/sign-out that happens after mount (including in another tab).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user));

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return viewer;
}

export type ViewerDestination = { href: string; label: string };

/**
 * Primary call to action for a signed-in visitor.
 *
 * Only teachers differ: middleware bounces them off /dashboard, so pointing
 * them at the booking flow would be a redirect to somewhere they did not ask
 * for. Admins keep "Book a session" because they are customers too, and reach
 * the console from the menu.
 */
export function viewerPrimaryCta(role: UserRole): ViewerDestination {
  return role === "teacher"
    ? { href: "/teacher/sessions", label: "My schedule" }
    : { href: "/dashboard/book", label: "Book a session" };
}

/** The rows of the account menu, in order, for this role. */
export function viewerDestinations(role: UserRole): ViewerDestination[] {
  if (role === "teacher") {
    // Labels copied from TeacherSidebar so the same destination is not called
    // two different things depending on which surface you came from.
    return [
      { href: "/teacher", label: "Overview" },
      { href: "/teacher/sessions", label: "My schedule" },
      { href: "/teacher/documents", label: "Student documents" },
      { href: "/teacher/availability", label: "My availability" },
      { href: "/teacher/profile", label: "My profile" },
    ];
  }
  const member: ViewerDestination[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/bookings", label: "My bookings" },
    { href: "/dashboard/plan", label: "My sessions" },
    { href: "/dashboard/documents", label: "Health documents" },
    { href: "/dashboard/profile", label: "Profile" },
  ];
  // An admin is also a customer here: they can book and hold credits, so they
  // get the member rows plus a way into the console.
  return role === "admin" ? [{ href: "/admin", label: "Admin console" }, ...member] : member;
}
