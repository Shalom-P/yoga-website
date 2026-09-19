import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { TeacherGrid } from "@/components/marketing/TeacherGrid";
import { PracticeSection } from "@/components/marketing/PracticeSection";
import { TestimonialWall } from "@/components/marketing/TestimonialWall";
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

// ISR: admin edits to landing copy go live within ~60s
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

  const headline = landingSetting(settings, "landing.hero_headline", "Find your 1:1 yoga teacher.");
  const subhead = landingSetting(settings, "landing.hero_subhead", "A 60-minute personalised session, live online, shown in your local time. Pick your teacher, pick your time.");
  // Empty fallbacks, deliberately. landingSetting() treats an empty admin value
  // as unset and returns the fallback, so a non-empty literal here would keep
  // republishing an unsubstantiated review count even after an admin cleared it.
  // Hero hides the whole trust row when these are blank. Set them from
  // /admin/settings once there are real reviews to count.
  const trustRating = landingSetting(settings, "landing.trust_rating", "");
  const trustCount = landingSetting(settings, "landing.trust_count", "");
  const finalHeadline = landingSetting(settings, "landing.final_headline", "Book your 1:1 session today.");

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
      <HowItWorks />
      <PracticeSection categories={categories} />
      <TeacherGrid teachers={teachers} />
      <PricingTeaser plans={plans} />
      <TestimonialWall reviews={reviews} />
      <FAQ />
      <FinalCTA headline={finalHeadline} />
      <StickyMobileCTA />
    </>
  );
}
