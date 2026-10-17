"use client";

import { useEffect } from "react";

import { reportGoogleAdsSignUp } from "@/lib/analytics/googleAds";

/**
 * Reports a finished onboarding to Google Ads. Rendered by the pages onboarding
 * hands on to (withSignUpMarker) when they open with ?registered=1. Renders
 * nothing. Google counts one conversion per user id, so a reload is harmless.
 */
export function SignUpConversion({ userId }: { userId: string }) {
  useEffect(() => {
    reportGoogleAdsSignUp({ userId });
  }, [userId]);
  return null;
}
