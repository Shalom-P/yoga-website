// Typed structured-data (JSON-LD) builders. Rendered via <JsonLd data={...} />.
// These give search engines rich-result signals (FAQ accordions, teacher
// knowledge panels, star ratings) that a trust-driven yoga site benefits from.

import type {
  WithContext,
  FAQPage,
  Person,
  Course,
  BreadcrumbList,
  Product,
} from "schema-dts";
import type { Faq } from "@/lib/data/faqs";
import type { Teacher, ClassCategory, Plan, PlanPrice } from "@/lib/supabase/types";

const ORG_NAME = "My Yoga Classes";

/**
 * Stable node id for the one Organization this site describes.
 *
 * Every page emits an Organization node (app/layout.tsx). Without an @id each
 * one is an anonymous node, so a crawler sees 23 unrelated organisations that
 * happen to share a name, and the Course/Person nodes reference none of them.
 * Anchoring all of them to this id is what makes the site resolve to a single
 * entity. Must stay byte-identical to the @id in app/layout.tsx.
 */
export const ORG_ID = `${
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit"
}/#organization`;

/** Reference to the Organization above, for use in provider/worksFor slots. */
const ORG_REF = { "@type": "Organization", "@id": ORG_ID, name: ORG_NAME } as const;

// Official social profiles. Referenced by the Organization JSON-LD `sameAs`
// (how Google ties the domain to these accounts) and the footer links —
// keep both in sync through this constant.
export const INSTAGRAM_URL = "https://www.instagram.com/myyogaclasses.fit/";

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
    worksFor: ORG_REF,
    knowsAbout: t.specialties?.length ? t.specialties : undefined,
    knowsLanguage: t.languages?.length ? t.languages : undefined,
    image: t.avatar_url ?? undefined,
    description: t.headline ?? undefined,
    // Credentials carry the whole E-E-A-T case for YMYL health content, and
    // these columns are already written by the admin UI. Expressing them as
    // typed nodes rather than leaving them buried in a prose `description` is
    // what lets a crawler read "this author is qualified to discuss this".
    honorificPrefix: /^dr\.?\s/i.test(t.display_name) ? "Dr" : undefined,
    hasCredential: credentialList(t).map((c) => ({
      "@type": "EducationalOccupationalCredential" as const,
      name: c,
      credentialCategory: "Professional Certification",
    })),
  };
}

/** Certification strings off the teacher row, tolerant of the jsonb column's shape. */
function credentialList(t: Teacher): string[] {
  const raw = t.certifications;
  const out = Array.isArray(raw)
    ? raw.filter((c): c is string => typeof c === "string" && c.trim() !== "")
    : [];
  if (t.years_experience > 0) {
    out.push(`${t.years_experience} years teaching experience`);
  }
  return out;
}

export function courseJsonLd(cat: ClassCategory, url: string): WithContext<Course> {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: cat.name.toLowerCase().includes("yoga") ? `1:1 ${cat.name}` : `1:1 Yoga: ${cat.name} focus`,
    description: cat.description ?? undefined,
    url,
    // `sameAs` used to point at this class page, which asserts "this URL is
    // another identity for the Organization". It is not: it is a page the
    // Organization provides. Reference the shared Organization node instead.
    provider: ORG_REF,
    // Live 1:1 sessions delivered online.
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "Online",
      courseWorkload: "PT60M",
    },
  };
}

/**
 * Offers for the one-time session packs on /pricing.
 *
 * `Product` rather than `Service`: a pack is a fixed, purchasable SKU with a
 * price and a unit count, which is what `Offer` describes. Prices come from the
 * `plan_prices` rows we already load, so only currencies an admin has actually
 * priced are emitted. Nothing falls back to `plans.price_base_cents`: that
 * figure is INR, and publishing it under another currency's symbol would
 * misprice the pack by an order of magnitude.
 *
 * No `aggregateRating`. There are no published reviews to aggregate, and
 * Google disallows self-serving review markup on an organisation's own offers.
 */
export function offersJsonLd(
  plans: (Plan & { prices?: PlanPrice[] })[],
  url: string,
): WithContext<Product> | null {
  const offers = plans.flatMap((p) =>
    (p.prices ?? []).map((price) => ({
      "@type": "Offer" as const,
      name: `${p.name} (${p.session_credits} session${p.session_credits === 1 ? "" : "s"})`,
      price: (price.amount_cents / 100).toFixed(2),
      priceCurrency: price.currency,
      availability: "https://schema.org/InStock" as const,
      url,
      seller: ORG_REF,
      // One-time packs that do not expire, so no priceValidUntil.
      eligibleQuantity: {
        "@type": "QuantitativeValue" as const,
        value: p.session_credits,
        unitText: "session",
      },
    })),
  );
  if (!offers.length) return null;
  const amounts = offers.map((o) => Number(o.price));
  const currencies = [...new Set(offers.map((o) => o.priceCurrency))];
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Live 1:1 online yoga session packs",
    description:
      "One-time packs of 60-minute live 1:1 online yoga sessions with certified teachers in India. No subscription, and sessions never expire.",
    url,
    brand: ORG_REF,
    offers: {
      "@type": "AggregateOffer",
      offerCount: offers.length,
      lowPrice: Math.min(...amounts).toFixed(2),
      highPrice: Math.max(...amounts).toFixed(2),
      // AggregateOffer takes a single currency; when more than one is priced we
      // omit it rather than mislabel, and each child Offer carries its own.
      ...(currencies.length === 1 ? { priceCurrency: currencies[0] } : {}),
      offers,
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
