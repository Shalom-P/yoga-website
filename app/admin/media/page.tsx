import { requireAdmin } from "@/lib/auth/guards";
import { MediaAdmin } from "@/components/admin/MediaAdmin";

export default async function AdminMediaPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("promotional_media")
    .select("*")
    .order("created_at", { ascending: false });
  return (
    <div className="p-8 max-w-6xl">
      <MediaAdmin media={data ?? []} />
    </div>
  );
}
