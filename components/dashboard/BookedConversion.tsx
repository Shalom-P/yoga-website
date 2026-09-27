"use client";

import { useEffect } from "react";

import { reportGoogleAdsBooking } from "@/lib/analytics/googleAds";

/**
 * Reports a customer's first 1:1 booking to Google Ads. /dashboard/plan renders
 * it when the booking flow lands there with ?booked=1. The Google tag is allowed
 * on that page and not on the teacher's booking page, so this is the one place
 * the conversion can be sent without Google learning which teacher was booked.
 * Renders nothing. Google counts one conversion per booking id, so a reload of
 * the confirmation is harmless.
 */
export function BookedConversion({ bookingId }: { bookingId: string }) {
  useEffect(() => {
    reportGoogleAdsBooking({ bookingId });
  }, [bookingId]);
  return null;
}
