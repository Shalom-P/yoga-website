// Typed structured-data (JSON-LD) builders. Rendered via <JsonLd data={...} />.
// These give search engines rich-result signals (FAQ accordions, teacher
// knowledge panels, star ratings) that a trust-driven yoga site benefits from.

import type {
  WithContext,
  FAQPage,
  Person,
  Course,
  BreadcrumbList,
} from "schema-dts";
import type { Faq } from "@/lib/data/faqs";
import type { Teacher, ClassCategory } from "@/lib/supabase/types";

const ORG_NAME = "My Yoga Classes";

export function faqPageJsonLd(faqs: Faq[]): WithContext<FAQPage> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

// Note: schema.org Person has no aggregateRating (that belongs on Product/
// Service/Course); we expose teacher ratings in the UI, not in Person markup.
export function personJsonLd(t: Teacher, url: string): WithContext<Person> {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: t.display_name,
    url,
    jobTitle: "Yoga Teacher",
    worksFor: { "@type": "Organization", name: ORG_NAME },
    knowsAbout: t.specialties?.length ? t.specialties : undefined,
    knowsLanguage: t.languages?.length ? t.languages : undefined,
    image: t.avatar_url ?? undefined,
    description: t.headline ?? undefined,
  };
}

export function courseJsonLd(cat: ClassCategory, url: string): WithContext<Course> {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: cat.name.toLowerCase().includes("yoga") ? `1:1 ${cat.name}` : `1:1 Yoga: ${cat.name} focus`,
    description: cat.description ?? undefined,
    url,
    provider: { "@type": "Organization", name: ORG_NAME, sameAs: url },
    // Live 1:1 sessions delivered online.
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "Online",
      courseWorkload: "PT60M",
    },
  };
}

export function breadcrumbJsonLd(
  items: { name: string; url: string }[],
): WithContext<BreadcrumbList> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}
