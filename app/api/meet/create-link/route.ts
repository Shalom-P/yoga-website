import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createMeetEvent } from "@/lib/google/calendar";

const schema = z.object({
  sessionId: z.string().uuid(),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  // Authorize: caller must own a non-cancelled booking on this session. The
  // cookie-bound client honors bookings_self_read RLS, so a row coming back is
  // proof of ownership.
  const { data: ownership } = await supabase
    .from("bookings")
    .select("id")
    .eq("session_id", parsed.data.sessionId)
    .eq("customer_id", user.id)
    .neq("status", "cancelled")
    .limit(1);
  if (!ownership || ownership.length === 0) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("id, start_at, end_at, meet_link, teacher_id, teachers:teachers(display_name)")
    .eq("id", parsed.data.sessionId)
    .single();
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });

  if (session.meet_link) return NextResponse.json({ meetLink: session.meet_link });

  const teacherName = (session.teachers as { display_name?: string } | null)?.display_name ?? "Teacher";
  try {
    const { meetLink, eventId } = await createMeetEvent({
      summary: `Yoga with ${teacherName}`,
      startUtc: session.start_at,
      endUtc: session.end_at,
      attendeeEmails: user.email ? [user.email] : [],
    });
    // Persist with service role (RLS blocks customer UPDATE on sessions).
    const svc = createSupabaseServiceClient();
    await svc
      .from("sessions")
      .update({ meet_link: meetLink, meet_event_id: eventId, meet_status: "created" })
      .eq("id", session.id);
    return NextResponse.json({ meetLink });
  } catch {
    return NextResponse.json({ error: "meet_create_failed" }, { status: 502 });
  }
}
