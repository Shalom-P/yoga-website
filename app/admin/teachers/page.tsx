import Link from "next/link";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/guards";
import { AddTeacherButton } from "@/components/admin/AddTeacherButton";
import { AdminPageHeader } from "@/components/admin/AdminPage";

export default async function AdminTeachersPage() {
  const { supabase } = await requireAdmin();
  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, display_name, headline, rating_avg, rating_count, is_active, is_public, sort_order")
    .order("sort_order");

  return (
    <div>
      <AdminPageHeader
        eyebrow="Catalog"
        title="Teachers"
        sub="Profiles shown on the marketing site, and the logins attached to them."
        actions={<AddTeacherButton />}
        className="mb-7"
      />

      <div className="myc-glass divide-y divide-border">
        {(teachers ?? []).map((t) => (
          <Link
            key={t.id}
            href={`/admin/teachers/${t.id}`}
            className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors"
          >
            <div className="size-10 rounded-full bg-primary/15 inline-flex items-center justify-center text-sm font-medium text-primary">
              {t.display_name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{t.display_name}</div>
              <div className="text-xs text-muted-foreground truncate">{t.headline}</div>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-sm">
              <Star className="size-3.5 fill-[var(--myc-pill-amber-fg)] text-[var(--myc-pill-amber-fg)]" />
              <span>{Number(t.rating_avg).toFixed(1)}</span>
              <span className="text-muted-foreground text-xs">· {t.rating_count}</span>
            </div>
            {/* Three states, not two: a hidden teacher is still working, just
                not advertised, and that has to be visible at a glance. */}
            <Badge variant={t.is_active ? "secondary" : "outline"}>
              {!t.is_active ? "Inactive" : t.is_public ? "Active" : "Hidden"}
            </Badge>
          </Link>
        ))}
        {(teachers ?? []).length === 0 && (
          <div className="px-5 py-12 text-center text-muted-foreground text-sm">
            No teachers yet. Click &ldquo;Add teacher&rdquo; to create one.
          </div>
        )}
      </div>
    </div>
  );
}
