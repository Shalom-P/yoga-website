import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { TeacherGrid } from "@/components/marketing/TeacherGrid";
import { PracticeSection } from "@/components/marketing/PracticeSection";
import { TestimonialWall } from "@/components/marketing/TestimonialWall";
import { PricingTeaser } from "@/components/marketing/PricingTeaser";
import { FAQ } from "@/components/marketing/FAQ";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";
import { LandingPageView } from "@/components/marketing/LandingPageView";
import { JsonLd } from "@/components/shared/JsonLd";
import { faqPageJsonLd } from "@/lib/seo/structuredData";
import { homeFaqs } from "@/lib/data/faqs";
import { perSessionRange } from "@/components/marketing/PackPriceTable";
import { formatMoney } from "@/lib/i18n/money";
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

// Carries the social copy that used to sit in the root layout's openGraph
// object, where it leaked onto all 23 URLs. Scoped to the homepage now.
// A page-level openGraph object replaces the one carrying app/opengraph-image,
// so the image has to be named here or the homepage shares without one.
export const metadata = {
  openGraph: {
    type: "website" as const,
    siteName: "My Yoga Classes",
    locale: "en_US",
    title: "My Yoga Classes: Live 1:1 online yoga teacher",
    description:
      "Find your 1:1 yoga teacher. 60-minute personalised session. Pick your teacher. Pick your time. Meets live online.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "My Yoga Classes: Live 1:1 online yoga",
      },
    ],
  },
};

/** Where the home page hands on to. Anchor text names the destination's subject. */
const WHERE_TO_START = [
  {
    href: "/private-online-yoga-classes",
    label: "Private 1:1 online yoga classes",
    note: "What a live one-to-one session is, and how it differs from an app or a group stream.",
  },
  {
    href: "/online-yoga-classes-india",
    label: "Private 1:1 online yoga classes in India",
    note: "Morning and evening IST slots, rupee prices, no monthly subscription.",
  },
  {
    href: "/guides/what-private-online-yoga-costs",
    label: "What a private online yoga class costs",
    note: "Per-session prices for single sessions and packs of five or ten.",
  },
  {
    href: "/guides/private-vs-group-online-yoga",
    label: "1:1 versus group classes like Cult.fit",
    note: "Private teacher, group live class or a tutor marketplace: which suits you.",
  },
  {
    href: "/doctor-led-yoga-therapy",
    label: "Doctor-led yoga therapy",
    note: "Teachers with yoga and naturopathy degrees, and what that means for your session.",
  },
  {
    href: "/classes/pcos",
    label: "1:1 yoga for PCOS",
    note: "An active routine, rest and comfort through your cycle.",
  },
  {
    href: "/classes/prenatal",
    label: "1:1 prenatal yoga",
    note: "Adapted to your trimester, once your doctor or midwife has cleared you.",
  },
  {
    href: "/classes/geriatric",
    label: "Chair yoga for elderly parents at home",
    note: "Slow, supportive sessions with seated and chair-supported options.",
  },
  {
    href: "/classes/diabetes",
    label: "1:1 yoga for diabetes",
    note: "Gentle movement and breathwork alongside your doctor's care.",
  },
  {
    href: "/classes/hypertension",
    label: "1:1 yoga for high blood pressure",
    note: "Calm, steady practice with the poses to avoid left out.",
  },
  {
    href: "/classes/pain-relief",
    label: "1:1 yoga for back and neck pain",
    note: "Mobility and posture work inside a comfortable range.",
  },
];

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
  // Same figure the condition pages state under their H1: the lowest
  // per-session price from an explicit INR plan_prices row, never the base
  // price under another symbol. Hidden when nothing is priced.
  const inr = perSessionRange(plans, "INR");
  const priceFrom = inr ? formatMoney(inr.low, "INR") : null;
  // The home page's own questions; <FAQ faqs> below renders the same list, so
  // the visible accordion and the FAQPage JSON-LD cannot drift apart.
  const faqs = homeFaqs({ priceFrom });

  return (
    <>
      <JsonLd data={faqPageJsonLd(faqs)} />
      <LandingPageView />
      <Hero
        headline={headline}
        subhead={subhead}
        trustRating={trustRating}
        trustCount={trustCount}
        priceFrom={priceFrom}
      />
      <HowItWorks />
      {/* Body links to the pages that answer the buyer questions. Until now
          they were reachable from here only through the footer, which
          Googlebot follows slowly (Search Console, 20 Oct 2026: most of these
          URLs "unknown to Google"). Server-rendered, descriptive anchors. */}
      <RelatedLinks
        title="Where to start."
        items={WHERE_TO_START}
        cta={{ href: "/classes", label: "All nine conditions we teach for" }}
      />
      <PracticeSection categories={categories} />
      <TeacherGrid teachers={teachers} />
      <PricingTeaser plans={plans} />
      <TestimonialWall reviews={reviews} />
      <FAQ faqs={faqs} />
      <FinalCTA headline={finalHeadline} />
    </>
  );
}
