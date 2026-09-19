import { requireAdmin } from "@/lib/auth/guards";
import {
  SessionsAdmin,
  type AdminSessionRow,
  type SessionFilters,
  type SessionView,
} from "@/components/admin/SessionsAdmin";
import type { RosterEntry, RosterSession } from "@/components/admin/SessionRosterDrawer";
import type { MoveTarget } from "@/components/admin/MoveBookingDialog";
import type { SessionStatus } from "@/lib/supabase/types";

const SESSION_STATUSES: SessionStatus[] = ["scheduled", "live", "completed", "cancelled"];

const SESSION_VIEWS: SessionView[] = ["upcoming", "archived", "all"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The joins the session table and the roster header both need. */
const SESSION_SELECT = `id, start_at, end_at, capacity, status, is_free_trial, meet_link, meet_status,
   recording_url, notes, teacher_id, class_category_id,
   teacher:teachers(id, display_name),
   category:class_categories(id, name)`;

type SearchParams = {
  /** "upcoming" (default), "archived", or "all". */
  view?: string;
  /** Legacy toggle: ?past=1 was the old archived view. Kept so old links land. */
  past?: string;
  /** Session id whose roster drawer should be open. */
  session?: string;
  teacher?: string;
  status?: string;
};

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;

  const view: SessionView = SESSION_VIEWS.includes(sp.view as SessionView)
    ? (sp.view as SessionView)
    : sp.past === "1"
      ? "archived"
      : "upcoming";
  const teacherFilter = sp.teacher && UUID_RE.test(sp.teacher) ? sp.teacher : "";
  const statusFilter: SessionStatus | "" = SESSION_STATUSES.includes(sp.status as SessionStatus)
    ? (sp.status as SessionStatus)
    : "";
  const openSessionId = sp.session && UUID_RE.test(sp.session) ? sp.session : "";

  const nowIso = new Date().toISOString();

  // A session archives itself the moment its END time passes, the same boundary
  // splitByTime() uses in lib/teacher/sessions.ts: a class that has started but
  // not yet finished is still today's work, not history. There is no archived
  // column - the clock is the only thing that decides, so nothing can drift out
  // of sync with the schedule.
  let sessionQuery = supabase
    .from("sessions")
    .select(SESSION_SELECT)
    .order("start_at", { ascending: view === "upcoming" })
    .limit(200);

  if (view === "upcoming") sessionQuery = sessionQuery.gte("end_at", nowIso);
  else if (view === "archived") sessionQuery = sessionQuery.lt("end_at", nowIso);
  if (teacherFilter) sessionQuery = sessionQuery.eq("teacher_id", teacherFilter);
  if (statusFilter) sessionQuery = sessionQuery.eq("status", statusFilter);

  const [{ data: sessions }, { data: teachers }, { data: categories }] = await Promise.all([
    sessionQuery,
    // The is_active filter stays: a deactivated teacher must not be offered for
    // a new class. The edit dialog re-adds the one a session already sits on,
    // so an existing class is never silently rewritten to somebody else.
    supabase.from("teachers").select("id, display_name").eq("is_active", true).order("display_name"),
    // No is_active filter here, and is_active is selected instead. A session
    // sitting on one of the eight categories retired by 0023 has to stay
    // displayable and re-selectable; the create dialog filters those back out.
    supabase.from("class_categories").select("id, name, is_active").order("sort_order"),
  ]);

  const sessionRows = sessions ?? [];

  // The roster drawer's own data. Kept off the first round trip because it only
  // exists when ?session= is set, and folding it in would mean a union-typed
  // Promise.all for the sake of one saved hop on the rare path.
  const [{ data: openSessionRow }, { data: rosterRows }, { data: upcoming }] = openSessionId
    ? await Promise.all([
        supabase.from("sessions").select(SESSION_SELECT).eq("id", openSessionId).maybeSingle(),
        supabase
          .from("bookings")
          .select(
            `id, status, is_free_trial, comped, credit_refunded, moved_from_session_id,
             cancellation_reason, created_at,
             customer:profiles(id, full_name, email, timezone)`,
          )
          .eq("session_id", openSessionId)
          .order("created_at", { ascending: true }),
        // Move destinations are always the upcoming scheduled classes, whichever
        // window the table itself is showing: moving a student into a class that
        // has already run is never what anyone means.
        supabase
          .from("sessions")
          .select("id, start_at, capacity, teacher:teachers(id, display_name)")
          .eq("status", "scheduled")
          .gte("start_at", nowIso)
          .order("start_at", { ascending: true })
          .limit(60),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  // One scoped count query for every session on screen, the id-collect + .in() +
  // Map shape from app/admin/payments/page.tsx. A nested bookings embed would
  // pull every booking row of all 200 sessions just to produce a number.
  const countIds = [
    ...new Set([
      ...sessionRows.map((s) => s.id),
      ...(upcoming ?? []).map((s) => s.id),
      ...(openSessionRow ? [openSessionRow.id] : []),
    ]),
  ];
  const liveBySession = new Map<string, number>();
  if (countIds.length > 0) {
    const { data: liveBookings } = await supabase
      .from("bookings")
      .select("session_id, status")
      .in("session_id", countIds)
      .neq("status", "cancelled")
      .limit(5000);
    for (const b of liveBookings ?? []) {
      liveBySession.set(b.session_id, (liveBySession.get(b.session_id) ?? 0) + 1);
    }
  }

  const rows: AdminSessionRow[] = sessionRows.map((s) => ({
    ...s,
    live_count: liveBySession.get(s.id) ?? 0,
  }));

  const rosterSession: RosterSession | null = openSessionRow
    ? {
        id: openSessionRow.id,
        start_at: openSessionRow.start_at,
        end_at: openSessionRow.end_at,
        capacity: openSessionRow.capacity,
        status: openSessionRow.status,
        is_free_trial: openSessionRow.is_free_trial,
        meet_link: openSessionRow.meet_link,
        meet_status: openSessionRow.meet_status,
        teacher_name: openSessionRow.teacher?.display_name ?? null,
        category_name: openSessionRow.category?.name ?? null,
        live_count: liveBySession.get(openSessionRow.id) ?? 0,
      }
    : null;

  const roster: RosterEntry[] = rosterRows ?? [];

  const moveTargets: MoveTarget[] = (upcoming ?? []).map((s) => ({
    id: s.id,
    startAt: s.start_at,
    teacherName: s.teacher?.display_name ?? "Unassigned",
    live: liveBySession.get(s.id) ?? 0,
    capacity: s.capacity,
  }));

  const filters: SessionFilters = {
    view,
    teacher: teacherFilter,
    status: statusFilter,
  };

  return (
    <div>
      <SessionsAdmin
        sessions={rows}
        nowMs={Date.parse(nowIso)}
        teachers={teachers ?? []}
        categories={categories ?? []}
        filters={filters}
        rosterSession={rosterSession}
        roster={roster}
        moveTargets={moveTargets}
      />
    </div>
  );
}
