import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminMediaPage() {
  await requireAdmin();
  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
          Promotional media
        </h1>
        <Button className="rounded-full">
          <Upload className="size-4 mr-1" />
          Upload
        </Button>
      </div>
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
        Drag-and-drop uploads to Supabase Storage bucket <code>promotional-media</code>.
        Wire <code>promotional_media</code> table rows with placement + active window.
      </div>
    </div>
  );
}
