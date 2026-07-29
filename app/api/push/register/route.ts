import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Node runtime: writes via the service role after authenticating the caller.
export const runtime = "nodejs";

// APNs device tokens are hex strings (64 hex chars today; Apple says treat the
// length as variable). Anything else is junk that would only bloat the table and
// get interpolated into the APNs :path.
const TOKEN_RE = /^[0-9a-f]{64,200}$/i;

// A user realistically has a handful of devices. Everything beyond the newest
// MAX_TOKENS_PER_USER rows is pruned so one account can't grow the table
// without bound.
const MAX_TOKENS_PER_USER = 10;

async function authedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function parseToken(body: unknown): string | null {
  const raw =
    typeof (body as { token?: unknown })?.token === "string"
      ? (body as { token: string }).token.trim()
      : "";
  return TOKEN_RE.test(raw) ? raw : null;
}

/**
 * POST /api/push/register — store (or refresh) the caller's APNs device token.
 *
 * Middleware skips /api, so this authenticates itself. The upsert runs on the
 * service role so a token can move to whichever user last signed in on a shared
 * device (the owner RLS policy would otherwise block re-assigning another user's
 * row). The user is authenticated first, so this is gated.
 */
export async function POST(req: Request): Promise<Response> {
  const user = await authedUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const token = parseToken(body);
  if (!token) return NextResponse.json({ error: "invalid_token" }, { status: 400 });

  // push_tokens isn't in the generated Database types yet (migration 0034); use an
  // untyped client for this table.
  const svc = createSupabaseServiceClient() as unknown as SupabaseClient;
  const { error } = await svc.from("push_tokens").upsert(
    {
      user_id: user.id,
      token,
      platform: "ios",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
  if (error) {
    // Raw PostgREST text (constraint/relation names) must not reach the client.
    console.error("[push/register] upsert failed:", error.message);
    return NextResponse.json({ error: "register_failed" }, { status: 500 });
  }

  // Prune anything beyond the newest N rows for this user (best-effort).
  const { data: extra } = await svc
    .from("push_tokens")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .range(MAX_TOKENS_PER_USER, MAX_TOKENS_PER_USER + 50);
  if (extra && extra.length > 0) {
    await svc
      .from("push_tokens")
      .delete()
      .in("id", (extra as Array<{ id: string }>).map((r) => r.id));
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/push/register — remove device tokens on sign-out.
 *
 * Without this, a shared or handed-over device keeps receiving the previous
 * user's session reminders (booking existence + teacher name) on the lock
 * screen after they log out. Body may carry `{ token }` to remove just this
 * device; with no valid token, every token for the caller is removed.
 * Must be called BEFORE supabase.auth.signOut() while the session cookie is
 * still valid — see unregisterPushNotifications() in lib/native/push.ts.
 */
export async function DELETE(req: Request): Promise<Response> {
  const user = await authedUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body: unknown = await req.json().catch(() => ({}));
  const token = parseToken(body);

  const svc = createSupabaseServiceClient() as unknown as SupabaseClient;
  let query = svc.from("push_tokens").delete().eq("user_id", user.id);
  if (token) query = query.eq("token", token);
  const { error } = await query;
  if (error) {
    console.error("[push/register] delete failed:", error.message);
    return NextResponse.json({ error: "unregister_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
