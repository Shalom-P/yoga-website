import "server-only";

import crypto from "node:crypto";

import * as Sentry from "@sentry/nextjs";
import { after } from "next/server";

import {
  clientIpFromHeaders,
  FBC_COOKIE,
  FBP_COOKIE,
  metaTrackingAllowed,
  readCookie,
  type MetaBrowserContext,
} from "./shared";

/**
 * Meta Conversions API (server-side events), dataset/pixel id META_PIXEL_ID.
 *
 * Silent no-op unless META_PIXEL_ID and META_CAPI_ACCESS_TOKEN are both set, like
 * the PostHog helpers. Set META_CAPI_TEST_EVENT_CODE to route events to the
 * "Test events" tab in Events Manager instead of live data.
 *
 * PRIVACY: this is a health-adjacent site. Never put condition/category names,
 * teacher identities, onboarding goals, medical documents or free text in an
 * event. Only standard event names, money, pack slugs, and hashed identifiers go
 * to Meta. The page URL is a fixed path per call site, never the Referer: a
 * teacher's booking page (/dashboard/book/<slug>) can imply a condition.
 * Visitors that metaTrackingAllowed() rejects (iOS app, Global Privacy Control)
 * send nothing. Events only ever come from verified, signed-in customers, so a
 * stranger can't make Meta record someone else's email.
 */

type StandardEvent =
  | "InitiateCheckout"
  | "Purchase"
  | "Schedule"
  | "CompleteRegistration";

export interface MetaEvent {
  name: StandardEvent;
  /** Stable per real-world action. Meta dedupes on (name, id) for 48h. */
  eventId: string;
  context: MetaBrowserContext;
  user: { email?: string | null; externalId?: string | null; country?: string | null };
  custom?: {
    value?: number;
    currency?: string;
    contentIds?: string[];
    contentType?: "product";
    numItems?: number;
  };
}

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION ?? "v23.0";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://myyogaclasses.fit";

export function isMetaCapiConfigured(): boolean {
  return !!process.env.META_PIXEL_ID && !!process.env.META_CAPI_ACCESS_TOKEN;
}

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const hashed = (v: string | null | undefined) => {
  const n = v?.trim().toLowerCase();
  return n ? [sha256(n)] : undefined;
};

/**
 * Everything Meta matches on that the incoming request carries. `path` is the
 * page the action happens on, reported as event_source_url.
 */
export function metaContextFromRequest(req: Request, path: `/${string}`): MetaBrowserContext {
  if (!metaTrackingAllowed(req.headers)) return { optOut: true };
  const cookie = req.headers.get("cookie");
  return {
    ip: clientIpFromHeaders(req.headers),
    userAgent: req.headers.get("user-agent") ?? undefined,
    fbp: readCookie(cookie, FBP_COOKIE),
    fbc: readCookie(cookie, FBC_COOKIE),
    sourceUrl: new URL(path, SITE_URL).toString(),
  };
}

function buildPayload(e: MetaEvent) {
  const { context: c, user: u, custom } = e;
  // A "website" event requires the browser user agent. Without one (e.g. a
  // purchase whose order predates this integration) it is still a real sale,
  // so report it as system_generated rather than drop it.
  const actionSource = c.userAgent ? "website" : "system_generated";
  return {
    event_name: e.name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: e.eventId,
    action_source: actionSource,
    event_source_url: c.sourceUrl ?? SITE_URL,
    user_data: {
      em: hashed(u.email),
      external_id: hashed(u.externalId),
      country: hashed(u.country),
      client_ip_address: c.ip,
      client_user_agent: c.userAgent,
      fbp: c.fbp,
      fbc: c.fbc,
    },
    custom_data: custom
      ? {
          value: custom.value,
          currency: custom.currency,
          content_ids: custom.contentIds,
          content_type: custom.contentType,
          num_items: custom.numItems,
        }
      : undefined,
  };
}

/** Send one event now. Never throws: ad attribution must not break a request. */
export async function sendMetaEvent(e: MetaEvent): Promise<void> {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token || e.context.optOut) return;
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Token in the body, not the query string, so it stays out of access logs.
      body: JSON.stringify({
        data: [buildPayload(e)],
        access_token: token,
        ...(process.env.META_CAPI_TEST_EVENT_CODE
          ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE }
          : {}),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      Sentry.captureMessage(`meta capi ${e.name} rejected (${res.status}): ${body.slice(0, 300)}`, "warning");
    }
  } catch (err) {
    Sentry.captureMessage(
      `meta capi ${e.name} failed: ${err instanceof Error ? err.message : "unknown error"}`,
      "info",
    );
  }
}

/**
 * Send after the response is flushed, so the customer never waits on Meta.
 * `after()` needs a request scope; outside one (a script) we just fire it.
 */
export function queueMetaEvent(e: MetaEvent): void {
  if (!isMetaCapiConfigured() || e.context.optOut) return;
  try {
    after(() => sendMetaEvent(e));
  } catch {
    void sendMetaEvent(e);
  }
}
