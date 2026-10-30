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
  title: "Online Yoga Classes in Dubai and the UAE",
  description:
    "Live 1:1 online yoga for Dubai, Abu Dhabi and across the UAE, taught by yoga and naturopathy doctors in India. Morning and evening slots in Gulf time, in AED.",
  alternates: { canonical: "/online-yoga-classes-uae" },
};

/** Gulf Standard Time is IST minus 1 hour 30 minutes, all year. */
const TIMES: [string, string][] = [
  ["5:30 am", "4:00 am"],
  ["6:30 am", "5:00 am"],
  ["7:30 am", "6:00 am"],
  ["8:30 am", "7:00 am"],
  ["7:00 pm", "5:30 pm"],
  ["8:00 pm", "6:30 pm"],
  ["9:00 pm", "7:30 pm"],
  ["10:00 pm", "8:30 pm"],
  ["11:00 pm", "9:30 pm"],
];

const FAQS: Faq[] = [
  {
    q: "What times are available in the UAE?",
    a: "The UAE is an hour and a half behind India, with no clock changes on either side, so the fit is easy: early mornings before work (an Indian 7:30 am is 6:00 am in Dubai) and evenings after it (an Indian 9:00 pm is 7:30 pm in Dubai). Every slot on the booking page is already shown in Gulf time.",
  },
  {
    q: "Do I pay in dirhams?",
    a: "Yes. Each pack is priced in AED and you are charged in AED. Payment for UAE students is currently by bank transfer to a UAE account: you get the details and a reference at checkout, and your sessions are added once the transfer lands. There is no subscription.",
  },
  {
    q: "How does this compare with a private instructor in Dubai?",
    a: "A private 60-minute session at a Dubai studio was listed at AED 200 to 450 when we checked in October 2026, and at-home instructors charge similar rates plus travel. A live one-to-one online session with us is a fraction of that, with a teacher who holds a university degree in yoga and naturopathy.",
  },
  {
    q: "Is it live, or recorded?",
    a: "Live, one-to-one, over video, 60 minutes. Your camera is on, your teacher sees your alignment and adjusts as you go. Nothing is recorded.",
  },
  {
    q: "Can women book a female teacher?",
    a: "Yes. You choose your teacher when you book and keep the same one, and every teacher's profile, training and photo is public before you decide.",
  },
  {
    q: "Is this suitable during Ramadan or in the summer heat?",
    a: "Yes. Sessions are at home, air-conditioned, at a time you choose. During Ramadan many students move to a slot after iftar or before suhoor; tell your teacher and they will keep the practice gentle and hydration-aware.",
  },
  {
    q: "What if I need to cancel?",
    a: "Cancel from your dashboard before the session starts and the session goes back to your account to use another time. Nothing expires.",
  },
];

export default async function UaePage() {
  const [plans, teachers] = await Promise.all([getPlansWithFeatures(), getAllActiveTeachers()]);
  const aedPlans = plans.map((p) => ({ ...p, prices: p.prices.filter((pr) => pr.currency === "AED") }));

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE}/` },
          { name: "Online yoga classes in the UAE", url: `${SITE}/online-yoga-classes-uae` },
        ])}
      />
      <JsonLd data={faqPageJsonLd(FAQS)} />

      <PageHeader
        eyebrow="United Arab Emirates"
        title={<>Online yoga classes in Dubai and the UAE, <em>taught from India.</em></>}
        subhead="Live 1:1 sessions with yoga and naturopathy doctors in India, before work or after it, in Gulf time. Prices in dirhams. No subscription."
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
              Dubai has excellent yoga studios and excellent private instructors, and a
              private hour with either runs to several hundred dirhams once you add travel.
              So most people go to a group class, where the teacher cannot watch them, or
              practise to a video, where nobody can.
            </p>
            <p>
              A live, one-to-one session with a teacher in India is the third option. The
              teacher is watching only you for the full hour, holds a university degree in
              yoga and naturopathy, and costs a fraction of a studio private. India is an hour
              and a half ahead of the Gulf with no clock changes, so a session before work or
              after dinner is always available.
            </p>
            <p>
              Sessions are 60 minutes over video. You choose the teacher, keep them, and book a
              single session or a pack in dirhams.{" "}
              <Link href="/private-online-yoga-classes" className="underline underline-offset-4 hover:text-foreground">
                How a private online session works
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="myc-sec-mint px-7 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl tracking-tight md:text-4xl">When sessions fall in Gulf time.</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground text-pretty">
            Teachers teach from early morning to late evening in India. Gulf Standard Time is
            one hour thirty minutes behind, all year round.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full max-w-md text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-medium">India (IST)</th>
                  <th scope="col" className="py-2 pr-4 font-medium">UAE (GST)</th>
                </tr>
              </thead>
              <tbody>
                {TIMES.map(([ist, gst]) => (
                  <tr key={ist} className="border-b border-border/60">
                    <td className="py-2 pr-4 tabular-nums text-foreground">{ist}</td>
                    <td className="py-2 pr-4 tabular-nums">{gst}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Exact availability varies by teacher. The booking page shows real open slots in
            your local time.
          </p>
        </div>
      </section>

      <PackPriceTable plans={aedPlans} />

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
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">Questions from students in the UAE.</h2>
          <div className="mt-8">
            <FaqAccordion faqs={FAQS} />
          </div>
        </div>
      </section>

      <RelatedLinks
        title="Popular with students in the Gulf."
        items={[
          { href: "/classes/diabetes", label: "1:1 yoga for diabetes", note: "Gentle movement and breathwork alongside your doctor's care." },
          { href: "/classes/weight-loss", label: "1:1 yoga for weight management", note: "Sustainable flows scaled to your fitness." },
          { href: "/classes/pcos", label: "1:1 yoga for PCOS", note: "An active routine, rest, and comfort through your cycle." },
          { href: "/classes/pain-relief", label: "1:1 yoga for back and neck pain", note: "Long commutes, long desks, gentle mobility." },
        ]}
        cta={{ href: "/guides/what-private-online-yoga-costs", label: "What private online yoga costs, compared" }}
      />

      <FinalCTA headline="Book a session before work or after it." />
    </>
  );
}
