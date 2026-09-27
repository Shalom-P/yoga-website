"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { syncGoogleTag } from "@/lib/analytics/googleAds";

/**
 * Mounts once at the app root: loads the Google Ads tag and keeps the page it
 * reports in step with client-side navigation. Renders nothing, and does
 * nothing unless NEXT_PUBLIC_GOOGLE_ADS_ID is set. Rules live in
 * lib/analytics/googleAds.ts.
 */
export function GoogleTag() {
  const pathname = usePathname();
  useEffect(() => {
    syncGoogleTag(pathname);
  }, [pathname]);
  return null;
}
