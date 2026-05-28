import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const schema = z.object({
  email: z.string().email(),
  source: z.string().max(50).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad email" }, { status: 400 });

  // Service-role insert because newsletter_signups is anyone-insert but we want to dedupe atomically.
  try {
    const svc = createSupabaseServiceClient();
    await svc.from("newsletter_signups").upsert(
      { email: parsed.data.email.toLowerCase(), source: parsed.data.source ?? null },
      { onConflict: "email" }
    );
  } catch {
    // Supabase not configured (dev) — no-op so the form still feels responsive.
  }
  return NextResponse.json({ ok: true });
}
