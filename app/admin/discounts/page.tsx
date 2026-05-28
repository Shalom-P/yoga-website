import { requireAdmin } from "@/lib/auth/guards";
import { DiscountsAdmin } from "@/components/admin/DiscountsAdmin";

export default async function AdminDiscountsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: discounts }, { data: plans }] = await Promise.all([
    supabase.from("discount_codes").select("*").order("created_at", { ascending: false }),
    supabase.from("plans").select("id, name").eq("is_active", true).order("sort_order"),
  ]);
  return (
    <div className="p-8 max-w-6xl">
      <DiscountsAdmin discounts={discounts ?? []} plans={plans ?? []} />
    </div>
  );
}
