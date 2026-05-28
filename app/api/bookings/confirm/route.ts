import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  teacherId: z.string().uuid(),
  startAt: z.string(), // ISO UTC
  durationMinutes: z.number().int().min(15).max(180).default(60),
  isFreeTrial: z.boolean().default(true),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const start = new Date(parsed.data.startAt);
  const end = new Date(start.getTime() + parsed.data.durationMinutes * 60_000);

  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .insert({
      teacher_id: parsed.data.teacherId,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      capacity: 1,
      status: "scheduled",
      is_free_trial: parsed.data.isFreeTrial,
    })
    .select("id")
    .single();
  if (sessionErr || !session) {
    return NextResponse.json({ error: "session_create_failed" }, { status: 500 });
  }

  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .insert({
      session_id: session.id,
      customer_id: user.id,
      is_free_trial: parsed.data.isFreeTrial,
      status: "confirmed",
    })
    .select("id")
    .single();
  if (bookingErr) {
    return NextResponse.json({ error: bookingErr.message }, { status: 500 });
  }

  // Best-effort Meet link creation. Don't block booking if Google isn't configured.
  fetch(new URL("/api/meet/create-link", req.url).toString(), {
    method: "POST",
    headers: { "content-type": "application/json", cookie: req.headers.get("cookie") ?? "" },
    body: JSON.stringify({ sessionId: session.id }),
  }).catch(() => {});

  return NextResponse.json({ bookingId: booking.id, sessionId: session.id });
}
