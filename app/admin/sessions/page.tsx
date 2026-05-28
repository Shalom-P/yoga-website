import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminSessionsPage() {
  await requireAdmin();
  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
            Sessions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Schedule classes — Meet links are auto-created when you save.
          </p>
        </div>
        <Button className="rounded-full">
          <Plus className="size-4 mr-1" />
          Schedule session
        </Button>
      </div>
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
        No sessions yet. The <code>sessions</code> table feeds this page.
      </div>
    </div>
  );
}
