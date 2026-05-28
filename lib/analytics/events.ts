"use client";

import posthog from "posthog-js";

let initialized = false;
export function initPosthog() {
  if (initialized || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return; // Silent no-op when not configured (dev / preview)
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: "history_change",
    persistence: "localStorage+cookie",
    autocapture: false,
  });
  initialized = true;
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
  if (!initialized) return; // PostHog not configured — no-op
  posthog.capture(name, props);
}

export function identify(id: string, props: Record<string, unknown> = {}) {
  if (!initialized) return;
  posthog.identify(id, props);
}
