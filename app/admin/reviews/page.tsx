import { requireAdmin } from "@/lib/auth/guards";
import { ReviewsAdmin, type ReviewRow } from "@/components/admin/ReviewsAdmin";
import { AdminPageHeader } from "@/components/admin/AdminPage";

export default async function AdminReviewsPage() {
  const { supabase } = await requireAdmin();

  const { data: reviews } = await supabase
    .from("reviews")
    .select(
      "id, rating, body, is_featured, is_approved, display_name_override, display_location, created_at, customer_id, teacher_id, customer:profiles(id, full_name, email), teacher:teachers(id, display_name)"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows: ReviewRow[] = reviews ?? [];

  return (
    <div>
      <AdminPageHeader
        eyebrow="Catalog"
        title="Reviews"
        sub="Approve, feature, or remove customer reviews."
      />
      <div className="mt-6">
        <ReviewsAdmin rows={rows} />
      </div>
    </div>
  );
}
