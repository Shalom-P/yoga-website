"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/events";

/** Fires landing_view once on mount. Server components can't call client analytics directly. */
export function LandingPageView() {
  useEffect(() => {
    track("landing_view", {
      referrer: document.referrer || undefined,
      utm_source: new URLSearchParams(window.location.search).get("utm_source") ?? undefined,
      utm_campaign: new URLSearchParams(window.location.search).get("utm_campaign") ?? undefined,
    });
  }, []);
  return null;
}
