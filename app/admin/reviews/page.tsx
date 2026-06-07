import { requireAdmin } from "@/lib/auth/guards";
import { ReviewsAdmin, type ReviewRow } from "@/components/admin/ReviewsAdmin";

export default async function AdminReviewsPage() {
  const { supabase } = await requireAdmin();

  const { data: reviews } = await supabase
    .from("reviews")
    .select(
      "id, rating, body, is_featured, is_approved, display_name_override, display_location, created_at, customer_id, teacher_id, customer:profiles(id, full_name, email), teacher:teachers(id, display_name)"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div className="p-8 max-w-7xl">
      <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
        Reviews
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Approve, feature, or remove customer reviews.
      </p>
      <div className="mt-6">
        <ReviewsAdmin rows={(reviews ?? []) as unknown as ReviewRow[]} />
      </div>
    </div>
  );
}
