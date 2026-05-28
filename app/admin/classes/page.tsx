import { requireAdmin } from "@/lib/auth/guards";
import { ClassesAdmin } from "@/components/admin/ClassesAdmin";

export default async function AdminClassesPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("class_categories")
    .select("*")
    .order("sort_order");
  return (
    <div className="p-8 max-w-5xl">
      <ClassesAdmin categories={data ?? []} />
    </div>
  );
}
