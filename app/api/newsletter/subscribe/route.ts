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
    await supabase.rpc("subscribe_newsletter", {
      p_email: parsed.data.email.toLowerCase(),
      p_source: parsed.data.source ?? "",
    });
  } catch {
    // Supabase not configured (dev) — no-op so the form still feels responsive.
  }
  return NextResponse.json({ ok: true });
}
