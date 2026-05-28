import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createMeetEvent } from "@/lib/google/calendar";

const schema = z.object({
  teacherId: z.string().uuid(),
  classCategoryId: z.string().uuid().nullable().optional(),
  startAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(15).max(240).default(60),
  capacity: z.number().int().min(1).max(50).default(1),
  isFreeTrial: z.boolean().default(false),
  notes: z.string().max(2000).optional(),
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
    .select("id, display_name")
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

  // Async-best-effort Meet link creation. Failure leaves meet_status='pending'
  // for the cron sweeper to retry.
  try {
    const { meetLink, eventId } = await createMeetEvent({
      summary: `Yoga with ${teacher.display_name}`,
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
    });
    await svc
      .from("sessions")
      .update({ meet_link: meetLink, meet_event_id: eventId, meet_status: "created" })
      .eq("id", session.id);
  } catch {
    await svc.from("sessions").update({ meet_status: "failed" }).eq("id", session.id);
  }

  return NextResponse.json({ sessionId: session.id });
}
