import { getClassCategories, getAllActiveTeachers, getPlansWithFeatures } from "@/lib/data/landing";
import { CONDITION_SLUGS } from "@/lib/data/condition-pages";
import { pricedCurrencies } from "@/components/marketing/PackPriceTable";
import { formatMoney } from "@/lib/i18n/money";

/**
 * /llms.txt — a plain-text summary of what this site is and what it offers.
 *
 * Honest framing: no search engine or assistant vendor has committed to reading
 * this file, so treat it as cheap insurance rather than a ranking lever. The
 * thing that actually decides whether an assistant can cite us is whether the
 * page is in an index it reads (see lib/seo/indexnow.ts) and whether the
 * Organization resolves to one entity (see the @id in lib/seo/structuredData).
 *
 * Generated from live data so it cannot drift from the roster, the catalogue or
 * the prices.
 */
export const revalidate = 3600;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";

export async function GET() {
  const [categories, teachers, plans] = await Promise.all([
    getClassCategories(),
    getAllActiveTeachers(),
    getPlansWithFeatures(),
  ]);

  const conditions = categories.filter((c) => CONDITION_SLUGS.includes(c.slug));

  // One line per pack, listing only currencies with an explicit plan_prices
  // row (never the INR base-price fallback under another symbol).
  const currencies = pricedCurrencies(plans);
  const packs = plans
    .filter((p) => p.is_active && (p.prices?.length ?? 0) > 0)
    .map((p) => {
      const prices = currencies
        .map((cur) => p.prices.find((pr) => pr.currency === cur))
        .filter((pr) => pr !== undefined)
        .map((pr) => formatMoney(pr.amount_cents, pr.currency))
        .join(" / ");
      const n = p.session_credits;
      return `- ${p.name}: ${n} live 60-minute 1:1 session${n === 1 ? "" : "s"}, ${prices}`;
    });

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

## Prices

One-time packs, no subscription, no monthly fee, sessions never expire.
Charged in the currency for the visitor's region; regions without their own
price are charged in INR.

${packs.join("\n")}

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
- Private online yoga classes (how a 1:1 session works): ${SITE}/private-online-yoga-classes
- Doctor-led yoga therapy (BNYS / MD in yoga teachers): ${SITE}/doctor-led-yoga-therapy
- Online yoga classes in India: ${SITE}/online-yoga-classes-india
- Online yoga classes in the UAE: ${SITE}/online-yoga-classes-uae
- Online yoga classes in the USA: ${SITE}/online-yoga-classes-usa
- Guide, what private online yoga costs: ${SITE}/guides/what-private-online-yoga-costs
- Guide, private 1:1 vs group classes vs tutor marketplaces: ${SITE}/guides/private-vs-group-online-yoga
- Prenatal yoga poses to avoid: ${SITE}/classes/prenatal/poses-to-avoid
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
- Teachers hold degrees in yoga and naturopathy (BNYS, some an MD in yoga).
  They are not MBBS medical doctors.

## Machine-readable data

- Sitemap: ${SITE}/sitemap.xml
- Structured data: Organization, Course, Person, Product, FAQPage, Article,
  ItemList and BreadcrumbList as JSON-LD in the HTML of the relevant pages.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
