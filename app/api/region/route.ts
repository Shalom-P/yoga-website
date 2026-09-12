import "server-only";

import { NextResponse } from "next/server";

import { countryFromHeaders, localeForCurrency, resolveRegion } from "@/lib/geo/region";
import { effectiveCurrency } from "@/lib/razorpay/catalog";

export const runtime = "nodejs";
// Depends on the caller's own GeoIP header, so it can never be prerendered.
export const dynamic = "force-dynamic";

/**
 * GET /api/region[?tz=Asia/Dubai]
 *
 * Tells the client which currency this request would be billed in, using the
 * exact same resolution the purchase routes use.
 *
 * Why this exists: the marketing pages are static/ISR, so a pricing card cannot
 * read request headers to find the customer's region without opting the whole
 * (marketing) group out of static rendering. The pricing grid was therefore
 * guessing from the browser timezone while `create-order` / `payments/intent`
 * decided the real currency from GeoIP. Those two disagree whenever a device
 * clock does not match where the device is (a UAE resident whose laptop is
 * still on Europe/London saw INR prices and was then charged in AED). Fetching
 * this endpoint from the client keeps the page static and the figure honest.
 *
 * `tz` is the same fallback the purchase routes take, and it is used on exactly
 * the same terms: only when the edge supplied no GeoIP country (local dev or
 * off-platform). It is client-supplied, so it must never be able to override a
 * real GeoIP result, or a visitor could choose their own billing currency by
 * changing their clock. resolveRegion enforces that precedence.
 *
 * Public and unauthenticated: it returns nothing about the caller that the
 * caller did not already tell us about themselves.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tz = url.searchParams.get("tz");

  const region = resolveRegion({
    country: countryFromHeaders(req.headers),
    // Bounded: this is untrusted input and only ever a map key.
    timezone: tz && tz.length <= 64 ? tz : null,
  });

  // Answer with what we can actually charge, not merely what we would prefer:
  // this figure drives the price on the card, so it has to survive to checkout.
  const currency = await effectiveCurrency(region.currency);
  const body = { ...region, currency, locale: localeForCurrency(currency) };

  return NextResponse.json(body, {
    headers: {
      // Per-visitor by definition: a shared cache would hand one customer
      // another customer's currency.
      "Cache-Control": "private, no-store",
    },
  });
}
