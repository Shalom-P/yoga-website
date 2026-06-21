import Link from "next/link";
import { ArrowRight, CalendarRange, Video, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireTeacher } from "@/lib/auth/guards";
import { getTeacherSessions, splitByTime } from "@/lib/teacher/sessions";
import { formatTeacherTime, formatInTz } from "@/lib/timezone";

export default async function TeacherHome() {
  const { user, supabase } = await requireTeacher();
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, display_name")
    .eq("profile_id", user.id)
    .single();

  const rows = teacher ? await getTeacherSessions(teacher.id) : [];
  const { upcoming } = splitByTime(rows, new Date().getTime());
  const next = upcoming[0] ?? null;
  const firstName = teacher?.display_name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium">
          Teacher dashboard
        </div>
        <h1 className="text-3xl md:text-4xl font-[family-name:var(--font-heading)] tracking-tight mt-1">
          Namaste, {firstName}.
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Your times are shown in IST. Each student&apos;s own local time is shown
          alongside so you can see the overlap.
        </p>
      </header>

      <NextSessionCard next={next} upcomingCount={upcoming.length} />

      <div className="grid sm:grid-cols-2 gap-5">
        <Link
          href="/teacher/availability"
          className="rounded-2xl border border-border bg-card p-6 hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          <CalendarRange className="size-6 text-primary mb-3" />
          <div className="font-medium">Manage availability</div>
          <div className="text-sm text-muted-foreground mt-1">
            Set your weekly windows and block off specific dates.
          </div>
        </Link>
        <Link
          href="/teacher/sessions"
          className="rounded-2xl border border-border bg-card p-6 hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          <Users className="size-6 text-primary mb-3" />
          <div className="font-medium">My schedule</div>
          <div className="text-sm text-muted-foreground mt-1">
            See every upcoming and past session with your students.
          </div>
        </Link>
      </div>
    </div>
  );
}

function NextSessionCard({
  next,
  upcomingCount,
}: {
  next: Awaited<ReturnType<typeof getTeacherSessions>>[number] | null;
  upcomingCount: number;
}) {
  if (!next) {
    return (
      <div className="rounded-3xl bg-card border border-border p-7">
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">
          Your next session
        </div>
        <h2 className="text-2xl font-[family-name:var(--font-heading)]">
          No upcoming sessions.
        </h2>
        <p className="mt-2 text-muted-foreground">
          When a student books a time inside your availability, it&apos;ll show up
          here. Keep your availability up to date so students can find you.
        </p>
        <div className="mt-6">
          <Button asChild size="lg" className="h-11 rounded-full">
            <Link href="/teacher/availability">
              Update availability
              <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const student = next.students[0] ?? null;
  return (
    <div className="rounded-3xl bg-card border border-border p-7">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium">
          Your next session
        </div>
        {upcomingCount > 1 && (
          <span className="text-xs text-muted-foreground">
            +{upcomingCount - 1} more upcoming
          </span>
        )}
      </div>
      <h2 className="mt-3 text-2xl font-[family-name:var(--font-heading)]">
        {student?.full_name ?? "Student"}
        {next.is_free_trial ? " · Free 1:1 trial" : ""}
      </h2>
      <p className="mt-2 text-muted-foreground">
        {formatTeacherTime(next.start_at)}
      </p>
      {student && (
        <p className="mt-0.5 text-sm text-muted-foreground">
          Student&apos;s local time:{" "}
          {formatInTz(next.start_at, student.timezone, "EEE d MMM, h:mm a")} (
          {student.timezone})
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        {next.meet_link ? (
          <Button asChild size="lg" className="h-11 rounded-full">
            <a href={next.meet_link} target="_blank" rel="noreferrer">
              <Video className="size-4 mr-1" />
              Join on Google Meet
            </a>
          </Button>
        ) : (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Video className="size-3.5" />
            {next.meet_status === "failed"
              ? "Meet link unavailable — it's being retried."
              : "Meet link will be ready shortly."}
          </span>
        )}
        <Button asChild variant="outline" size="lg" className="h-11 rounded-full">
          <Link href="/teacher/sessions">View full schedule</Link>
        </Button>
      </div>
    </div>
  );
}
