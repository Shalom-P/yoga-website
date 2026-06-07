import "server-only";

import Razorpay from "razorpay";

/**
 * Server-only Razorpay client. Cached at module scope so we don't construct a
 * new SDK instance (and re-read env) on every request. Credentials are static,
 * so a singleton is safe.
 */
let client: Razorpay | null = null;

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function getRazorpayClient(): Razorpay {
  if (client) return client;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).");
  }
  client = new Razorpay({ key_id, key_secret });
  return client;
}
