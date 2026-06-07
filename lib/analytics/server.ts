import "server-only";

import { PostHog } from "posthog-node";

// Server-side PostHog mirror. Complements the client `track()` in
// lib/analytics/events.ts so money/funnel events that happen on the server
// (booking confirmed, subscription activated) are captured too. No-ops when
// PostHog isn't configured — same philosophy as the client helper.
let client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.POSTHOG_SERVER_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      // Serverless: flush each event immediately rather than batching.
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/**
 * Fire-and-forget server-side event. Never throws — analytics must not break a
 * request. Awaits flush so the event is sent before a serverless function ends.
 */
export async function trackServer(
  distinctId: string,
  event: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    c.capture({ distinctId, event, properties });
    await c.flush();
  } catch {
    // swallow — analytics is best-effort
  }
}
