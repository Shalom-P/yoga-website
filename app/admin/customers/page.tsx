import { requireAdmin } from "@/lib/auth/guards";
import { CustomersTable, type FollowUpEntry } from "@/components/admin/CustomersTable";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { isProfileComplete } from "@/lib/auth/redirects";
import {
  customerLifecycle,
  type LifecycleBooking,
  type LifecyclePayment,
} from "@/lib/admin/customerLifecycle";
import { DEFAULT_CUSTOMER_TZ, formatInTz } from "@/lib/timezone";

function groupBy<T>(rows: T[], key: (r: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  return out;
}

export default async function AdminCustomersPage() {
  const { supabase, user } = await requireAdmin();
  // The studio is small enough to read every booking, payment and note in one
  // go and work the stages out here (PostgREST caps each at its max-rows
  // setting, 1000 by default, which is far above today's volume). If the
  // follow-ups table is missing (0050 not applied yet) that query alone fails
  // and the page still renders, with an empty history.
  const [{ data: customers }, { data: credits }, { data: bookings }, { data: payments }, { data: followUps }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, email, phone, timezone, role, created_at, experience_level, goals, referral_source, marketing_opt_in"
        )
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("customer_credits").select("customer_id, balance"),
      supabase
        .from("bookings")
        .select("customer_id, status, is_free_trial, session:sessions!session_id(start_at)"),
      supabase
        .from("payments")
        .select("customer_id, created_at, amount_cents, currency")
        .eq("status", "completed"),
      supabase
        .from("customer_follow_ups")
        .select("id, customer_id, channel, note, next_follow_up_on, created_at, author:profiles!author_id(full_name)")
        .order("created_at", { ascending: false }),
    ]);

  const balances = new Map((credits ?? []).map((c) => [c.customer_id, c.balance]));
  const bookingsBy = groupBy(bookings ?? [], (b) => b.customer_id);
  const paymentsBy = groupBy(payments ?? [], (p) => p.customer_id);
  const followUpsBy = groupBy(followUps ?? [], (f) => f.customer_id);

  const now = new Date();
  const today = formatInTz(now, DEFAULT_CUSTOMER_TZ, "yyyy-MM-dd");

  const rows = (customers ?? []).map((c) => {
    const balance = balances.get(c.id) ?? 0;
    const history: FollowUpEntry[] = (followUpsBy.get(c.id) ?? []).map((f) => ({
      id: f.id,
      channel: f.channel,
      note: f.note,
      next_follow_up_on: f.next_follow_up_on,
      created_at: f.created_at,
      author: f.author?.full_name ?? null,
    }));
    const lifecycle = customerLifecycle(
      {
        role: c.role,
        profileComplete: isProfileComplete(c),
        credits: balance,
        bookings: (bookingsBy.get(c.id) ?? []).map(
          (b): LifecycleBooking => ({
            status: b.status,
            is_free_trial: b.is_free_trial,
            start_at: b.session?.start_at ?? null,
          })
        ),
        payments: (paymentsBy.get(c.id) ?? []) as LifecyclePayment[],
        followUps: history,
      },
      now,
      today
    );
    return { ...c, credits: balance, lifecycle, history };
  });

  return (
    <div>
      <AdminPageHeader
        eyebrow="People"
        title="Customers"
        sub="Where everyone stands and who to contact next. Log each follow-up so the next person knows what was said."
      />
      <div className="mt-6">
        <CustomersTable rows={rows} adminId={user.id} today={today} />
      </div>
    </div>
  );
}
