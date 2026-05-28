import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteMeetEvent } from "@/lib/google/calendar";

const schema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, session_id, customer_id")
    .eq("id", parsed.data.bookingId)
    .single();
  if (!booking || booking.customer_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancellation_reason: parsed.data.reason ?? null,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  const { data: session } = await supabase
    .from("sessions")
    .select("meet_event_id")
    .eq("id", booking.session_id)
    .single();
  if (session?.meet_event_id) {
    deleteMeetEvent(session.meet_event_id).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
