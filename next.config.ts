import type { NextConfig } from "next";

// Content-Security-Policy scoped to the third-party origins this app actually
// loads: Razorpay Checkout, Supabase (REST + realtime websockets), PostHog,
// Sentry ingest, Google OAuth, and the Google Ads tag.
//
// 'unsafe-inline' stays for scripts because Next emits an inline bootstrap and we
// keep static/ISR rendering (a per-request nonce would force every page dynamic).
// 'unsafe-eval' is needed only by the dev HMR runtime, so it's dropped in
// production. The value also constrains script/connect/frame HOSTS and blocks
// framing + object/base hijacks.
const isDev = process.env.NODE_ENV !== "production";
// Google Ads tag (lib/analytics/googleAds.ts), per Google's CSP guide for Ads
// conversions and remarketing. Some pings go to the visitor's local Google
// domain, which CSP can't wildcard: add www.google.<TLD> for each new country
// the ads target (co.in is India, ae is the UAE). adservice.google.com is not in
// the guide either; the served gtag.js registers ad clicks there (/pagead/regclk).
const googleAdsHosts =
  "https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://www.google.com https://www.google.co.in https://www.google.ae https://adservice.google.com";
const scriptSrc = [
  "script-src 'self' 'unsafe-inline'",
  isDev ? "'unsafe-eval'" : "",
  "https://checkout.razorpay.com https://*.posthog.com",
  // googleads.g.doubleclick.net is missing from Google's guide, but the tag's
  // remarketing ping loads from it as a script and was blocked without it.
  "https://www.googletagmanager.com https://www.googleadservices.com https://www.google.com https://googleads.g.doubleclick.net",
]
  .filter(Boolean)
  .join(" ");
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://*.razorpay.com",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://*.razorpay.com ${googleAdsHosts}`,
  "font-src 'self' data:",
  "media-src 'self' blob: https://*.supabase.co",
  "worker-src 'self' blob:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.posthog.com https://*.i.posthog.com https://api.razorpay.com https://lumberjack.razorpay.com https://*.ingest.sentry.io https://*.sentry.io ${googleAdsHosts} https://ad.doubleclick.net`,
  "frame-src https://*.razorpay.com https://accounts.google.com https://www.googletagmanager.com",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Browsers ignore HSTS on http/localhost, so it's safe to always send.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // strict-origin, not the browser default strict-origin-when-cross-origin: the
  // latter hands the full URL to the next page on our own site, so a page the
  // Google tag loads on would see document.referrer = /classes/<condition> after
  // a full page load (new tab, login redirect), and the tag reports referrers to
  // Google. Other origins get exactly what they got before.
  { key: "Referrer-Policy", value: "strict-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  // Hide the Next.js dev-tools indicator (the floating "N" badge) in `next dev`.
  // It never renders in production builds; this just removes it from the dev view.
  devIndicators: false,
  // Tree-shake large barrel packages so unused exports don't ship to the client.
  experimental: {
    optimizePackageImports: ["motion", "lucide-react", "date-fns", "date-fns-tz"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Permanent redirects for URLs that have moved.
  //
  // There was no redirect layer at all, while `slug` is a free-text field in
  // /admin/classes. Renaming a category slug, or deactivating a category, drops
  // an indexed URL to a 404 with nothing pointing anywhere. Add an entry here
  // BEFORE changing any slug that is live.
  //
  // These are static, so they do not force the (marketing) group dynamic the
  // way a middleware lookup would.
  async redirects() {
    return [
      // Pre-registered for the re-slugging the SEO plan calls for, so the old
      // URLs keep their equity when the new ones land. Harmless until then:
      // none of these source paths is a real route today.
      {
        source: "/classes/chair-yoga-for-seniors",
        destination: "/classes/geriatric",
        permanent: true,
      },
      {
        source: "/classes/pcos",
        destination: "/classes/hormonal-health",
        permanent: true,
      },
      {
        source: "/classes/kids",
        destination: "/classes/kids-yoga",
        permanent: true,
      },
      // Common hand-typed variants.
      //
      // Deliberately NOT redirecting /teacher/:slug -> /teachers/:slug: the
      // (teacher) route group owns /teacher/availability, /teacher/sessions,
      // /teacher/profile and /teacher/documents, so that rule would hijack the
      // private teacher surface and bounce signed-in teachers into marketing
      // 404s. The two namespaces are one character apart on purpose; leave them.
      { source: "/class/:slug", destination: "/classes/:slug", permanent: true },
      { source: "/prices", destination: "/pricing", permanent: true },
    ];
  },
  images: {
    // Supabase Storage public buckets (teacher-media, promotional-media) serve
    // avatar/cover images rendered via next/image. Allow that host so
    // optimization works instead of throwing on an unconfigured remote.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
