// Pure, dependency-free helpers for the Meta Conversions API. No `server-only`:
// middleware (edge) imports the cookie builders, and the rest is unit-tested.
// The sender itself lives in ./capi.ts.

/** First-party browser id cookie. Same name + format the Meta Pixel writes. */
export const FBP_COOKIE = "_fbp";
/** Click id cookie, derived from the `fbclid` query param on an ad click. */
export const FBC_COOKIE = "_fbc";
/** Meta's own lifetime for both cookies. */
export const META_COOKIE_MAX_AGE = 90 * 24 * 60 * 60;

/** `fb.1.<ms>.<random>`: the documented _fbp format. */
export function buildFbp(nowMs: number, random: number): string {
  return `fb.1.${nowMs}.${Math.floor(random * 1e10)}`;
}

/** `fb.1.<ms>.<fbclid>`: the documented _fbc format. */
export function buildFbc(nowMs: number, fbclid: string): string {
  return `fb.1.${nowMs}.${fbclid}`;
}

/** True when a cookie value already carries this fbclid (don't restamp its time). */
export function fbcMatches(existing: string | undefined, fbclid: string): boolean {
  return !!existing && existing.endsWith(`.${fbclid}`);
}

/** Appended to the WKWebView user agent by the iOS shell (capacitor.config.ts). */
export const NATIVE_APP_UA_TOKEN = "MyYogaClassesiOS";

/**
 * Whether this visitor may be tracked for Meta at all. No for the iOS app
 * (sharing app users with an ad network is "tracking" under Apple's ATT, which
 * the app does not request) and no when the browser sends Global Privacy
 * Control. Gates both the cookies (middleware) and every event (capi.ts).
 */
export function metaTrackingAllowed(h: Headers): boolean {
  if (h.get("sec-gpc") === "1") return false;
  return !(h.get("user-agent") ?? "").includes(NATIVE_APP_UA_TOKEN);
}

/** Client IP from proxy headers: the left-most x-forwarded-for hop. */
export function clientIpFromHeaders(h: Headers): string | undefined {
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || h.get("x-real-ip")?.trim() || undefined;
}

/** Read one cookie out of a raw Cookie header. */
export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) {
      const v = part.slice(i + 1).trim();
      try {
        return decodeURIComponent(v) || undefined;
      } catch {
        return v || undefined;
      }
    }
  }
  return undefined;
}

/** Browser-side signals Meta matches on, captured while the customer is on the site. */
export interface MetaBrowserContext {
  /** Set when metaTrackingAllowed() said no: the event must not be sent. */
  optOut?: boolean;
  ip?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
  sourceUrl?: string;
}

// Razorpay order notes: max 15 keys, 256 chars per value. The Purchase fires
// from fulfilment, which the webhook can reach with no browser attached, so the
// context rides along on the order. Keep the keys short and stable. The user
// agent gets two keys: Facebook's in-app browser UA (i.e. most ad traffic) runs
// past 256 chars, and a truncated UA weakens matching on the Purchase.
const NOTE_MAX = 255;

export function metaContextToNotes(ctx: MetaBrowserContext): Record<string, string> {
  if (ctx.optOut) return { mOff: "1" };
  const out: Record<string, string> = {};
  const put = (key: string, v: string | undefined) => {
    if (v) out[key] = v.slice(0, NOTE_MAX);
  };
  put("mIp", ctx.ip);
  put("mUa", ctx.userAgent);
  put("mUa2", ctx.userAgent?.slice(NOTE_MAX));
  put("mFbp", ctx.fbp);
  put("mFbc", ctx.fbc);
  put("mUrl", ctx.sourceUrl);
  return out;
}

export function metaContextFromNotes(notes: Record<string, unknown>): MetaBrowserContext {
  const get = (key: string) => {
    const v = notes[key];
    return typeof v === "string" && v ? v : undefined;
  };
  if (get("mOff")) return { optOut: true };
  const ua = get("mUa");
  const ctx: MetaBrowserContext = {
    ip: get("mIp"),
    userAgent: ua ? ua + (get("mUa2") ?? "") : undefined,
    fbp: get("mFbp"),
    fbc: get("mFbc"),
    sourceUrl: get("mUrl"),
  };
  for (const k of Object.keys(ctx) as (keyof MetaBrowserContext)[]) {
    if (ctx[k] === undefined) delete ctx[k];
  }
  return ctx;
}
