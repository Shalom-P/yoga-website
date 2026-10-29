import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/marketing/PageHeader";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { PackPriceTable } from "@/components/marketing/PackPriceTable";
import { JsonLd } from "@/components/shared/JsonLd";
import { faqPageJsonLd, breadcrumbJsonLd } from "@/lib/seo/structuredData";
import { getPlansWithFeatures, getAllActiveTeachers } from "@/lib/data/landing";
import type { Faq } from "@/lib/data/faqs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";
const BOOK_HREF = "/login?next=/dashboard/book";

export const revalidate = 300;
export const metadata = {
  title: "Online Yoga Classes in the USA, from India",
  description:
    "Live 1:1 online yoga for students in the United States, taught by yoga and naturopathy doctors in India. Evening slots in US time, prices in US dollars, no subscription.",
  alternates: { canonical: "/online-yoga-classes-usa" },
};

/**
 * India time to US zones. India has no daylight saving; the US does, so the
 * offset shifts by an hour twice a year. Both halves are shown so nobody has to
 * do the arithmetic. Figures computed from the IANA zone database for 2026.
 */
const TIMES = {
  summer: {
    label: "March to November (US daylight time)",
    rows: [
      ["5:30 am", "8:00 pm (prev. day)", "7:00 pm (prev. day)", "6:00 pm (prev. day)", "5:00 pm (prev. day)"],
      ["6:30 am", "9:00 pm (prev. day)", "8:00 pm (prev. day)", "7:00 pm (prev. day)", "6:00 pm (prev. day)"],
      ["7:30 am", "10:00 pm (prev. day)", "9:00 pm (prev. day)", "8:00 pm (prev. day)", "7:00 pm (prev. day)"],
      ["7:00 pm", "9:30 am", "8:30 am", "7:30 am", "6:30 am"],
      ["8:00 pm", "10:30 am", "9:30 am", "8:30 am", "7:30 am"],
      ["9:00 pm", "11:30 am", "10:30 am", "9:30 am", "8:30 am"],
      ["10:00 pm", "12:30 pm", "11:30 am", "10:30 am", "9:30 am"],
    ],
  },
  winter: {
    label: "November to March (US standard time)",
    rows: [
      ["5:30 am", "7:00 pm (prev. day)", "6:00 pm (prev. day)", "5:00 pm (prev. day)", "4:00 pm (prev. day)"],
      ["6:30 am", "8:00 pm (prev. day)", "7:00 pm (prev. day)", "6:00 pm (prev. day)", "5:00 pm (prev. day)"],
      ["7:30 am", "9:00 pm (prev. day)", "8:00 pm (prev. day)", "7:00 pm (prev. day)", "6:00 pm (prev. day)"],
      ["7:00 pm", "8:30 am", "7:30 am", "6:30 am", "5:30 am"],
      ["8:00 pm", "9:30 am", "8:30 am", "7:30 am", "6:30 am"],
      ["9:00 pm", "10:30 am", "9:30 am", "8:30 am", "7:30 am"],
      ["10:00 pm", "11:30 am", "10:30 am", "9:30 am", "8:30 am"],
    ],
  },
};

const FAQS: Faq[] = [
  {
    q: "What times are available for students in the US?",
    a: "Our teachers teach from early morning to late evening India time. For the US that means two windows: evenings (an Indian morning) and mornings (an Indian evening). An Indian 6:30 am is 9:00 pm Eastern in summer and 8:00 pm in winter. Every slot on the booking page is already shown in your own time zone.",
  },
  {
    q: "Do I pay in US dollars?",
    a: "Yes. Each pack is priced separately in US dollars, and you are charged in dollars at checkout. The full price table is on this page and on the pricing page.",
  },
  {
    q: "Is the session live, or a recording?",
    a: "Live, one-to-one, over video, 60 minutes. Your teacher sees you and adjusts the session as you go. Nothing is recorded or sold on.",
  },
  {
    q: "Are the teachers qualified?",
    a: "Every teacher holds a university qualification in yoga from India, such as a BNYS (Bachelor of Naturopathy and Yogic Sciences), an MD in clinical yoga or a Doctor of Yogic Sciences. They adapt sessions for conditions like back pain, diabetes, high blood pressure, PCOS and pregnancy, alongside, never instead of, your own doctor's care.",
  },
  {
    q: "I grew up with yoga in India. Is this the real thing?",
    a: "Yes. Our teachers trained in India, in the traditional Hatha-based practice taught in Indian universities, and teach in English. It is common to book for a parent as well as for yourself.",
  },
  {
    q: "Can I book for my parents?",
    a: "Yes. Create the account in your name and tell us who the session is for. Our teachers work with older adults every day, with chair support where it helps. Sessions are shown in whichever time zone the student is in.",
  },
  {
    q: "What if I need to cancel?",
    a: "Cancel from your dashboard before the session starts and the session goes back to your account to use another time. Nothing expires.",
  },
];

function TimeTable({ label, rows }: { label: string; rows: string[][] }) {
  return (
    <div>
      <h3 className="text-lg font-medium">{label}</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">India (IST)</th>
              <th scope="col" className="py-2 pr-4 font-medium">Eastern</th>
              <th scope="col" className="py-2 pr-4 font-medium">Central</th>
              <th scope="col" className="py-2 pr-4 font-medium">Mountain</th>
              <th scope="col" className="py-2 pr-4 font-medium">Pacific</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} className="border-b border-border/60">
                {r.map((cell, i) => (
                  <td key={i} className={`py-2 pr-4 tabular-nums ${i === 0 ? "text-foreground" : ""}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function UsaPage() {
  const [plans, teachers] = await Promise.all([getPlansWithFeatures(), getAllActiveTeachers()]);
  const usdPlans = plans.map((p) => ({ ...p, prices: p.prices.filter((pr) => pr.currency === "USD") }));

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE}/` },
          { name: "Online yoga classes in the USA", url: `${SITE}/online-yoga-classes-usa` },
        ])}
      />
      <JsonLd data={faqPageJsonLd(FAQS)} />

      <PageHeader
        eyebrow="United States"
        title={<>Online yoga classes in the USA, <em>taught from India.</em></>}
        subhead="Live 1:1 sessions with yoga and naturopathy doctors in India, at evening and morning times that fit a US day. Prices in US dollars. No subscription."
      />

      <section className="px-7 pb-16">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-full px-6">
              <Link href={BOOK_HREF}>
                Book a 1:1 session
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 rounded-full px-6">
              <Link href="/teachers">Meet the teachers</Link>
            </Button>
          </div>

          <div className="mt-14 space-y-5 text-lg text-foreground/85 text-pretty">
            <p>
              A private yoga lesson in the United States costs somewhere between $40 and $100
              an hour online, and well over $100 in person. The teacher is excellent, the
              studio is lovely, and the price is why most people practise once a month instead
              of twice a week.
            </p>
            <p>
              The same hour, live and one-to-one, with a teacher in India who holds a
              university degree in yoga and naturopathy, costs a fraction of that. The time
              difference, which sounds like the catch, turns out to be the convenient part: an
              Indian morning is an American evening, so the slots land after work, not during
              it.
            </p>
            <p>
              Sessions are 60 minutes over video, just you and your teacher. You choose the
              teacher, keep them, and book one session at a time or a pack. Every time on the
              site is shown in your own time zone.{" "}
              <Link href="/private-online-yoga-classes" className="underline underline-offset-4 hover:text-foreground">
                How a private online session works
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="myc-sec-mint px-7 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl tracking-tight md:text-4xl">When sessions fall in US time.</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground text-pretty">
            Teachers teach from early morning to late evening in India. The table shows what
            typical Indian slots look like across the four main US zones. India does not change
            its clocks, so the US daylight-saving switch moves everything by an hour.
          </p>
          <div className="mt-8 space-y-10">
            <TimeTable label={TIMES.summer.label} rows={TIMES.summer.rows} />
            <TimeTable label={TIMES.winter.label} rows={TIMES.winter.rows} />
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Exact availability varies by teacher. The booking page shows real open slots in
            your local time.
          </p>
        </div>
      </section>

      <PackPriceTable plans={usdPlans} />

      {teachers.length > 0 && (
        <RelatedLinks
          title="Who you would be practising with."
          items={teachers.map((t) => ({
            href: `/teachers/${t.slug}`,
            label: t.display_name,
            note: t.headline ?? undefined,
          }))}
          cta={{ href: "/doctor-led-yoga-therapy", label: "What their qualifications mean" }}
        />
      )}

      <section className="px-7 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">Questions from US students.</h2>
          <div className="mt-8">
            <FaqAccordion faqs={FAQS} />
          </div>
        </div>
      </section>

      <RelatedLinks
        title="Popular with students in the US."
        items={[
          { href: "/classes/pain-relief", label: "1:1 yoga for back and neck pain", note: "Desk-shaped bodies, gentle mobility, pain-free range." },
          { href: "/classes/geriatric", label: "Chair yoga for seniors", note: "Often booked by adult children for a parent." },
          { href: "/classes/mental-health", label: "1:1 yoga for stress", note: "Breathwork, slow movement, guided rest." },
          { href: "/classes/prenatal", label: "Prenatal and postnatal yoga", note: "Trimester by trimester, with your doctor's clearance." },
        ]}
        cta={{ href: "/guides/what-private-online-yoga-costs", label: "What private online yoga costs, compared" }}
      />

      <FinalCTA headline="Book an evening session, US time." />
    </>
  );
}
