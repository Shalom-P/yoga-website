import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(req: NextRequest) {
  // Auth refresh + role-based route guard
  return updateSession(req);
}

export const config = {
  matcher: [
    // Skip API routes (handlers manage their own auth and webhooks must not be
    // intercepted), Next internals, and static assets.
    "/((?!api/|_next/static|_next/image|_next/data|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)",
  ],
};
