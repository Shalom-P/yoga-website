import Link from "next/link";
import { PageHeader } from "@/components/marketing/PageHeader";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { JsonLd } from "@/components/shared/JsonLd";
import { faqPageJsonLd, breadcrumbJsonLd, articleJsonLd } from "@/lib/seo/structuredData";
import type { Faq } from "@/lib/data/faqs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";
const PAGE_URL = `${SITE}/guides/private-vs-group-online-yoga`;
const PUBLISHED = "2026-10-18";
const UPDATED = "2026-10-18";

export const revalidate = 3600;
export const metadata = {
  title: "Private 1:1 vs Group Online Yoga vs Tutor Marketplaces",
  description:
    "Choosing online yoga: a personal 1:1 teacher, group live classes on a fitness app, or a teacher hired on a tutor marketplace. What each is good for, and the questions to ask.",
  alternates: { canonical: "/guides/private-vs-group-online-yoga" },
};

/**
 * Describes each option by how it works, not by any provider's current price
 * or offer, which change too often to state here. The one third-party figure
 * (the marketplace hourly range) is the same sourced row the cost guide uses.
 */
const OPTIONS = [
  {
    name: "Group live classes on a fitness app",
    examples: "Live online classes on fitness platforms such as cult.fit",
    good: "A low price per class, a fixed timetable to show up to, and the energy of a group.",
    limits:
      "One teacher is watching many screens, so individual correction is limited, and the class is planned for the room rather than for your body. Usually sold as a membership.",
  },
  {
    name: "A teacher from a tutor marketplace",
    examples: "Profiles listed on marketplaces such as Superprof, UrbanPro or TeacherOn",
    good: "A wide choice of independent teachers, with rates set by each teacher, often one-to-one.",
    limits:
      "Qualifications, reliability, rescheduling and refunds vary teacher by teacher, and you arrange times and payment with each one. The marketplace lists teachers rather than standing behind the session.",
  },
  {
    name: "A dedicated 1:1 studio online",
    examples: "Studios that employ or vet their own teachers, like us",
    good: "One teacher watching only you for the whole session, chosen qualifications, one booking system with reminders, and one cancellation and refund policy.",
    limits:
      "Costs more per session than a group class, and the roster is smaller than a marketplace's.",
  },
];

const FAQS: Faq[] = [
  {
    q: "Is a personal 1-on-1 online yoga instructor better than group live classes?",
    a: "It depends on what you need. Group live classes on a fitness app are good value if you are healthy, motivated by a timetable, and happy without individual correction. A personal 1:1 teacher is better if you are a beginner, have a health condition, an injury, a pregnancy, or a specific goal, because the teacher watches only you and adapts every pose.",
  },
  {
    q: "Should I hire a yoga teacher on Superprof or UrbanPro, or use a dedicated platform?",
    a: "A tutor marketplace gives you the widest choice of independent teachers; online yoga teachers on Superprof India listed ₹600 to ₹1,500 an hour when we checked in October 2026. You check each teacher's qualifications and agree times, payment and cancellations with them directly. A dedicated 1:1 studio vets its teachers and gives you one booking system, reminders and a written cancellation and refund policy. Choose a marketplace for choice and price; choose a studio for consistency and accountability.",
  },
  {
    q: "What should I check before choosing any online yoga teacher?",
    a: "Whether sessions are live with your camera on, whether you keep the same teacher, what their actual qualification is (for example a BNYS degree, an MD in yoga, or a 200-hour certificate), what happens if you cancel, whether anything expires or renews monthly, and whether there is a refund policy in writing.",
  },
  {
    q: "Is a 1:1 online session as good as an in-person private?",
    a: "For most people, close to it. The teacher can see your alignment and breathing on camera and talk you through adjustments. What online cannot do is hands-on adjustment, so a good online teacher relies more on cues and props you already have at home.",
  },
  {
    q: "How does My Yoga Classes fit in?",
    a: "We are a dedicated 1:1 studio online. Every teacher is in India and holds a university degree in yoga and naturopathy. Sessions are live, 60 minutes, booked in your local time, paid as one-time packs with no subscription, and prepaid sessions never expire.",
  },
];

export default function PrivateVsGroupGuidePage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE}/` },
          { name: "Private 1:1 vs group online yoga", url: PAGE_URL },
        ])}
      />
      <JsonLd
        data={articleJsonLd({
          headline: "Private 1:1 vs group online yoga vs tutor marketplaces",
          description: metadata.description,
          url: PAGE_URL,
          datePublished: PUBLISHED,
          dateModified: UPDATED,
        })}
      />
      <JsonLd data={faqPageJsonLd(FAQS)} />

      <PageHeader
        eyebrow="Guide"
        title={<>A personal teacher, a group class, <em>or a marketplace?</em></>}
        subhead="Three ways to do yoga online with a real teacher, what each is good for, and how to choose."
        align="left"
      />

      <article className="px-7 pb-16">
        <div className="mx-auto max-w-3xl space-y-5 text-lg text-foreground/85 text-pretty">
          <p className="text-sm text-muted-foreground">
            Published {PUBLISHED}. Written by My Yoga Classes, a 1:1 studio, so read it knowing
            which option we offer.
          </p>
          <h2 className="pt-4 text-3xl tracking-tight md:text-4xl">The short answer</h2>
          <p>
            Group live classes on a fitness app are the cheapest way to practise with a live
            teacher, and work well if you are healthy and just need a timetable. A teacher hired
            on a tutor marketplace such as Superprof or UrbanPro gives you one-to-one attention
            and the widest choice, but you check every teacher&apos;s qualifications and terms
            yourself. A dedicated 1:1 studio costs more than a group class and gives you a vetted
            teacher watching only you, one booking system, and one written cancellation and
            refund policy.
          </p>
          <p>
            If you are a beginner, have a health condition such as back pain, PCOS, diabetes or
            high blood pressure, are pregnant, or are older and want to practise safely at home,
            one-to-one is usually worth the difference.
          </p>
        </div>
      </article>

      <section className="myc-sec-cream px-7 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl tracking-tight md:text-4xl">The three options side by side</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <th scope="col" className="py-3 pr-4 font-medium">Option</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Good for</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Watch out for</th>
                </tr>
              </thead>
              <tbody>
                {OPTIONS.map((o) => (
                  <tr key={o.name} className="border-b border-border/60 align-top">
                    <th scope="row" className="py-3 pr-4 text-left font-normal text-foreground">
                      <span className="font-medium">{o.name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{o.examples}</span>
                    </th>
                    <td className="py-3 pr-4">{o.good}</td>
                    <td className="py-3 pr-4">{o.limits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            We have not quoted group-class or membership prices: they change with offers, so
            check the provider. Marketplace rates are in our{" "}
            <Link href="/guides/what-private-online-yoga-costs" className="underline underline-offset-4 hover:text-foreground">
              cost guide
            </Link>
            , with sources.
          </p>
        </div>
      </section>

      <article className="px-7 py-16">
        <div className="mx-auto max-w-3xl space-y-5 text-lg text-foreground/85 text-pretty">
          <h2 className="text-3xl tracking-tight md:text-4xl">When a group class is enough</h2>
          <p>
            You have practised before, nothing hurts, and what you need is a reason to roll the
            mat out three times a week. A live group class gives you that for the lowest price.
          </p>

          <h2 className="pt-6 text-3xl tracking-tight md:text-4xl">When one-to-one is worth it</h2>
          <p>
            You are new and unsure what correct looks like. You have a back that complains, a
            pregnancy, a blood-pressure reading your doctor is watching, PCOS, diabetes, or a
            parent who wants to stay mobile at home. In each case the useful part of the session
            is the teacher noticing what your body is doing and changing the plan, which a group
            teacher cannot do for twenty screens at once.
          </p>

          <h2 className="pt-6 text-3xl tracking-tight md:text-4xl">Marketplace or studio?</h2>
          <p>
            Both can give you a one-to-one teacher. The difference is who stands behind the
            session. On a marketplace you are hiring an independent teacher, so you vet them and
            agree terms one by one. A studio vets its teachers and owns the booking, reminders,
            cancellations and refunds. If you value choice and are comfortable checking
            credentials, a marketplace works. If you want those checks done for you, a studio is
            simpler.
          </p>
          <p>
            Our own answers to the questions below:{" "}
            <Link href="/private-online-yoga-classes" className="underline underline-offset-4 hover:text-foreground">
              live 1:1 sessions
            </Link>{" "}
            with the same teacher each time, degrees in yoga and naturopathy listed on each{" "}
            <Link href="/teachers" className="underline underline-offset-4 hover:text-foreground">
              teacher&apos;s page
            </Link>
            , no subscription, and a public{" "}
            <Link href="/legal/refund" className="underline underline-offset-4 hover:text-foreground">
              refund policy
            </Link>
            .
          </p>
        </div>
      </article>

      <section className="px-7 pb-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">Questions people ask when choosing.</h2>
          <div className="mt-8">
            <FaqAccordion faqs={FAQS} />
          </div>
        </div>
      </section>

      <RelatedLinks
        title="Keep reading."
        items={[
          { href: "/guides/what-private-online-yoga-costs", label: "What private online yoga costs", note: "Published prices in India, the UAE, the US and the UK, with sources." },
          { href: "/doctor-led-yoga-therapy", label: "Doctor-led yoga therapy", note: "What a BNYS or MD in yoga actually means." },
          { href: "/pricing", label: "Session packs and prices", note: "One session or a pack. No subscription." },
        ]}
      />

      <FinalCTA headline="Try one-to-one for a single session." />
    </>
  );
}
