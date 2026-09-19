import { JsonLd } from "@/components/shared/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo/structuredData";
import { TestimonialWall } from "@/components/marketing/TestimonialWall";
import { PageHeader } from "@/components/marketing/PageHeader";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { getFeaturedReviews } from "@/lib/data/landing";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";

export const revalidate = 60;
export const metadata = {
  title: "Student Reviews of Our 1:1 Yoga",
  description:
    "Reviews from students practising live 1:1 yoga with our certified teachers in India. Every review here comes from someone who completed a session.",
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
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE}/` },
          { name: "Reviews", url: `${SITE}/reviews` },
        ])}
      />
      {reviews.length > 0 ? (
        <TestimonialWall reviews={reviews} />
      ) : (
        /* Honest empty state. We would rather say we have no reviews yet than
           render invented ones, which is what this page did before. */
        <section className="px-7 pb-4 pt-2">
          <p className="mx-auto max-w-xl text-center text-muted-foreground">
            We are a new studio and have not published any reviews yet. Reviews
            appear here once students have completed a session and written one,
            so everything on this page comes from a real practice.
          </p>
        </section>
      )}
      <FinalCTA headline="Add your own review after your first class." />
    </>
  );
}
