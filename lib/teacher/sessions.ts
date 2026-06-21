import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { MeetStatus, SessionStatus } from "@/lib/supabase/types";

// A teacher's session with the student(s) booked into it. Read with the
// service-role client (gated by requireTeacher + an explicit teacher_id filter):
// a teacher's own token can read their sessions/bookings via the 0025 RLS, but
// NOT the customer's profile row (profiles is self/admin-only), and the teacher
// needs the student's name + timezone to run the class.
export type TeacherSessionStudent = {
  full_name: string | null;
  email: string | null;
  timezone: string;
};

export type TeacherSessionRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: SessionStatus;
  meet_link: string | null;
  meet_status: MeetStatus | null;
  is_free_trial: boolean;
  class_category: { name: string } | null;
  students: TeacherSessionStudent[];
};

export async function getTeacherSessions(teacherId: string): Promise<TeacherSessionRow[]> {
  const service = createSupabaseServiceClient();
  const { data } = await service
    .from("sessions")
    .select(
      `id, start_at, end_at, status, meet_link, meet_status, is_free_trial,
       class_category:class_categories(name),
       bookings(status, customer:profiles(full_name, email, timezone))`
    )
    .eq("teacher_id", teacherId)
    .neq("status", "cancelled")
    .order("start_at", { ascending: true })
    .limit(300);

  return (data ?? []).map((s) => ({
    id: s.id,
    start_at: s.start_at,
    end_at: s.end_at,
    status: s.status,
    meet_link: s.meet_link,
    meet_status: s.meet_status,
    is_free_trial: s.is_free_trial,
    class_category: s.class_category,
    students: (s.bookings ?? [])
      .filter((b) => b.status !== "cancelled")
      .map((b) => b.customer)
      .filter((c): c is TeacherSessionStudent => Boolean(c)),
  }));
}

/** Split into upcoming (now or later) and past, newest-first for past. */
export function splitByTime(rows: TeacherSessionRow[], nowMs: number) {
  const upcoming: TeacherSessionRow[] = [];
  const past: TeacherSessionRow[] = [];
  for (const r of rows) {
    if (new Date(r.start_at).getTime() >= nowMs) upcoming.push(r);
    else past.push(r);
  }
  past.reverse();
  return { upcoming, past };
}
