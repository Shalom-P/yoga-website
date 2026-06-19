"use client";

// posthog-js is loaded lazily (dynamic import) so it stays OUT of the first-load
// bundle on the marketing/landing pages. It's only fetched when a PostHog key is
// configured AND initPosthog() runs, matching the zero-env preview story.
import type { PostHog } from "posthog-js";

let client: PostHog | null = null;
let initialized = false;

export async function initPosthog() {
  if (initialized || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return; // Silent no-op when not configured (dev / preview)
  initialized = true; // set before the await so a second call can't double-init
  const { default: posthog } = await import("posthog-js");
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: "history_change",
    persistence: "localStorage+cookie",
    autocapture: false,
  });
  client = posthog;
}

type EventName =
  | "landing_view"
  | "hero_cta_click"
  | "cta_click"
  | "teacher_card_click"
  | "pricing_view"
  | "signup_started"
  | "signup_completed"
  | "onboarding_completed"
  | "trial_slot_viewed"
  | "trial_booked"
  | "trial_attended"
  | "paid_plan_clicked"
  | "checkout_started"
  | "checkout_completed"
  | "subscription_cancelled"
  | "newsletter_signup";

export function track(name: EventName, props: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  if (!client) return; // PostHog not configured / still loading — no-op
  client.capture(name, props);
}

export function identify(id: string, props: Record<string, unknown> = {}) {
  if (!client) return;
  client.identify(id, props);
}
