import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/types";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  // Fall back to dummy values when env isn't set — Server Components that try to query will
  // still throw on the network call, but render-time imports won't.
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:0",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "anon",
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookies are read-only.
            // Auth callbacks set cookies from route handlers / middleware instead.
          }
        },
      },
    }
  );
}
