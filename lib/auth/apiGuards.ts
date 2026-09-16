// Auth gates for /api/* route handlers.
//
// Middleware does NOT run on /api/* (see the matcher in middleware.ts), so a
// route handler that skips this is a full authorization bypass, not a cosmetic
// omission. Kept separate from lib/auth/guards.ts because that module's guards
// call next/navigation redirect(), which answers an API client with a 307 to
// HTML instead of 401/403 JSON.

import "server-only";

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminApiContext = { userId: string };

/**
 * Admin gate for route handlers. Authenticates the caller and re-reads
 * profiles.role on the COOKIE-BOUND (RLS) client, so the role comes from the
 * database rather than from anything the caller sent.
 *
 * It deliberately does NOT construct the service-role client. Each route does
 * that itself, AFTER this gate. That ordering is the authorization boundary and
 * it should stay visible at every call site:
 *
 *   const gate = await requireAdminApi();
 *   if (gate instanceof NextResponse) return gate;
 *   const svc = createSupabaseServiceClient();   // gate.userId is a confirmed admin
 *
 * Returns the context on success, or the NextResponse to return as-is
 * (401 `unauthenticated` / 403 `forbidden`, both mapped by friendlyAdminError).
 */
export async function requireAdminApi(): Promise<AdminApiContext | NextResponse> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return { userId: user.id };
}
