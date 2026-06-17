import type { NextConfig } from "next";

// Content-Security-Policy scoped to the third-party origins this app actually
// loads: Razorpay Checkout, Supabase (REST + realtime websockets), PostHog,
// Sentry ingest, and Google OAuth. 'unsafe-inline'/'unsafe-eval' are required
// because Next's bootstrap (and HMR in dev) inject inline/eval'd scripts and we
// don't yet emit per-request nonces — moving to a nonce-based CSP is the next
// hardening step. The value still constrains script/connect/frame HOSTS and
// blocks framing + object/base hijacks, which is the bulk of the protection.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://*.razorpay.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://*.posthog.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://*.razorpay.com",
  "font-src 'self' data:",
  "media-src 'self' blob: https://*.supabase.co",
  "worker-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.posthog.com https://*.i.posthog.com https://api.razorpay.com https://lumberjack.razorpay.com https://*.ingest.sentry.io https://*.sentry.io",
  "frame-src https://*.razorpay.com https://accounts.google.com",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Browsers ignore HSTS on http/localhost, so it's safe to always send.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  // Hide the Next.js dev-tools indicator (the floating "N" badge) in `next dev`.
  // It never renders in production builds; this just removes it from the dev view.
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
