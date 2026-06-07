import * as Sentry from "@sentry/nextjs";

// Server + edge Sentry init. No-ops until NEXT_PUBLIC_SENTRY_DSN is set, so dev
// and preview are unaffected. NOTE: this wires runtime error capture only —
// source-map upload / tunnelling via `withSentryConfig` in next.config.ts is a
// follow-up that needs SENTRY_AUTH_TOKEN and a production build to verify.
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({ dsn, tracesSampleRate: 0.1 });
  }
}

// Capture errors thrown in nested React Server Components.
export const onRequestError = Sentry.captureRequestError;
