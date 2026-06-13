import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { releaseSessionMeet } from "@/lib/google/provisionMeet";

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
    .select("id, session_id, customer_id, status")
    .eq("id", parsed.data.bookingId)
    .single();
  if (!booking || booking.customer_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (booking.status !== "confirmed") {
    return NextResponse.json(
      { error: "not_cancellable", status: booking.status },
      { status: 409 },
    );
  }

  const svc = createSupabaseServiceClient();
  const { error: updateErr } = await svc
    .from("bookings")
    .update({
      status: "cancelled",
      cancellation_reason: parsed.data.reason ?? null,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .eq("status", "confirmed"); // optimistic guard against double-cancel races
  if (updateErr) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const { data: session } = await svc
    .from("sessions")
    .select("meet_event_id, meet_calendar_id, start_at")
    .eq("id", booking.session_id)
    .single();
  // Only delete the Meet event if (a) the session hasn't started yet — avoids
  // killing an in-progress class — AND (b) no other non-cancelled bookings
  // remain on this session, so group classes don't lose their link the moment
  // the first attendee cancels.
  if (
    session?.meet_event_id &&
    session.start_at &&
    new Date(session.start_at).getTime() > Date.now()
  ) {
    const { count: remaining } = await svc
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("session_id", booking.session_id)
      .neq("status", "cancelled");
    if ((remaining ?? 0) === 0) {
      await releaseSessionMeet(session);
    }
  }

  return NextResponse.json({ ok: true });
}
