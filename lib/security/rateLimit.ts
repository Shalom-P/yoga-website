import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Fixed-window rate limiter backed by the `rate_limit_hit` RPC (migration 0046).
// Keys are hashed so no raw IP or user id is stored in the table.
//
// Fails OPEN: if the RPC is missing (code deployed before 0046) or the DB errors,
// the request is allowed and the problem is logged. A limiter outage must never
// take the contact form or booking flow down with it.

export type RateLimitRule = { bucket: string; windowSeconds: number; max: number };

export const RATE_LIMITS = {
  contactPerIp: { bucket: "contact:ip", windowSeconds: 600, max: 3 },
  newsletterPerIp: { bucket: "newsletter:ip", windowSeconds: 3600, max: 5 },
  reviewsPerUser: { bucket: "reviews:user", windowSeconds: 3600, max: 10 },
  meetLinkPerUser: { bucket: "meet-link:user", windowSeconds: 60, max: 5 },
  promoPreviewPerUser: { bucket: "promo-preview:user", windowSeconds: 600, max: 20 },
} satisfies Record<string, RateLimitRule>;

/** Best client IP on Vercel: x-real-ip is set by the platform; else the first XFF hop. */
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return "unknown";
}

function hashKey(bucket: string, subject: string): string {
  return `${bucket}:${createHash("sha256").update(`${bucket}|${subject}`).digest("hex").slice(0, 32)}`;
}

/** Returns true when the request is allowed. */
export async function rateLimit(rule: RateLimitRule, subject: string): Promise<boolean> {
  try {
    const svc = createSupabaseServiceClient();
    const { data, error } = await svc.rpc("rate_limit_hit", {
      p_key: hashKey(rule.bucket, subject),
      p_window_seconds: rule.windowSeconds,
      p_max: rule.max,
    });
    if (error) {
      console.error(`[rateLimit] ${rule.bucket} check failed (allowing):`, error.message);
      return true;
    }
    return data !== false;
  } catch (err) {
    console.error(`[rateLimit] ${rule.bucket} unexpected error (allowing):`, err);
    return true;
  }
}

export function tooManyRequests(): Response {
  return new Response(JSON.stringify({ error: "rate_limited" }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": "60" },
  });
}
