import { TestimonialWall } from "@/components/marketing/TestimonialWall";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { getFeaturedReviews } from "@/lib/data/landing";

export const revalidate = 60;
export const metadata = { title: "Reviews", description: "What Australian students say about practising with us." };

export default async function ReviewsPage() {
  const reviews = await getFeaturedReviews();
  return (
    <>
      <section className="pt-32 pb-4 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">
            Reviews
          </div>
          <h1 className="text-4xl md:text-6xl font-[family-name:var(--font-heading)] tracking-tight text-balance">
            Words from the mat.
          </h1>
        </div>
      </section>
      <TestimonialWall reviews={reviews} />
      <FinalCTA headline="Add your own review after your first class." />
    </>
  );
}
