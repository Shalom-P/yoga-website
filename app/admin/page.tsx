import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { Users, Calendar, TrendingUp, Video, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/i18n/money";
import { formatCustomerTime, formatInTz, tzShort, DEFAULT_CUSTOMER_TZ } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/lib/supabase/types";

type Kpis = {
  signups_today: number;
  trials_today: number;
  // Month-to-date completed revenue keyed by currency, e.g. { INR: 750000, AED: 35000 }.
  revenue_mtd_by_currency: Record<string, number>;
};

type UpcomingSession = {
  id: string;
  start_at: string;
  end_at: string;
  meet_link: string | null;
  teacher: { display_name: string } | null;
  class_category: { name: string } | null;
};

type ActivityRow = { id: string; action: string; entity_type: string; created_at: string };

type RecentBooking = {
  id: string;
  status: BookingStatus;
  is_free_trial: boolean;
  customer: { full_name: string | null } | null;
  session: { start_at: string; teacher: { display_name: string } | null } | null;
};

function durationMin(start: string, end: string) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

export default async function AdminDashboard() {
  const { user, supabase } = await requireAdmin();

  // Pull live data in parallel. Each is wrapped so a single failure (e.g. a
  // missing grant in a half-migrated env) degrades to a placeholder instead of
  // 500-ing the whole admin overview.
  const nowIso = new Date().toISOString();
  const [kpiRes, sessionsRes, activityRes, bookingsRes] = await Promise.allSettled([
    supabase.rpc("admin_kpis"),
    supabase
      .from("sessions")
      .select(
        "id, start_at, end_at, meet_link, teacher:teachers(display_name), class_category:class_categories(name)"
      )
      .gte("start_at", nowIso)
      .in("status", ["scheduled", "live"])
      .order("start_at", { ascending: true })
      .limit(5),
    supabase
      .from("audit_log")
      .select("id, action, entity_type, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("bookings")
      .select(
        `id, status, is_free_trial,
         customer:profiles(full_name),
         session:sessions(start_at, teacher:teachers(display_name))`
      )
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const kpis: Kpis | null =
    kpiRes.status === "fulfilled" && kpiRes.value.data ? kpiRes.value.data : null;
  const upcoming: UpcomingSession[] =
    sessionsRes.status === "fulfilled" ? (sessionsRes.value.data ?? []) : [];
  const activity: ActivityRow[] =
    activityRes.status === "fulfilled" ? (activityRes.value.data ?? []) : [];
  const recentBookings: RecentBooking[] =
    bookingsRes.status === "fulfilled" ? (bookingsRes.value.data ?? []) : [];

  const stats = [
    {
      label: "Signups today",
      value: kpis ? String(kpis.signups_today) : "—",
      icon: Users,
      highlight: true,
      note: "new accounts today",
    },
    {
      label: "Trials today",
      value: kpis ? String(kpis.trials_today) : "—",
      icon: Calendar,
      highlight: true,
      note: "free 1:1s booked",
    },
    {
      label: "Revenue MTD (INR)",
      value: kpis ? formatMoney(kpis.revenue_mtd_by_currency?.INR ?? 0, "INR") : "—",
      icon: TrendingUp,
      highlight: true,
      note: "India, this month",
    },
    {
      label: "Revenue MTD (AED)",
      value: kpis ? formatMoney(kpis.revenue_mtd_by_currency?.AED ?? 0, "AED") : "—",
      icon: Video,
      highlight: true,
      note: "UAE, this month",
    },
  ];

  const today = formatInTz(nowIso, DEFAULT_CUSTOMER_TZ, "EEEE, d MMMM");

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-cormorant)] text-3xl md:text-4xl tracking-tight">
            Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as {user.email} · {today}
          </p>
        </div>
        <Button asChild className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/admin/sessions">
            <Plus className="size-4" />
            Schedule a session
          </Link>
        </Button>
      </div>

      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                {stat.label}
              </span>
              <stat.icon className="size-4 text-muted-foreground" />
            </div>
            <div
              className={cn(
                "mt-3 font-[family-name:var(--font-cormorant)] text-[2.4rem] leading-none",
                stat.highlight && "italic text-accent"
              )}
            >
              {stat.value}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{stat.note}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-cormorant)] text-xl">Upcoming sessions</h2>
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
            <ul className="mt-4">
              {upcoming.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-0"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="size-8 shrink-0 rounded-full bg-gradient-to-br from-accent/40 to-accent" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {s.teacher?.display_name ?? "Teacher"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.class_category?.name ?? "Session"} ·{" "}
                        {durationMin(s.start_at, s.end_at)} min ·{" "}
                        {formatInTz(s.start_at, DEFAULT_CUSTOMER_TZ, "h:mm a")}
                      </div>
                    </div>
                  </div>
                  {s.meet_link ? (
                    <a
                      href={s.meet_link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      <Video className="size-3.5" />
                      Join
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">link soon</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-[family-name:var(--font-cormorant)] text-xl">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing logged yet. Webhook events and admin actions show up here.
            </p>
          ) : (
            <ul className="mt-4">
              {activity.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0"
                >
                  <span className="truncate">
                    <span className="font-medium text-foreground">{a.action}</span>{" "}
                    <span className="text-muted-foreground">· {a.entity_type}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatCustomerTime(a.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="font-[family-name:var(--font-cormorant)] text-xl">Recent bookings</h2>
          <Button asChild size="sm" className="rounded-full bg-accent text-white hover:bg-accent/90">
            <Link href="/admin/bookings">All bookings →</Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Teacher</Th>
                <Th>When ({tzShort(DEFAULT_CUSTOMER_TZ)})</Th>
                <Th>Type</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="border-t border-border px-5 py-8 text-center text-sm text-muted-foreground"
                  >
                    No bookings yet.
                  </td>
                </tr>
              ) : (
                recentBookings.map((b) => (
                  <tr key={b.id}>
                    <Td>
                      <strong className="font-semibold text-foreground">
                        {b.customer?.full_name ?? "—"}
                      </strong>
                    </Td>
                    <Td>{b.session?.teacher?.display_name ?? "—"}</Td>
                    <Td>
                      {b.session
                        ? formatInTz(b.session.start_at, DEFAULT_CUSTOMER_TZ, "EEE · h:mm a")
                        : "—"}
                    </Td>
                    <Td>
                      {b.is_free_trial ? (
                        <span className="myc-pill myc-pill-free">Free trial</span>
                      ) : (
                        <span className="myc-pill myc-pill-teal">Paid</span>
                      )}
                    </Td>
                    <Td>
                      <BookingStatusPill status={b.status} />
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BookingStatusPill({ status }: { status: BookingStatus }) {
  if (status === "cancelled") return <span className="myc-pill myc-pill-gray">Cancelled</span>;
  if (status === "no_show") return <span className="myc-pill myc-pill-gray">No-show</span>;
  if (status === "attended") return <span className="myc-pill myc-pill-teal">Attended</span>;
  return <span className="myc-pill myc-pill-green">Confirmed</span>;
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="bg-background px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </th>
  );
}

function Td({ children }: { children?: React.ReactNode }) {
  return (
    <td className="border-t border-border px-5 py-3 align-middle text-muted-foreground">
      {children}
    </td>
  );
}
