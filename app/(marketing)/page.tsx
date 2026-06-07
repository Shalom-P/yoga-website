import { Hero } from "@/components/marketing/Hero";
import { Marquee } from "@/components/marketing/Marquee";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { TeacherCarousel } from "@/components/marketing/TeacherCarousel";
import { PracticeSection } from "@/components/marketing/PracticeSection";
import { TestimonialWall } from "@/components/marketing/TestimonialWall";
import { OutcomeStats } from "@/components/marketing/OutcomeStats";
import { PricingTeaser } from "@/components/marketing/PricingTeaser";
import { FAQ } from "@/components/marketing/FAQ";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { StickyMobileCTA } from "@/components/marketing/StickyMobileCTA";
import { LandingPageView } from "@/components/marketing/LandingPageView";
import {
  getFeaturedTeachers,
  getClassCategories,
  getPlansWithFeatures,
  getFeaturedReviews,
  getLandingSettings,
  landingSetting,
} from "@/lib/data/landing";

// ISR — admin edits to landing copy go live within ~60s
export const revalidate = 60;

export default async function LandingPage() {
  const [teachers, categories, plans, reviews, settings] = await Promise.all([
    getFeaturedTeachers(),
    getClassCategories(),
    getPlansWithFeatures(),
    getFeaturedReviews(),
    getLandingSettings([
      "landing.hero_headline",
      "landing.hero_subhead",
      "landing.trust_count",
      "landing.trust_rating",
      "landing.final_headline",
    ]),
  ]);

  const headline = landingSetting(settings, "landing.hero_headline", "Find your free 1:1 yoga teacher — no credit card.");
  const subhead = landingSetting(settings, "landing.hero_subhead", "60-minute private session. Pick your teacher. Pick your time. We meet on Google Meet.");
  const trustRating = landingSetting(settings, "landing.trust_rating", "4.9");
  const trustCount = landingSetting(settings, "landing.trust_count", "1,200+ reviews");
  const finalHeadline = landingSetting(settings, "landing.final_headline", "Your first session is on us.");

  return (
    <>
      <LandingPageView />
      <Hero
        headline={headline}
        subhead={subhead}
        trustRating={trustRating}
        trustCount={trustCount}
      />
      <Marquee />
      <OutcomeStats />
      <HowItWorks />
      <TeacherCarousel teachers={teachers} />
      <PracticeSection categories={categories} />
      <PricingTeaser plans={plans} />
      <TestimonialWall reviews={reviews} />
      <FAQ />
      <FinalCTA headline={finalHeadline} />
      <StickyMobileCTA />
    </>
  );
}
