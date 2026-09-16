import { requireAdmin } from "@/lib/auth/guards";
import { BookingsAdmin, type BookingRow, type MoveTarget } from "@/components/admin/BookingsAdmin";
import type { BookingStatus } from "@/lib/supabase/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 50;

const BOOKING_STATUSES: BookingStatus[] = ["confirmed", "cancelled", "attended", "no_show"];

// PostgREST's `or` filter is a mini-DSL: a comma or a paren breaks the grammar,
// and %, _ and * are ilike wildcards. Same allow-list as the customer-search
// route (app/api/admin/customers/route.ts) so the two agree on what "Priya (UK)"
// searches for. Anything outside it is dropped rather than escaped.
const SAFE_Q = /[^A-Za-z0-9@._\-+' ]/g;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SearchParams = {
  page?: string;
  q?: string;
  status?: string;
  customer?: string;
  session?: string;
};

/**
 * The bookings queue. Filtering happens in Postgres, not in the browser:
 * the previous version searched the 50 rows of page 1 client-side, so looking
 * for a customer whose booking sat on page 2 silently returned nothing.
 */
export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const q = (sp.q ?? "").replace(SAFE_Q, "").trim().slice(0, 120);
  const status = BOOKING_STATUSES.includes(sp.status as BookingStatus)
    ? (sp.status as BookingStatus)
    : "";
  const customerId = sp.customer && UUID_RE.test(sp.customer) ? sp.customer : "";
  const sessionId = sp.session && UUID_RE.test(sp.session) ? sp.session : "";

  // A name search has to resolve profile ids first: PostgREST cannot filter on
  // an embedded resource, so `customer.full_name=ilike.*x*` would be ignored
  // rather than rejected. An empty result here is a real "nobody matches", and
  // is fed through as an impossible id filter so the page renders zero rows
  // instead of every row.
  let matchedCustomerIds: string[] | null = null;
  if (q) {
    const { data: matches } = await supabase
      .from("profiles")
      .select("id")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(200);
    matchedCustomerIds = (matches ?? []).map((m) => m.id);
  }

  // Filters go on before order/range: `.order()` narrows the builder to the
  // transform stage, which no longer accepts `.eq()`.
  let query = supabase
    .from("bookings")
    .select(
      `id, status, is_free_trial, comped, credit_refunded, moved_from_session_id,
       cancellation_reason, created_at,
       customer:profiles(id, full_name, email),
       session:sessions(id, start_at, capacity, status, teacher:teachers(id, display_name))`,
      { count: "exact" },
    );

  if (status) query = query.eq("status", status);
  if (customerId) query = query.eq("customer_id", customerId);
  if (sessionId) query = query.eq("session_id", sessionId);
  if (matchedCustomerIds) {
    query = query.in(
      "customer_id",
      matchedCustomerIds.length > 0 ? matchedCustomerIds : ["00000000-0000-0000-0000-000000000000"],
    );
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  const rows: BookingRow[] = data ?? [];

  // Candidate classes for the Move action. Same id-collect + .in() + Map shape
  // as the payments page: a nested bookings embed would pull every booking row
  // of every upcoming session just to count them.
  const nowIso = new Date().toISOString();
  const { data: upcoming } = await supabase
    .from("sessions")
    .select("id, start_at, capacity, teacher:teachers(id, display_name)")
    .eq("status", "scheduled")
    .gte("start_at", nowIso)
    .order("start_at", { ascending: true })
    .limit(60);

  const upcomingIds = (upcoming ?? []).map((s) => s.id);
  const liveBySession = new Map<string, number>();
  if (upcomingIds.length > 0) {
    const { data: liveBookings } = await supabase
      .from("bookings")
      .select("session_id, status")
      .in("session_id", upcomingIds)
      .neq("status", "cancelled");
    for (const b of liveBookings ?? []) {
      liveBySession.set(b.session_id, (liveBySession.get(b.session_id) ?? 0) + 1);
    }
  }

  const moveTargets: MoveTarget[] = (upcoming ?? []).map((s) => ({
    id: s.id,
    startAt: s.start_at,
    teacherName: s.teacher?.display_name ?? "Unassigned",
    live: liveBySession.get(s.id) ?? 0,
    capacity: s.capacity,
  }));

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  // Filters have to survive paging, otherwise Next drops the operator back into
  // an unfiltered page 2 of everything.
  function pageHref(next: number): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (customerId) params.set("customer", customerId);
    if (sessionId) params.set("session", sessionId);
    if (next > 1) params.set("page", String(next));
    const qs = params.toString();
    return qs ? `/admin/bookings?${qs}` : "/admin/bookings";
  }

  return (
    <div>
      <BookingsAdmin
        rows={rows}
        moveTargets={moveTargets}
        filters={{ q, status, customer: customerId, session: sessionId }}
        total={count ?? rows.length}
      />
      {totalPages > 1 && (
        <div className="mt-6 flex items-center gap-3">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageHref(page - 1)}>← Previous</Link>
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
            {count != null && ` · ${count} total`}
          </span>
          {page < totalPages && (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageHref(page + 1)}>Next →</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
