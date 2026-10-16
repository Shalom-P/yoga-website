// CSRF guard for cookie-authenticated /api/* mutations. Pure (no Next imports)
// so it is unit-testable and safe in the edge middleware.
//
// SameSite=Lax cookies stop cross-SITE posts, but any subdomain of the site is
// same-site, and `req.json()` happily parses a text/plain "simple" request that
// needs no CORS preflight. So a state-changing request that carries an Origin
// header must come from one of our own origins.
//
// Requests WITHOUT an Origin header are let through: browsers always send one on
// cross-origin POST/PUT/PATCH/DELETE, while server-to-server callers (Razorpay
// webhook, pg_cron/pg_net, the iOS app's native HTTP) don't, and those routes
// authenticate by signature / bearer secret / token instead.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Capacitor's WKWebView origins, for the iOS shell. A browser cannot forge these.
const NATIVE_ORIGINS = ["capacitor://localhost", "ionic://localhost"];

export function allowedOrigins(requestOrigin: string, siteUrl?: string | null): Set<string> {
  const set = new Set<string>([requestOrigin, ...NATIVE_ORIGINS]);
  if (siteUrl) {
    try {
      const site = new URL(siteUrl);
      set.add(site.origin);
      // Accept both the apex and www so a canonical-host mismatch can't lock
      // customers out of every POST.
      const host = site.hostname.startsWith("www.") ? site.hostname.slice(4) : `www.${site.hostname}`;
      set.add(`${site.protocol}//${host}${site.port ? `:${site.port}` : ""}`);
    } catch {
      // ignore a malformed NEXT_PUBLIC_SITE_URL
    }
  }
  return set;
}

export function isCrossOriginMutation(args: {
  method: string;
  origin: string | null;
  secFetchSite?: string | null;
  requestOrigin: string;
  siteUrl?: string | null;
}): boolean {
  if (SAFE_METHODS.has(args.method.toUpperCase())) return false;
  // Fetch metadata, where present, is the clearest signal.
  if (args.secFetchSite === "cross-site" || args.secFetchSite === "same-site") {
    if (!args.origin || !allowedOrigins(args.requestOrigin, args.siteUrl).has(args.origin)) return true;
  }
  if (!args.origin) return false;
  // Sandboxed iframes / data: URLs send the literal "null".
  return !allowedOrigins(args.requestOrigin, args.siteUrl).has(args.origin);
}
