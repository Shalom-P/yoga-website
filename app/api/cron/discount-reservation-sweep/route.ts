import "server-only";

import { assertCron } from "@/lib/cron/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Node runtime: createSupabaseServiceClient is server-only.
export const runtime = "nodejs";

/**
 * POST /api/cron/discount-reservation-sweep
 *
 * Backstop for promo-code reservations (see 0032_discount_redemptions.sql). A
 * redemption is RESERVED at checkout-start to hold a max_uses / per_email_max
 * slot, then COMMITTED at fulfilment. A reservation that never pays (abandoned
 * Checkout, closed tab) would otherwise hold its slot forever — blocking the
 * global cap and, worse, the per-email cap for that customer's legit retry.
 *
 * This releases reservations still 'reserved' after the grace window so their
 * slot returns to the pool. Idempotent and bounded; the SQL function reports how
 * many it released per run.
 *
 * Gated by assertCron (Bearer CRON_SECRET). Schedule ~hourly.
 */
export async function POST(req: Request): Promise<Response> {
  const authError = assertCron(req);
  if (authError) return authError;

  const svc = createSupabaseServiceClient();
  const { data, error } = await svc.rpc("release_stale_discount_reservations", {
    p_older_than: "2 hours",
    p_limit: 500,
  });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const released = typeof data === "number" ? data : 0;
  // released === the per-run cap means there may be more to sweep next run.
  return Response.json({ ok: true, released, truncated: released >= 500 });
}

/**
 * Vercel Cron issues a **GET**, and these handlers only exported POST, so every
 * scheduled run would have returned 405 and the job would have looked healthy
 * while doing nothing. GET simply delegates.
 *
 * This widens the method, not the access: `assertCron` still requires
 * `Authorization: Bearer <CRON_SECRET>` and fails closed when the secret is
 * unset, so an unauthenticated GET is rejected exactly as an unauthenticated
 * POST is. Vercel injects that header automatically when CRON_SECRET is set as
 * an environment variable.
 */
export async function GET(req: Request): Promise<Response> {
  return POST(req);
}
