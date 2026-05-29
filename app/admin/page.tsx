import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { Users, Calendar, TrendingUp, Video } from "lucide-react";
import { formatAud } from "@/lib/i18n/money";
import { formatCustomerTime } from "@/lib/timezone";

type Kpis = {
  signups_today: number;
  trials_today: number;
  paid_active_subs: number;
  mrr_aud_cents: number;
};

type UpcomingSession = {
  id: string;
  start_at: string;
  meet_link: string | null;
  teacher: { display_name: string } | null;
};

type ActivityRow = { id: string; action: string; entity_type: string; created_at: string };

export default async function AdminDashboard() {
  const { user, supabase } = await requireAdmin();

  // Pull live data in parallel. Each is wrapped so a single failure (e.g. a
  // missing grant in a half-migrated env) degrades to a placeholder instead of
  // 500-ing the whole admin overview.
  const nowIso = new Date().toISOString();
  const [kpiRes, sessionsRes, activityRes] = await Promise.allSettled([
    supabase.rpc("admin_kpis"),
    supabase
      .from("sessions")
      .select("id, start_at, meet_link, teacher:teachers(display_name)")
      .gte("start_at", nowIso)
      .in("status", ["scheduled", "live"])
      .order("start_at", { ascending: true })
      .limit(6),
    supabase
      .from("audit_log")
      .select("id, action, entity_type, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const kpis: Kpis | null =
    kpiRes.status === "fulfilled" && kpiRes.value.data
      ? (kpiRes.value.data as unknown as Kpis)
      : null;
  const upcoming: UpcomingSession[] =
    sessionsRes.status === "fulfilled"
      ? ((sessionsRes.value.data as unknown as UpcomingSession[]) ?? [])
      : [];
  const activity: ActivityRow[] =
    activityRes.status === "fulfilled"
      ? ((activityRes.value.data as unknown as ActivityRow[]) ?? [])
      : [];

  const stats = [
    { label: "Signups today", value: kpis ? String(kpis.signups_today) : "—", icon: Users },
    { label: "Trials today", value: kpis ? String(kpis.trials_today) : "—", icon: Calendar },
    {
      label: "Active subscriptions",
      value: kpis ? String(kpis.paid_active_subs) : "—",
      icon: TrendingUp,
    },
    {
      label: "MRR (AUD)",
      value: kpis ? formatAud(kpis.mrr_aud_cents) : "—",
      icon: Video,
    },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
        Admin
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Signed in as {user.email}</p>

      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </span>
              <stat.icon className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-3 text-3xl font-[family-name:var(--font-heading)]">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Upcoming sessions</h2>
            <Link href="/admin/sessions" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No upcoming sessions scheduled.{" "}
              <Link href="/admin/sessions" className="text-primary hover:underline">
                Schedule one
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {upcoming.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {s.teacher?.display_name ?? "Teacher"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatCustomerTime(s.start_at)}
                    </div>
                  </div>
                  {s.meet_link ? (
                    <a
                      href={s.meet_link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline shrink-0"
                    >
                      <Video className="size-3.5" />
                      Join
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground shrink-0">link soon</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-medium">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing logged yet. Webhook events and admin actions show up here.
            </p>
          ) : (
            <ul className="mt-4 space-y-2.5 text-sm">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    <span className="font-medium">{a.action}</span>{" "}
                    <span className="text-muted-foreground">· {a.entity_type}</span>
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatCustomerTime(a.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
