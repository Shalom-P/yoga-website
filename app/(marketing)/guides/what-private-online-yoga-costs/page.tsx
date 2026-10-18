import Link from "next/link";
import { PageHeader } from "@/components/marketing/PageHeader";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { PackPriceTable, perSessionRange } from "@/components/marketing/PackPriceTable";
import { JsonLd } from "@/components/shared/JsonLd";
import { faqPageJsonLd, breadcrumbJsonLd, articleJsonLd } from "@/lib/seo/structuredData";
import { getPlansWithFeatures } from "@/lib/data/landing";
import { formatMoney } from "@/lib/i18n/money";
import type { Faq } from "@/lib/data/faqs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";
const PAGE_URL = `${SITE}/guides/what-private-online-yoga-costs`;
const PUBLISHED = "2026-10-10";
const UPDATED = "2026-10-18";

export const revalidate = 300;
export const metadata = {
  title: "What Private Online Yoga Costs in 2026",
  description:
    "A buyer's guide to private online yoga prices: what a live 1:1 session costs in the US, UK, UAE and India, what drives the price, and what to ask before you pay.",
  alternates: { canonical: "/guides/what-private-online-yoga-costs" },
};

/**
 * Published prices found in October 2026, with the page each came from. These
 * are quoted, not ours; the source is linked so a reader can check the current
 * figure. Keep every row attributable: no range without a URL.
 */
const MARKET_PRICES = [
  {
    market: "United States",
    what: "Private online session, 60 minutes, one student",
    price: "$30 to $100",
    source: "Gymdesk, yoga pricing guide",
    url: "https://gymdesk.com/blog/how-to-price-your-yoga-classes-for-success",
  },
  {
    market: "United States",
    what: "Private online lesson, 60 minutes (2026 guide)",
    price: "$40 to $100",
    source: "Yogalith, how much are yoga classes",
    url: "https://yogalith.com/how-much-are-yoga-classes/",
  },
  {
    market: "United States",
    what: "Private yoga lesson, national average (mostly in person)",
    price: "$125 to $256",
    source: "Thumbtack, yoga prices",
    url: "https://thumbtack.com/p/yoga-prices",
  },
  {
    market: "United Kingdom",
    what: "Private session over Zoom, 60 minutes",
    price: "from £35",
    source: "Moksha Movement, private yoga sessions",
    url: "https://weteachme.com/mokshamovement/1036754-private-yoga-sessions",
  },
  {
    market: "United Kingdom",
    what: "One-to-one class over Zoom, 60 minutes",
    price: "£90 (five for £400)",
    source: "Jess Horn Yoga, private classes",
    url: "https://www.jesshornyoga.com/?p=55",
  },
  {
    market: "UAE",
    what: "Private 1:1 at a Dubai studio, 60 minutes",
    price: "AED 200 to 450",
    source: "GetFitDXB, yoga in Dubai guide",
    url: "https://getfitdxb.com/blog/yoga-dubai-complete-guide",
  },
  {
    market: "UAE",
    what: "Online session, live or on demand",
    price: "AED 50 to 120",
    source: "GetFitDXB, yoga in Dubai guide",
    url: "https://getfitdxb.com/blog/yoga-dubai-complete-guide",
  },
  {
    market: "India",
    what: "Online teacher on a tutoring marketplace, per hour",
    price: "₹600 to ₹1,500",
    source: "Superprof India, online yoga",
    url: "https://www.superprof.co.in/lessons/yoga/online/",
  },
  {
    market: "Global platform",
    what: "1-on-1 subscription, 45-minute sessions",
    price: "$10 first week, then $68 to $158 a month",
    source: "ONE OM ONE, price packages",
    url: "https://1om1.net/pages/pricing",
  },
];

const FAQS: Faq[] = [
  {
    q: "How much does a private online yoga session cost?",
    a: "Published prices in October 2026 ran from about $30 to $100 for a 60-minute private online session with a US teacher, £35 to £90 in the UK, and AED 50 to 120 in the UAE. Marketplace teachers in India list ₹600 to ₹1,500 an hour. Our packs work out between roughly $12 and $19 a session in US dollars, depending on pack size.",
  },
  {
    q: "Why is a teacher in India cheaper than a teacher in New York?",
    a: "Cost of living, mostly. A professional private-tutor rate in India is a fraction of one in the US or UK, so a teacher can be paid well by local standards while the session still costs you less. The training is not the cheaper part: our teachers hold university degrees in yoga and naturopathy.",
  },
  {
    q: "Is a monthly subscription cheaper than paying per session?",
    a: "Only if you use it. A subscription at $68 to $158 a month is good value at three sessions a week and poor value at three a month. Per-session packs cost more per session than a heavy subscriber pays, and less than a light one, and nothing expires if life gets in the way.",
  },
  {
    q: "What should the price include?",
    a: "The full 60 minutes, a teacher who is watching only you, a join link and reminders, the ability to cancel before the start without losing the session, and a clear refund policy. Ask whether the session is live or recorded, and whether you keep the same teacher.",
  },
  {
    q: "Are there hidden fees?",
    a: "With us, no. The price you see at checkout is the full price, in your currency, with no platform fee, booking fee or subscription. Your bank may apply its own foreign-transaction charge on a card payment; that is between you and your bank.",
  },
  {
    q: "Do prices differ by country?",
    a: "Yes. We price each pack separately in Indian rupees, UAE dirhams and US dollars, and charge you in the currency for where you are. The table on this page shows all of them.",
  },
];

export default async function CostGuidePage() {
  const plans = await getPlansWithFeatures();
  const usd = perSessionRange(plans, "USD");
  const lowUsd = usd?.low ?? null;
  const highUsd = usd?.high ?? null;
  const inr = perSessionRange(plans, "INR");
  const inrRange = inr
    ? inr.low === inr.high
      ? formatMoney(inr.low, "INR")
      : `${formatMoney(inr.low, "INR")} to ${formatMoney(inr.high, "INR")}`
    : null;
  // The India answer quotes our own live rupee prices, so it is built here
  // rather than in the static list; the FAQPage JSON-LD gets the same text.
  const faqs: Faq[] = inrRange
    ? [
        {
          q: "How much does a private online yoga class cost per hour in India?",
          a: `Teachers on tutoring marketplaces in India listed ₹600 to ₹1,500 an hour for online yoga when we checked in October 2026 (Superprof India). With us, a live 60-minute one-to-one session costs ${inrRange} in rupees, depending on whether you buy one session or a pack of five or ten. There is no subscription or monthly fee, and prepaid sessions never expire.`,
        },
        ...FAQS,
      ]
    : FAQS;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE}/` },
          { name: "What private online yoga costs", url: PAGE_URL },
        ])}
      />
      <JsonLd
        data={articleJsonLd({
          headline: "What private online yoga costs in 2026",
          description: metadata.description,
          url: PAGE_URL,
          datePublished: PUBLISHED,
          dateModified: UPDATED,
        })}
      />
      <JsonLd data={faqPageJsonLd(faqs)} />

      <PageHeader
        eyebrow="Guide"
        title={<>What private online yoga <em>actually costs.</em></>}
        subhead="A buyer's guide. Most pages on this topic are written for teachers deciding what to charge. This one is for the person paying."
        align="left"
      />

      <article className="px-7 pb-16">
        <div className="mx-auto max-w-3xl space-y-5 text-lg text-foreground/85 text-pretty">
          <p className="text-sm text-muted-foreground">
            Published {PUBLISHED}. Prices quoted from other providers were checked on that date
            and are linked to their source.
          </p>
          <h2 className="pt-4 text-3xl tracking-tight md:text-4xl">The short answer</h2>
          <p>
            A live, one-to-one online yoga session with a teacher in the United States or the
            United Kingdom is usually priced between $30 and $100, or £35 and £90, for an hour.
            In-person privates run higher: Thumbtack puts the US national average at $125 to
            $256 a lesson. A Dubai studio charges AED 200 to 450 for a private hour.
          </p>
          <p>
            A live one-to-one session with a certified teacher in India, over video, costs a
            fraction of that.{" "}
            {lowUsd !== null && highUsd !== null ? (
              <>
                Our packs work out at{" "}
                <strong className="font-semibold text-foreground">
                  {formatMoney(lowUsd, "USD")} to {formatMoney(highUsd, "USD")} a session
                </strong>{" "}
                in US dollars, depending on how many you buy at once.
              </>
            ) : (
              <>Our pack prices are on the pricing page in every currency we price.</>
            )}{" "}
            The hour is the same length, the teacher is watching only you, and the training is,
            if anything, deeper: a university degree in yoga and naturopathy rather than a
            200-hour certificate.
          </p>
          <p>
            <strong className="font-semibold text-foreground">In India</strong>, online yoga
            teachers on tutoring marketplaces list about ₹600 to ₹1,500 an hour.{" "}
            {inrRange ? (
              <>
                A live 60-minute one-to-one session with us costs{" "}
                <strong className="font-semibold text-foreground">{inrRange}</strong> in rupees,
                depending on pack size, with no subscription or monthly fee.
              </>
            ) : (
              <>Our rupee prices are on the pricing page.</>
            )}
          </p>
        </div>
      </article>

      <PackPriceTable plans={plans} showGuideLink={false} />

      <section className="myc-sec-cream px-7 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl tracking-tight md:text-4xl">Published prices elsewhere</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground text-pretty">
            What other providers were charging when we looked, with the page each figure came
            from. Prices change; follow the link for the current one.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <th scope="col" className="py-3 pr-4 font-medium">Market</th>
                  <th scope="col" className="py-3 pr-4 font-medium">What</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Published price</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {MARKET_PRICES.map((row) => (
                  <tr key={row.url + row.what} className="border-b border-border/60 align-top">
                    <td className="py-3 pr-4 text-foreground">{row.market}</td>
                    <td className="py-3 pr-4">{row.what}</td>
                    <td className="py-3 pr-4 text-foreground">{row.price}</td>
                    <td className="py-3 pr-4">
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="underline underline-offset-4 hover:text-foreground"
                      >
                        {row.source}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <article className="px-7 py-16">
        <div className="mx-auto max-w-3xl space-y-5 text-lg text-foreground/85 text-pretty">
          <h2 className="text-3xl tracking-tight md:text-4xl">What drives the price</h2>
          <p>
            <strong className="font-semibold text-foreground">Where the teacher lives.</strong>{" "}
            This is the biggest factor by far. A private-tutor rate that is professional in
            Bengaluru is a third or less of one in Boston. The session is the same hour; the
            rent behind it is not.
          </p>
          <p>
            <strong className="font-semibold text-foreground">Live or recorded.</strong> A
            recorded class costs the platform nothing to deliver twice, so it is priced like
            software. A live one-to-one hour is an hour of a qualified person&apos;s time, so it
            is priced like a lesson.
          </p>
          <p>
            <strong className="font-semibold text-foreground">Training.</strong> A 200-hour
            Yoga Alliance certificate is the entry ticket. Teachers with clinical training, or
            a specialism like prenatal or therapeutic yoga, charge more in every market. Ask
            what the qualification actually is, not just what the acronym says.
          </p>
          <p>
            <strong className="font-semibold text-foreground">How you pay.</strong> Per session
            is the most expensive way to buy and the most flexible. Packs of five or ten lower
            the per-session price. Subscriptions lower it further for heavy users and raise it
            for everyone else, because the month runs out whether you practise or not.
          </p>

          <h2 className="pt-6 text-3xl tracking-tight md:text-4xl">Per session or subscription?</h2>
          <p>
            Work out how often you will realistically practise, then multiply. Twice a week on
            a $120-a-month subscription is $15 a session, which is excellent. Twice a month is
            $60 a session, which is not. If your weeks are unpredictable, a pack that never
            expires removes the pressure to &ldquo;use it up&rdquo;, and that pressure is the
            quiet reason most people stop.
          </p>

          <h2 className="pt-6 text-3xl tracking-tight md:text-4xl">Six questions to ask before you pay</h2>
          <ol className="list-decimal space-y-3 pl-6">
            <li>Is the session live, with my camera on and the teacher watching me?</li>
            <li>Do I get the same teacher each time, or whoever is free?</li>
            <li>What is the teacher&apos;s actual qualification, beyond the acronym?</li>
            <li>What happens if I cancel before the start? Do I lose the session?</li>
            <li>Does anything expire, and is there a subscription I need to remember to stop?</li>
            <li>Is there a refund policy, in writing, for a first session that was not right?</li>
          </ol>
          <p>
            Our answers, for the record: live, yes; same teacher, yes; degrees in yoga and
            naturopathy, listed on each{" "}
            <Link href="/teachers" className="underline underline-offset-4 hover:text-foreground">
              teacher&apos;s page
            </Link>
            ; cancel before the start and the session returns to your account; nothing
            expires and there is no subscription; and the{" "}
            <Link href="/legal/refund" className="underline underline-offset-4 hover:text-foreground">
              refund policy
            </Link>{" "}
            is public.
          </p>
        </div>
      </article>

      <section className="px-7 pb-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">Questions people ask about price.</h2>
          <div className="mt-8">
            <FaqAccordion faqs={faqs} />
          </div>
        </div>
      </section>

      <RelatedLinks
        title="Keep reading."
        items={[
          {
            href: "/pricing",
            label: "Session packs and prices",
            note: "Buy a single session or a pack. No subscription.",
          },
          {
            href: "/private-online-yoga-classes",
            label: "Private online yoga classes",
            note: "What a live 1:1 session is and how it works.",
          },
          {
            href: "/doctor-led-yoga-therapy",
            label: "Doctor-led yoga therapy",
            note: "What our teachers' qualifications mean.",
          },
        ]}
      />

      <FinalCTA headline="Try one session before you decide." />
    </>
  );
}
