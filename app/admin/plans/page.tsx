import { requireAdmin } from "@/lib/auth/guards";
import { PlansAdmin } from "@/components/admin/PlansAdmin";

export default async function AdminPlansPage() {
  const { supabase } = await requireAdmin();
  const [{ data: plans }, { data: features }, { data: prices }] = await Promise.all([
    supabase.from("plans").select("*").order("sort_order"),
    supabase.from("plan_features").select("*").order("sort_order"),
    supabase.from("plan_prices").select("*"),
  ]);
  const planList = (plans ?? []).map((p) => ({
    ...p,
    features: (features ?? []).filter((f) => f.plan_id === p.id),
    prices: (prices ?? []).filter((pp) => pp.plan_id === p.id),
  }));
  return (
    <div className="p-8 max-w-6xl">
      <PlansAdmin plans={planList} />
    </div>
  );
}
