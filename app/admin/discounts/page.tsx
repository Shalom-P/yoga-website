import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminDiscountsPage() {
  await requireAdmin();
  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
          Discount codes
        </h1>
        <Button className="rounded-full">
          <Plus className="size-4 mr-1" />
          New code
        </Button>
      </div>
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
        No discount codes yet. <code>discount_codes</code> table CRUD goes here.
      </div>
    </div>
  );
}
