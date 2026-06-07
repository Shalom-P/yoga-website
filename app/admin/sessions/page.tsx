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
  recording_url: string | null;
  teacher: { id: string; display_name: string } | null;
  category: { id: string; name: string } | null;
};

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ past?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { past } = await searchParams;
  const showPast = past === "1";

  // In "upcoming" mode show from 7 days ago (to catch recently-started sessions);
  // in "past" mode show everything older than that window, up to 90 days back.
  const cutoff = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const sessionQuery = supabase
    .from("sessions")
    .select(
      `id, start_at, end_at, capacity, status, is_free_trial, meet_link, meet_status, recording_url,
       teacher:teachers(id, display_name),
       category:class_categories(id, name)`
    )
    .order("start_at", { ascending: !showPast })
    .limit(200);

  if (showPast) {
    sessionQuery.lt("start_at", cutoff);
  } else {
    sessionQuery.gte("start_at", cutoff);
  }

  const [{ data: sessions }, { data: teachers }, { data: categories }] = await Promise.all([
    sessionQuery,
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
        showPast={showPast}
      />
    </div>
  );
}
