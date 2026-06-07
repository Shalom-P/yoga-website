import { requireAdmin } from "@/lib/auth/guards";
import { CustomersTable } from "@/components/admin/CustomersTable";

export default async function AdminCustomersPage() {
  const { supabase } = await requireAdmin();
  const { data: customers } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, timezone, role, created_at, experience_level, goals, referral_source, marketing_opt_in"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="p-8 max-w-7xl">
      <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
        Customers
      </h1>
      <div className="mt-6">
        <CustomersTable rows={customers ?? []} />
      </div>
    </div>
  );
}
