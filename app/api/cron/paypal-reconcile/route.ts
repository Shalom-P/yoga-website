import "server-only";

import { assertCron } from "@/lib/cron/auth";

/**
 * POST /api/cron/paypal-reconcile
 *
 * STUB — not yet implemented.
 *
 * This endpoint exists as a documented placeholder. When implemented it should:
 *
 * 1. Fetch all local subscriptions in `active` or `suspended` status from the
 *    `subscriptions` table (service-role client, no RLS).
 *
 * 2. For each, call the PayPal Subscriptions API:
 *      GET https://api-m.paypal.com/v1/billing/subscriptions/{paypal_subscription_id}
 *    using a PayPal OAuth2 access token (PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET).
 *
 * 3. Compare the PayPal `status` field with our local `status` and reconcile:
 *    - PayPal ACTIVE    + local suspended → reactivate (update status = 'active',
 *                                           update next_billing_at from PayPal billing info)
 *    - PayPal CANCELLED + local active    → cancel (status='cancelled', cancelled_at=now())
 *                                           respecting the out-of-order guard from the
 *                                           webhook: don't reactivate a locally-cancelled sub.
 *    - PayPal EXPIRED   + local active    → expire (status='expired')
 *    - Mismatched next_billing_at         → update from PayPal source of truth
 *
 * 4. Log any discrepancies to stdout / your observability stack (e.g. Sentry).
 *
 * 5. Return { ok: true, processed: <count>, reconciled: <count> }.
 *
 * Invariants to preserve from the PayPal webhook handler (api/paypal/webhook):
 *   - A locally `cancelled` subscription must NEVER be reactivated by reconcile.
 *     The webhook sets cancelled_at; only a new PayPal subscription (new ID) can
 *     create an active subscription for that customer again.
 *   - `SUSPENDED` is recoverable — do not set cancelled_at for a suspended sub.
 *   - The `paypal_webhook_events` idempotency table is webhook-only; reconcile
 *     should do its own deduplication (e.g. track last_reconciled_at on subscriptions).
 *
 * Schedule: run daily (e.g. 02:00 UTC). Weekly is acceptable for the stub period.
 */
export async function POST(req: Request): Promise<Response> {
  const authError = assertCron(req);
  if (authError) return authError;

  // Stub: authenticate and return immediately so the scheduler sees a 200 and
  // does not flag the job as failed while implementation is pending.
  return Response.json({
    ok: true,
    processed: 0,
    note: "PayPal reconciliation is not yet implemented. See route comments for the full spec.",
  });
}
