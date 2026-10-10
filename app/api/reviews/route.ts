import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

// Mirrored in components/dashboard/ReviewForm.tsx.
const schema = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(1000).optional(),
  displayName: z.string().trim().max(60).optional(),
  displayLocation: z.string().trim().max(60).optional(),
});

/**
 * POST /api/reviews
 *
 * A customer reviews one of their own finished bookings. The booking is read on
 * the cookie-bound client, so RLS (`bookings_self_read`) is what proves
 * ownership; the write goes through the service role because a customer cannot
 * read `reviews` rows that are not yet approved, which the duplicate check
 * needs. Reviews land `is_approved = false` and are published only from
 * /admin/reviews.
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { bookingId, rating, body, displayName, displayLocation } = parsed.data;

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, customer_id, status, session:sessions!session_id(id, end_at, teacher_id)")
    .eq("id", bookingId)
    .single();
  if (!booking || booking.customer_id !== user.id || !booking.session) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (booking.status === "cancelled") {
    return NextResponse.json({ error: "cancelled" }, { status: 409 });
  }
  if (new Date(booking.session.end_at).getTime() > Date.now()) {
    return NextResponse.json({ error: "not_finished" }, { status: 409 });
  }

  const svc = createSupabaseServiceClient();
  const { data: existing } = await svc
    .from("reviews")
    .select("id")
    .eq("customer_id", user.id)
    .eq("session_id", booking.session.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "already_reviewed" }, { status: 409 });
  }

  const { error } = await svc.from("reviews").insert({
    customer_id: user.id,
    teacher_id: booking.session.teacher_id,
    session_id: booking.session.id,
    rating,
    body: body || null,
    display_name_override: displayName || null,
    display_location: displayLocation || null,
    is_approved: false,
    is_featured: false,
  });
  if (error) {
    console.error("[api/reviews] insert failed:", error.message);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
