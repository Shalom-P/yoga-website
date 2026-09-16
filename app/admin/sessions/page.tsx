import { requireAdmin } from "@/lib/auth/guards";
import {
  SessionsAdmin,
  type AdminSessionRow,
  type SessionFilters,
} from "@/components/admin/SessionsAdmin";
import type { RosterEntry, RosterSession } from "@/components/admin/SessionRosterDrawer";
import type { MoveTarget } from "@/components/admin/MoveBookingDialog";
import type { SessionStatus } from "@/lib/supabase/types";

const SESSION_STATUSES: SessionStatus[] = ["scheduled", "live", "completed", "cancelled"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The joins the session table and the roster header both need. */
const SESSION_SELECT = `id, start_at, end_at, capacity, status, is_free_trial, meet_link, meet_status,
   recording_url, notes, teacher_id, class_category_id,
   teacher:teachers(id, display_name),
   category:class_categories(id, name)`;

type SearchParams = {
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

  const showPast = sp.past === "1";
  const teacherFilter = sp.teacher && UUID_RE.test(sp.teacher) ? sp.teacher : "";
  const statusFilter: SessionStatus | "" = SESSION_STATUSES.includes(sp.status as SessionStatus)
    ? (sp.status as SessionStatus)
    : "";
  const openSessionId = sp.session && UUID_RE.test(sp.session) ? sp.session : "";

  // In "upcoming" mode show from 7 days ago (to catch recently-started sessions);
  // in "past" mode show everything older than that window, up to 90 days back.
  const cutoff = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  let sessionQuery = supabase
    .from("sessions")
    .select(SESSION_SELECT)
    .order("start_at", { ascending: !showPast })
    .limit(200);

  if (showPast) sessionQuery = sessionQuery.lt("start_at", cutoff);
  else sessionQuery = sessionQuery.gte("start_at", cutoff);
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
    past: showPast,
    teacher: teacherFilter,
    status: statusFilter,
  };

  return (
    <div>
      <SessionsAdmin
        sessions={rows}
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
