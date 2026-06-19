import { TestimonialWall } from "@/components/marketing/TestimonialWall";
import { PageHeader } from "@/components/marketing/PageHeader";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { getFeaturedReviews } from "@/lib/data/landing";

export const revalidate = 60;
export const metadata = {
  title: "Reviews",
  description: "What Australian students say about practising with us.",
  alternates: { canonical: "/reviews" },
};

export default async function ReviewsPage() {
  const reviews = await getFeaturedReviews();
  return (
    <>
      <PageHeader
        eyebrow="Reviews"
        title={<>Words from <em>the mat.</em></>}
      />
      <TestimonialWall reviews={reviews} />
      <FinalCTA headline="Add your own review after your first class." />
    </>
  );
}
