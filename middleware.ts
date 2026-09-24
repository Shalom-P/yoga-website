import type { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  buildFbc,
  buildFbp,
  FBC_COOKIE,
  FBP_COOKIE,
  fbcMatches,
  META_COOKIE_MAX_AGE,
  metaTrackingAllowed,
} from "@/lib/meta/shared";

export async function middleware(req: NextRequest) {
  // Auth refresh + role-based route guard
  const res = await updateSession(req);
  setMetaCookies(req, res);
  return res;
}

// First-party ids for the Meta Conversions API (lib/meta/capi.ts reads them back
// on /api/* requests). We run no Pixel, so nothing else writes these. Set on the
// response only, so marketing pages keep their ISR (no cookies() in render).
// Never set while Meta isn't configured, nor for the iOS app or a Global
// Privacy Control browser.
function setMetaCookies(req: NextRequest, res: NextResponse) {
  if (!process.env.META_PIXEL_ID || !metaTrackingAllowed(req.headers)) return;
  const opts = { maxAge: META_COOKIE_MAX_AGE, path: "/", sameSite: "lax" as const, secure: true };
  if (!req.cookies.get(FBP_COOKIE)) {
    res.cookies.set(FBP_COOKIE, buildFbp(Date.now(), Math.random()), opts);
  }
  const fbclid = req.nextUrl.searchParams.get("fbclid");
  if (fbclid && !fbcMatches(req.cookies.get(FBC_COOKIE)?.value, fbclid)) {
    res.cookies.set(FBC_COOKIE, buildFbc(Date.now(), fbclid), opts);
  }
}

export const config = {
  matcher: [
    // Skip API routes (handlers manage their own auth and webhooks must not be
    // intercepted), Next internals, and static assets.
    "/((?!api/|_next/static|_next/image|_next/data|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)",
  ],
};
