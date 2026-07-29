import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { apnsConfigured, sendApnsPush, type PushNotification } from "@/lib/push/apns";

/**
 * Send a push to every device a user has registered. No-op (no DB hit) when APNs
 * isn't configured. Prunes tokens APNs reports as invalid so the table self-heals.
 */
export async function notifyUser(userId: string, notification: PushNotification): Promise<void> {
  if (!apnsConfigured()) return;

  // push_tokens isn't in the generated Database types yet (migration 0034).
  const svc = createSupabaseServiceClient() as unknown as SupabaseClient;
  const { data, error } = await svc
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId)
    .limit(10);
  if (error || !data || data.length === 0) return;

  // Defense in depth: the token lands in the APNs HTTP/2 :path, so re-validate
  // the shape on the read side even though the route and a DB CHECK enforce it.
  const tokens = (data as Array<{ token: string }>)
    .map((r) => r.token)
    .filter((t) => /^[0-9a-fA-F]{64,200}$/.test(t));
  if (tokens.length === 0) return;
  const { invalidTokens } = await sendApnsPush(tokens, notification);

  if (invalidTokens.length > 0) {
    await svc.from("push_tokens").delete().in("token", invalidTokens);
  }
}
