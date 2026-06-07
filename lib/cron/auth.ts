import "server-only";

/**
 * Shared cron authentication helper.
 *
 * Every cron route handler must call `assertCron(req)` before any business
 * logic. It checks for `Authorization: Bearer <CRON_SECRET>` on the incoming
 * request and returns a 401 Response if the header is absent or wrong.
 *
 * Setup requirements:
 *  1. Set the env var `CRON_SECRET` to a long random string (e.g. `openssl rand -hex 32`).
 *  2. Schedule each handler via your host's cron mechanism, an external scheduler
 *     (e.g. cron-job.org, Render Cron Jobs, Supabase pg_cron + pg_net), or a
 *     serverless scheduler. Pass the secret in the Authorization header:
 *       curl -X POST https://<your-domain>/api/cron/<job> \
 *            -H "Authorization: Bearer $CRON_SECRET"
 *
 * This helper is host-agnostic — it does NOT depend on any platform-specific
 * request header injection (e.g. Vercel's `x-vercel-cron-signature`).
 */
export function assertCron(req: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed: if CRON_SECRET is not configured the endpoint is inaccessible.
    return new Response(
      JSON.stringify({ error: "CRON_SECRET env var is not set" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || token !== secret) {
    return new Response(
      JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // Auth passed — caller continues.
  return null;
}
