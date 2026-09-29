"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

import { syncGoogleTag } from "@/lib/analytics/googleAds";

/**
 * Mounts once at the app root: loads the Google Ads tag, keeps the page it
 * reports in step with client-side navigation between its pages, and makes
 * leaving them a full page load. Renders nothing, and does nothing unless
 * NEXT_PUBLIC_GOOGLE_ADS_ID is set. Rules live in lib/analytics/googleAds.ts.
 * A layout effect, so the tag's link handler is in place from the hydration
 * commit on, before any click can be handled.
 */
export function GoogleTag() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    syncGoogleTag(pathname);
  }, [pathname]);
  return null;
}
