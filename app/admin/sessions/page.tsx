import { requireAdmin } from "@/lib/auth/guards";
import { SessionsAdmin } from "@/components/admin/SessionsAdmin";

type SessionWithJoins = {
  id: string;
  start_at: string;
  end_at: string;
  capacity: number;
  status: "scheduled" | "live" | "completed" | "cancelled";
  is_free_trial: boolean;
  meet_link: string | null;
  meet_status: "pending" | "created" | "failed" | null;
  teacher: { id: string; display_name: string } | null;
  category: { id: string; name: string } | null;
};

export default async function AdminSessionsPage() {
  const { supabase } = await requireAdmin();
  // eslint-disable-next-line react-hooks/purity -- Server Component, runs per request
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: sessions }, { data: teachers }, { data: categories }] = await Promise.all([
    supabase
      .from("sessions")
      .select(
        `id, start_at, end_at, capacity, status, is_free_trial, meet_link, meet_status,
         teacher:teachers(id, display_name),
         category:class_categories(id, name)`
      )
      .gte("start_at", since)
      .order("start_at", { ascending: true })
      .limit(100),
    supabase
      .from("teachers")
      .select("id, display_name")
      .eq("is_active", true)
      .order("display_name"),
    supabase
      .from("class_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  return (
    <div className="p-8 max-w-7xl">
      <SessionsAdmin
        sessions={(sessions as unknown as SessionWithJoins[]) ?? []}
        teachers={teachers ?? []}
        categories={categories ?? []}
      />
    </div>
  );
}
