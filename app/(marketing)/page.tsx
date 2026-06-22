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
import { JsonLd } from "@/components/shared/JsonLd";
import { faqPageJsonLd } from "@/lib/seo/structuredData";
import { FAQS } from "@/lib/data/faqs";
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
  const subhead = landingSetting(settings, "landing.hero_subhead", "A 60-minute personalised session, live on Google Meet — shown in your local time. Pick your teacher, pick your time.");
  const trustRating = landingSetting(settings, "landing.trust_rating", "4.9");
  const trustCount = landingSetting(settings, "landing.trust_count", "1,200+ reviews");
  const finalHeadline = landingSetting(settings, "landing.final_headline", "Your first session is on us.");

  return (
    <>
      <JsonLd data={faqPageJsonLd(FAQS)} />
      <LandingPageView />
      <Hero
        headline={headline}
        subhead={subhead}
        trustRating={trustRating}
        trustCount={trustCount}
      />
      <Marquee />
      <OutcomeStats rating={trustRating} />
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
