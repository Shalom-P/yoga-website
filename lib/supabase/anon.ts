import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Cookie-free, anon-key client for PUBLIC data reads (marketing pages).
//
// createSupabaseServerClient() awaits cookies(), and any cookies() call opts
// the calling route into fully dynamic rendering — which silently disables the
// `revalidate` ISR windows on every (marketing) page. This client reads the
// same data through the public-read RLS policies with no request state, so
// static/ISR rendering is preserved.
//
// Never use it for user-scoped reads: it carries no session, so RLS sees anon.
let client: SupabaseClient<Database> | null = null;

export function createSupabaseAnonClient(): SupabaseClient<Database> {
  if (!client) {
    // Same dummy-value fallback as server.ts: render-time imports won't throw
    // without env vars; only an actual network call would.
    client = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:0",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "anon",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );
  }
  return client;
}
