import { getClassCategories, getAllActiveTeachers } from "@/lib/data/landing";
import { CONDITION_SLUGS } from "@/lib/data/condition-pages";

/**
 * /llms.txt — a plain-text summary of what this site is and what it offers.
 *
 * Honest framing: no search engine or assistant vendor has committed to reading
 * this file, so treat it as cheap insurance rather than a ranking lever. The
 * thing that actually decides whether an assistant can cite us is whether the
 * page is in an index it reads (see lib/seo/indexnow.ts) and whether the
 * Organization resolves to one entity (see the @id in lib/seo/structuredData).
 *
 * Generated from live data so it cannot drift from the roster or the catalogue.
 */
export const revalidate = 3600;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";

export async function GET() {
  const [categories, teachers] = await Promise.all([
    getClassCategories(),
    getAllActiveTeachers(),
  ]);

  const conditions = categories.filter((c) => CONDITION_SLUGS.includes(c.slug));

  const body = `# My Yoga Classes

> Live one-to-one online yoga. Students anywhere in the world are paired with a
> certified teacher in India for a 60-minute private session over video, booked
> and displayed in the student's own time zone.

## What this is

- Format: live 1:1 video sessions with a named teacher. Not pre-recorded video, and not group classes.
- Session length: 60 minutes.
- Billing: one-time prepaid session packs. No subscription, and sessions do not expire.
- Availability: teachers are based in India (IST) and cover early morning to late evening.
- Booking requires an account. Browsing teachers, class types and prices does not.

## Teachers

${teachers
  .map((t) => `- ${t.display_name}${t.headline ? `, ${t.headline}` : ""}: ${SITE}/teachers/${t.slug}`)
  .join("\n")}

## Class types

Sessions are organised by what the student is working on, not by yoga style:

${conditions.map((c) => `- ${c.name}: ${SITE}/classes/${c.slug}`).join("\n")}

## Key pages

- Home: ${SITE}/
- Pricing and session packs: ${SITE}/pricing
- All teachers: ${SITE}/teachers
- All class types: ${SITE}/classes
- Frequently asked questions: ${SITE}/faq
- Contact: ${SITE}/contact

## Important qualifications

- Yoga here is offered as movement and breathing practice alongside a student's
  existing medical care. It is not medical treatment and it does not replace it.
  Condition pages describe how sessions are adapted, not clinical outcomes.
- Students with a health condition, an injury, or who are pregnant should have
  clearance from their doctor or midwife before starting.
- Prices are shown in the currency available for the visitor's region. Only INR
  and AED are currently priced; other regions are shown INR.

## Machine-readable data

- Sitemap: ${SITE}/sitemap.xml
- Structured data: Organization, Course, Person, Product and BreadcrumbList as
  JSON-LD in the HTML of the relevant pages.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
