import { NATIVE_APP_UA_TOKEN } from "@/lib/meta/shared";

/**
 * Google Ads conversion tracking through the Google tag (gtag.js).
 *
 * Unlike Meta (server-side Conversions API, no Pixel: lib/meta/capi.ts), Google
 * Ads attribution needs its tag in the browser. It reads the ad click id
 * (gclid) off the landing page into a first-party cookie, and the conversion
 * has to be reported from a browser. components/shared/GoogleTag.tsx loads it
 * at most once per tab.
 *
 * Silent no-op unless NEXT_PUBLIC_GOOGLE_ADS_ID is set (the zero-env preview
 * story). Same line as Meta: nothing for the iOS app (Apple's ATT) or for a
 * browser that sends Global Privacy Control. Visitors in the EEA, UK and
 * Switzerland get consent mode "denied" (no ad cookies, cookieless pings only),
 * since there is no consent banner to ask them.
 *
 * PRIVACY: this is a health-adjacent site, and the tag reports the real path
 * and title of the page it runs on (gtag sends them as `top` and `tiba` even
 * when page_location is overridden). So it doesn't run everywhere. It loads on
 * the pages where a pack can be bought, for everyone, and on any other page
 * only when the visit came from one of our Google ads, whose landing page
 * Google already knows from the click. Organic browsing of condition, teacher
 * and dashboard pages never reaches Google, which also keeps condition-based
 * remarketing lists (forbidden by Google's personalised-ads policy) impossible
 * to build. Once loaded the tag sends nothing on client-side navigation, and
 * Referrer-Policy: strict-origin (next.config.ts) keeps our page URLs out of
 * document.referrer. The Purchase conversion carries the amount, currency and
 * Razorpay payment id; the booking conversion carries only our booking id.
 * Neither says anything about the customer, the teacher, the time or the
 * condition.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** The Google tag id (AW-...), or undefined when unset or malformed. It goes into a script URL. */
export function parseGoogleAdsId(raw: string | undefined): string | undefined {
  const id = raw?.trim();
  return id && /^AW-\d+$/.test(id) ? id : undefined;
}

/** A conversion label (the part after the slash in send_to), or undefined. */
export function parseConversionLabel(raw: string | undefined): string | undefined {
  const label = raw?.trim();
  return label && /^[\w-]+$/.test(label) ? label : undefined;
}

const GOOGLE_ADS_ID = parseGoogleAdsId(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID);
const PURCHASE_LABEL = parseConversionLabel(process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL);
const BOOKING_LABEL = parseConversionLabel(process.env.NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL);

/**
 * Where Google's EU user consent policy requires consent before ad cookies: the
 * EEA, the UK and Switzerland. With no banner to ask, they stay "denied".
 */
export const CONSENT_REQUIRED_REGIONS = [
  // EU
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // Rest of the EEA, then the UK and Switzerland
  "IS", "LI", "NO", "GB", "CH",
];

// Same matching as middleware's inArea(): a bare prefix would make /teacher
// swallow the public /teachers listing.
const inArea = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

/** Never, whatever the URL says: staff areas and the medical documents screen. */
const NO_TAG_AREAS = ["/admin", "/teacher", "/dashboard/documents"];

/**
 * Where a pack can be bought: the pricing grid on the home page and /pricing,
 * and /dashboard/plan. The tag loads here for everyone, so a purchase is
 * reported whichever device or visit it happens on. /dashboard/plan is also
 * where the booking flow sends a customer once their first 1:1 is booked, so
 * that conversion is reported here too, rather than from the teacher's booking
 * page. A new place that can complete a purchase (or another conversion) has
 * to be added here.
 */
const CHECKOUT_PAGES = new Set(["/", "/pricing", "/dashboard/plan"]);

/** Google Ads click ids. Their presence means the visit came from our ad. */
const CLICK_IDS = ["gclid", "gbraid", "wbraid"];

/** Whether the tag may load on this page. See the PRIVACY note above. */
export function googleTagWantedOn(pathname: string, search = ""): boolean {
  if (NO_TAG_AREAS.some((area) => inArea(pathname, area))) return false;
  if (CHECKOUT_PAGES.has(pathname)) return true;
  const params = new URLSearchParams(search);
  return CLICK_IDS.some((id) => params.has(id));
}

/** No Google tag for the iOS app (ATT) or a browser sending Global Privacy Control. */
export function googleTagAllowedFor(userAgent: string, globalPrivacyControl?: boolean): boolean {
  return globalPrivacyControl !== true && !userAgent.includes(NATIVE_APP_UA_TOKEN);
}

// Click ids plus the other parameters Google's own links carry, and UTM tags.
// Every other query parameter is dropped: /dashboard/plan carries a promo code.
const AD_PARAMS = new Set([...CLICK_IDS, "gclsrc", "dclid", "gad_source", "gad_campaignid"]);

function adParamsOnly(search: string): string {
  const kept = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(search)) {
    if (AD_PARAMS.has(key) || key.startsWith("utm_")) kept.append(key, value);
  }
  const query = kept.toString();
  return query ? `?${query}` : "";
}

/** The page URL Google is told: the real page, with only ad parameters left in the query. */
export function googlePageUrl(origin: string, pathname: string, search = ""): string {
  return `${origin}${pathname}${adParamsOnly(search)}`;
}

/**
 * The referrer Google is told: only the site the visitor came from. Our own
 * pages already arrive as a bare origin (Referrer-Policy: strict-origin in
 * next.config.ts); this also trims another site that sends its full URL.
 */
export function googleReferrer(referrer: string): string {
  try {
    return referrer ? `${new URL(referrer).origin}/` : "";
  } catch {
    return "";
  }
}

export interface GooglePurchase {
  /** Razorpay payment id. Google counts one conversion per id, so a replay can't double count. */
  transactionId: string;
  /** What was charged, after any promo, in minor units (paise, fils). */
  amountMinor: number;
  currency: string;
}

/** Parameters for the Purchase conversion event, or null when it can't be sent. */
export function purchaseConversion(
  adsId: string | undefined,
  label: string | undefined,
  p: GooglePurchase,
) {
  if (!adsId || !label || !p.transactionId || !(p.amountMinor >= 0)) return null;
  return {
    send_to: `${adsId}/${label}`,
    value: p.amountMinor / 100,
    currency: p.currency.toUpperCase(),
    transaction_id: p.transactionId,
  };
}

export interface GoogleBooking {
  /** Our booking id. Google counts one conversion per id, so a reload of the confirmation can't double count. */
  bookingId: string;
}

/**
 * Parameters for the booking conversion event, or null when it can't be sent.
 * Deliberately no value, currency or anything else: the label alone says a
 * first 1:1 was booked.
 */
export function bookingConversion(
  adsId: string | undefined,
  label: string | undefined,
  b: GoogleBooking,
) {
  if (!adsId || !label || !b.bookingId) return null;
  return { send_to: `${adsId}/${label}`, transaction_id: b.bookingId };
}

let loaded = false;

/**
 * Call on every route change. Loads the tag the first time a page wants it,
 * then keeps the page URL it reports in step with client-side navigation.
 */
export function syncGoogleTag(pathname: string): void {
  if (typeof window === "undefined" || !GOOGLE_ADS_ID) return;
  const { origin, search } = window.location;
  const pageUrl = googlePageUrl(origin, pathname, search);

  if (loaded) {
    window.gtag?.("set", { page_location: pageUrl });
    return;
  }

  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  const capacitor = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (!googleTagWantedOn(pathname, search)) return;
  if (!googleTagAllowedFor(nav.userAgent, nav.globalPrivacyControl)) return;
  if (capacitor?.isNativePlatform?.()) return;
  loaded = true;

  const dataLayer = (window.dataLayer = window.dataLayer ?? []);
  // gtag.js only acts on real `arguments` objects in the dataLayer, not arrays,
  // so this has to be a plain function rather than a rest-parameter arrow.
  const gtag: (...args: unknown[]) => void = function () {
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments);
  };
  window.gtag = gtag;
  // Consent defaults only apply to commands queued after them.
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    region: CONSENT_REQUIRED_REGIONS,
  });
  // Where ad cookies are denied, also strip ad click ids from the pings.
  gtag("set", "ads_data_redaction", true);
  gtag("set", {
    page_location: pageUrl,
    page_referrer: googleReferrer(document.referrer),
  });
  gtag("js", new Date());
  gtag("config", GOOGLE_ADS_ID);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
  document.head.appendChild(script);
}

/**
 * gtag once the tag has loaded in this tab, loading it first when this page
 * wants it: a page's own effects run before the root <GoogleTag>'s, so a
 * conversion sent as a page opens would otherwise find no tag yet. Undefined
 * where the tag isn't wanted or allowed, and the conversion is then dropped.
 */
function tag(): ((...args: unknown[]) => void) | undefined {
  if (typeof window === "undefined") return undefined;
  if (!loaded) syncGoogleTag(window.location.pathname);
  return loaded ? window.gtag : undefined;
}

/**
 * Report a pack purchase as the Google Ads "Purchase" conversion. Call only once
 * the server has confirmed the payment. No-op unless the tag is allowed in this
 * tab and NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL is set.
 */
export function reportGoogleAdsPurchase(p: GooglePurchase): void {
  const gtag = tag();
  const params = purchaseConversion(GOOGLE_ADS_ID, PURCHASE_LABEL, p);
  if (gtag && params) gtag("event", "conversion", params);
}

/**
 * Report a customer's first 1:1 booking as the Google Ads booking conversion.
 * Call from the confirmation the booking flow lands on (/dashboard/plan, one of
 * CHECKOUT_PAGES), never from the booking page itself, whose path names the
 * teacher. No-op unless the tag is allowed in this tab and
 * NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL is set.
 */
export function reportGoogleAdsBooking(b: GoogleBooking): void {
  const gtag = tag();
  const params = bookingConversion(GOOGLE_ADS_ID, BOOKING_LABEL, b);
  if (gtag && params) gtag("event", "conversion", params);
}
