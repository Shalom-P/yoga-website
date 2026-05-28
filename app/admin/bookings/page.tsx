import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminBookingsPage() {
  await requireAdmin();
  return (
    <div className="p-8 max-w-7xl">
      <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
        Bookings
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        All upcoming and past bookings across customers.
      </p>
      <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
        DataTable of <code>bookings</code> joined to <code>profiles</code> +{" "}
        <code>sessions</code> goes here. Bulk no-show action.
      </div>
    </div>
  );
}
