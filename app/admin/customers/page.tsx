import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminCustomersPage() {
  const { supabase } = await requireAdmin();
  const { data: customers } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, timezone, role, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="p-8 max-w-7xl">
      <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
        Customers
      </h1>
      <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Timezone</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(customers ?? []).map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-3">{c.full_name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.timezone}</td>
                <td className="px-4 py-3">{c.role}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("en-AU")}
                </td>
              </tr>
            ))}
            {(!customers || customers.length === 0) && (
              <tr>
                <td colSpan={5} className="text-center px-4 py-12 text-muted-foreground">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
