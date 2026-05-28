import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/guards";
import { getClassCategories } from "@/lib/data/landing";

export default async function AdminClassesPage() {
  await requireAdmin();
  const cats = await getClassCategories();
  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
          Class categories
        </h1>
        <Button className="rounded-full">
          <Plus className="size-4 mr-1" />
          Add category
        </Button>
      </div>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {cats.map((c) => (
          <div key={c.id} className="flex items-center gap-4 px-5 py-4">
            <div className="flex-1">
              <div className="font-medium">{c.name}</div>
              <div className="text-sm text-muted-foreground">{c.description}</div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              {c.intensity}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
