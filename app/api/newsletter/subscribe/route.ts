import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email(),
  source: z.string().max(50).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad email" }, { status: 400 });

  // Route signups through the SECURITY DEFINER subscribe_newsletter RPC
  // (migration 0007). The RPC is `on conflict do nothing` so we always get a
  // generic OK back — anon callers can't probe for existing emails via unique-
  // conflict timing the way they could with a direct upsert.
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("subscribe_newsletter", {
      p_email: parsed.data.email.toLowerCase(),
      p_source: parsed.data.source ?? "",
    });
    if (error) {
      // Log for monitoring but still return a generic OK so callers can't probe
      // for existing emails via error timing. A persistent error means the
      // RPC/DB needs attention.
      console.error("[newsletter] subscribe_newsletter failed:", error.message);
    }
  } catch (err) {
    // Supabase genuinely not configured (dev/preview) — silent no-op. If env IS
    // present this is unexpected, so surface it in logs.
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error("[newsletter] unexpected error:", err);
    }
  }
  return NextResponse.json({ ok: true });
}
