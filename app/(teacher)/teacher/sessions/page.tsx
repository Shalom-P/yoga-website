import { CalendarDays, Video } from "lucide-react";
import { requireTeacher } from "@/lib/auth/guards";
import {
  getTeacherSessions,
  splitByTime,
  type TeacherSessionRow,
} from "@/lib/teacher/sessions";
import { formatInTz, formatTeacherTime } from "@/lib/timezone";
import { cn } from "@/lib/utils";

export default async function TeacherSchedulePage() {
  const { user, supabase } = await requireTeacher();
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  const rows = teacher ? await getTeacherSessions(teacher.id) : [];
  const { upcoming, past } = splitByTime(rows, new Date().getTime());

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <header>
        <h1 className="text-3xl font-[family-name:var(--font-heading)] tracking-tight">
          My schedule
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Session times are in IST; each student&apos;s local time is shown so you
          can confirm the overlap. Booking changes are handled by the studio admin.
        </p>
      </header>

      <SessionTable title="Upcoming" rows={upcoming} emptyLabel="No upcoming sessions." showJoin />
      <SessionTable title="Past" rows={past} emptyLabel="No past sessions yet." />
    </div>
  );
}

function durationMin(start: string, end: string) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

function StatusPill({ row }: { row: TeacherSessionRow }) {
  if (row.status === "completed")
    return <span className="myc-pill myc-pill-teal">Completed</span>;
  if (row.is_free_trial)
    return <span className="myc-pill myc-pill-free">Free trial</span>;
  return <span className="myc-pill myc-pill-green">Confirmed</span>;
}

function SessionTable({
  title,
  rows,
  emptyLabel,
  showJoin = false,
}: {
  title: string;
  rows: TeacherSessionRow[];
  emptyLabel: string;
  showJoin?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-[family-name:var(--font-heading)] tracking-tight mb-3">
          {title}
        </h2>
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <CalendarDays className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-[family-name:var(--font-heading)] tracking-tight mb-3">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr>
                <Th>When (IST)</Th>
                <Th>Student</Th>
                <Th>Student&apos;s local time</Th>
                <Th>Session</Th>
                <Th>Status</Th>
                {showJoin && <Th className="text-right" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const student = r.students[0] ?? null;
                return (
                  <tr key={r.id}>
                    <Td>
                      <strong className="font-semibold text-foreground">
                        {formatTeacherTime(r.start_at)}
                      </strong>
                      <div className="text-xs text-muted-foreground">
                        {durationMin(r.start_at, r.end_at)} min
                      </div>
                    </Td>
                    <Td className="text-foreground">
                      {student?.full_name ?? "-"}
                      {r.students.length > 1 && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          +{r.students.length - 1}
                        </span>
                      )}
                    </Td>
                    <Td>
                      {student ? (
                        <>
                          {formatInTz(r.start_at, student.timezone, "EEE d MMM, h:mm a")}
                          <div className="text-xs text-muted-foreground">
                            {student.timezone}
                          </div>
                        </>
                      ) : (
                        "-"
                      )}
                    </Td>
                    <Td className="text-foreground">
                      {r.class_category?.name ?? "Yoga session"}
                    </Td>
                    <Td>
                      <StatusPill row={r} />
                    </Td>
                    {showJoin && (
                      <Td className="text-right">
                        {r.meet_link ? (
                          <a
                            href={r.meet_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center gap-1 rounded-full bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
                          >
                            <Video className="size-3.5" />
                            Join
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {r.meet_status === "failed" ? "Link retrying" : "Link soon"}
                          </span>
                        )}
                      </Td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "bg-background px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
        className
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={cn("border-t border-border px-5 py-3 align-middle text-muted-foreground", className)}>
      {children}
    </td>
  );
}
