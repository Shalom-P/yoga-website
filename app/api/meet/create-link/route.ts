import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

  const { data: session } = await supabase
    .from("sessions")
    .select("id, start_at, end_at, meet_link, teacher_id, teachers:teachers(display_name)")
    .eq("id", parsed.data.sessionId)
    .single();
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });

  if (session.meet_link) return NextResponse.json({ meetLink: session.meet_link });

  const teacherName = (session.teachers as { display_name?: string } | null)?.display_name ?? "Teacher";
  const { meetLink, eventId } = await createMeetEvent({
    summary: `Yoga with ${teacherName}`,
    startUtc: session.start_at,
    endUtc: session.end_at,
    attendeeEmails: user.email ? [user.email] : [],
  }).catch((e: Error) => {
    return { meetLink: "", eventId: "", error: e.message } as never;
  });

  if (!meetLink) {
    return NextResponse.json({ error: "meet_create_failed" }, { status: 502 });
  }

  await supabase
    .from("sessions")
    .update({ meet_link: meetLink, meet_event_id: eventId })
    .eq("id", session.id);

  return NextResponse.json({ meetLink });
}
