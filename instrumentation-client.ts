import * as Sentry from "@sentry/nextjs";

// Browser Sentry init. No-ops until NEXT_PUBLIC_SENTRY_DSN is set.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Session Replay is off by default; opt in later if desired.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

// Instrument client-side navigations (Next.js App Router).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
