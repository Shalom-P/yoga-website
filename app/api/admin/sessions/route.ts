import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { provisionSessionMeet, releaseSessionMeet } from "@/lib/google/provisionMeet";

// provisionSessionMeet -> lib/google/calendar.ts uses @vercel/oidc (Node only).
export const runtime = "nodejs";

const schema = z.object({
  teacherId: z.string().uuid(),
  classCategoryId: z.string().uuid().nullable().optional(),
  startAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(15).max(240).default(60),
  capacity: z.number().int().min(1).max(50).default(1),
  isFreeTrial: z.boolean().default(false),
  notes: z.string().max(2000).optional(),
});

const cancelSchema = z.object({
  sessionId: z.string().uuid(),
});

async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return data?.role === "admin";
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const start = new Date(parsed.data.startAt);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const end = new Date(start.getTime() + parsed.data.durationMinutes * 60_000);

  const svc = createSupabaseServiceClient();

  const { data: teacher } = await svc
    .from("teachers")
    .select("id, display_name, google_calendar_id")
    .eq("id", parsed.data.teacherId)
    .single();
  if (!teacher) {
    return NextResponse.json({ error: "teacher_not_found" }, { status: 404 });
  }

  // Reject overlapping non-cancelled sessions for the same teacher.
  const { data: overlap } = await svc
    .from("sessions")
    .select("id")
    .eq("teacher_id", teacher.id)
    .neq("status", "cancelled")
    .lt("start_at", end.toISOString())
    .gt("end_at", start.toISOString())
    .limit(1);
  if (overlap && overlap.length > 0) {
    return NextResponse.json({ error: "slot_taken" }, { status: 409 });
  }

  const { data: session, error: sessionErr } = await svc
    .from("sessions")
    .insert({
      teacher_id: teacher.id,
      class_category_id: parsed.data.classCategoryId ?? null,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      capacity: parsed.data.capacity,
      is_free_trial: parsed.data.isFreeTrial,
      notes: parsed.data.notes ?? null,
      status: "scheduled",
      meet_status: "pending",
    })
    .select("id")
    .single();
  if (sessionErr || !session) {
    return NextResponse.json({ error: "create_failed", details: sessionErr?.message }, { status: 500 });
  }

  // Best-effort Meet provisioning. Failure leaves meet_status='failed' for the
  // cron sweeper to retry. Hosted on the teacher's own calendar when set.
  await provisionSessionMeet(
    svc,
    { id: session.id, start_at: start.toISOString(), end_at: end.toISOString() },
    { summary: `Yoga with ${teacher.display_name}`, calendarId: teacher.google_calendar_id },
  );

  return NextResponse.json({ sessionId: session.id });
}

// Admin "cancel session" was previously done from the browser as a single
// sessions.update — leaving customer bookings as 'confirmed' and the Meet
// link still joinable. This endpoint cascades the cancel properly.
export async function DELETE(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = cancelSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const svc = createSupabaseServiceClient();
  const { data: session } = await svc
    .from("sessions")
    .select("id, status, meet_event_id, meet_calendar_id, start_at")
    .eq("id", parsed.data.sessionId)
    .single();
  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  if (session.status === "cancelled") {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }

  // Cascade cancel: session first (so customers immediately stop seeing it as
  // bookable), then the underlying bookings.
  const now = new Date().toISOString();
  const { error: sessionErr } = await svc
    .from("sessions")
    .update({ status: "cancelled" })
    .eq("id", session.id);
  if (sessionErr) {
    return NextResponse.json({ error: "db_error", details: sessionErr.message }, { status: 500 });
  }
  await svc
    .from("bookings")
    .update({
      status: "cancelled",
      cancellation_reason: "session_cancelled_by_admin",
      cancelled_at: now,
    })
    .eq("session_id", session.id)
    .neq("status", "cancelled");

  // Best-effort Meet cleanup — only if the class hasn't started, so we don't
  // kill an in-progress live class. Deletes from the calendar the event lives on.
  if (
    session.meet_event_id &&
    session.start_at &&
    new Date(session.start_at).getTime() > Date.now()
  ) {
    await releaseSessionMeet(session);
  }

  return NextResponse.json({ ok: true });
}
