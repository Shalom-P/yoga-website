import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/marketing/PageHeader";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { PackPriceTable } from "@/components/marketing/PackPriceTable";
import { JsonLd } from "@/components/shared/JsonLd";
import { faqPageJsonLd, breadcrumbJsonLd } from "@/lib/seo/structuredData";
import { getAllActiveTeachers, getClassCategories, getPlansWithFeatures } from "@/lib/data/landing";
import type { Faq } from "@/lib/data/faqs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";
const BOOK_HREF = "/login?next=/dashboard/book";

export const revalidate = 300;
export const metadata = {
  title: "Private Online Yoga Classes, Live 1:1",
  description:
    "Private online yoga classes, live and one-to-one with a certified teacher from India. Personalised, 60 minutes, in your local time. One session or a pack.",
  alternates: { canonical: "/private-online-yoga-classes" },
};

const FAQS: Faq[] = [
  {
    q: "What is a private online yoga class?",
    a: "A live, one-to-one session over video with a certified teacher who is watching only you. It is not a recording and not a group stream. Your teacher sees your alignment, adjusts the practice in real time, and builds each session around your body and goals.",
  },
  {
    q: "How is 1-on-1 different from an app or a group class?",
    a: "An app cannot see you, and in a group class of twenty the teacher cannot watch you. In a private session the teacher notices the knee that is rolling in, the breath you are holding, and the pose that needs a block, and changes the plan on the spot. People with an injury, a health condition, or a beginner's nerves usually progress faster this way.",
  },
  {
    q: "How long is a session, and how do I join?",
    a: "Sixty minutes. When you book, we email you a join link, plus reminders 24 hours and 1 hour before. You open it on a laptop, tablet or phone. No app to download.",
  },
  {
    q: "Do I need to be flexible or experienced?",
    a: "No. Most of our students are beginners or returning after a long gap. Tell us your level and anything we should know about your body when you sign up, and your teacher starts from there.",
  },
  {
    q: "Can I keep the same teacher?",
    a: "Yes, and we recommend it. You choose your teacher when you book, and you can book the same person every week. They remember what you worked on and where you are heading.",
  },
  {
    q: "What time zones do you cover?",
    a: "Teachers are in India and teach from early morning to late evening India time, which covers evenings in North America, afternoons in the UK and Europe, and mornings and evenings in the Gulf and Asia. Every time you see on the site is already converted to your local time.",
  },
  {
    q: "What does it cost?",
    a: "You buy a one-time pack of one, five or ten sessions. There is no subscription and prepaid sessions never expire. Prices are shown in your currency at checkout; the full table is on the pricing page.",
  },
  {
    q: "What if I have a medical condition?",
    a: "Tell us when you sign up and tell your teacher at the start. Our teachers are trained in yoga and naturopathy and adapt sessions for conditions like diabetes, high blood pressure, back pain, PCOS and pregnancy. Yoga supports your medical care and never replaces it, so keep your doctor in the loop.",
  },
];

const DIFFERENCES = [
  {
    title: "The teacher is watching only you",
    body: "Your camera is on, theirs is on, and nobody else is in the room. Corrections are specific, immediate, and about your body, not a general cue to the class.",
  },
  {
    title: "The plan is personalised, then re-personalised",
    body: "Your first session is a conversation and a gentle assessment. From there, each session is customized to where you are that week: tired, sore, energetic, pregnant, recovering.",
  },
  {
    title: "The same teacher, every time",
    body: "Pick one teacher and keep them. Progress in yoga comes from someone who remembers that your left hip is tighter than your right.",
  },
  {
    title: "Fits around your life",
    body: "Early-morning and late-evening slots, shown in your own time zone, booked from your dashboard. Cancel from your dashboard before the start and the session goes back to your account.",
  },
];

const STEPS = [
  { title: "Choose a teacher", body: "Read their profile, their training, and what they work with. Pick the one whose focus matches yours." },
  { title: "Pick a time in your time zone", body: "Every slot is shown in your local time. Book a single session to start, or a pack if you already know you want a routine." },
  { title: "Meet live, one-to-one", body: "Open the join link at your time. Sixty minutes, just you and your teacher, built around what you need that day." },
];

export default async function PrivateOnlineYogaPage() {
  const [teachers, categories, plans] = await Promise.all([
    getAllActiveTeachers(),
    getClassCategories(),
    getPlansWithFeatures(),
  ]);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE}/` },
          { name: "Private online yoga classes", url: `${SITE}/private-online-yoga-classes` },
        ])}
      />
      <JsonLd data={faqPageJsonLd(FAQS)} />

      <PageHeader
        eyebrow="Private online yoga"
        title={<>Private online yoga classes, <em>one-to-one, live.</em></>}
        subhead="A 60-minute session with a certified teacher from India who is watching only you. Personalised to your body, shown in your local time, booked one session at a time."
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
          <p className="mt-5 text-center text-sm text-muted-foreground">
            60 min · 1:1 · live online · no subscription
          </p>

          <div className="mt-14 space-y-5 text-lg text-foreground/85 text-pretty">
            <p>
              Most online yoga is a recording or a group stream. Both are fine for a workout.
              Neither can see you. A private online yoga class is different: it is a live,
              one-on-one lesson with a teacher whose whole attention is on your mat for the
              full hour. They watch your alignment, hear your breath, and change the session as
              you go.
            </p>
            <p>
              That is why people choose one-to-one. Not because they are advanced, but because
              they have something specific going on: a stiff lower back, a diabetes diagnosis, a
              pregnancy, a parent who needs chair support, or simply nerves about being watched
              in a room of strangers. A personalised session meets you where you are.
            </p>
          </div>
        </div>
      </section>

      <section className="myc-sec-mint px-7 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-5xl">
            What makes a 1-on-1 session different.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {DIFFERENCES.map((d) => (
              <div key={d.title} className="rounded-3xl border border-border bg-card p-6">
                <h3 className="text-xl">{d.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground text-pretty">{d.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-7 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-5xl">How it works.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-3xl border border-border bg-card p-6">
                <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 font-[family-name:var(--font-heading)] font-semibold text-primary">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-lg">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground text-pretty">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl border border-border bg-card p-8">
              <h3 className="mb-5 text-xl">Your first session</h3>
              <ul className="space-y-3">
                {[
                  "A short conversation: your goals, your history, anything to work around",
                  "A gentle assessment of how you move and breathe",
                  "A practice built from that, at your pace",
                  "A plan for what to work on next, if you want one",
                ].map((w) => (
                  <li key={w} className="flex gap-3">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="size-3.5" />
                    </span>
                    <span className="text-sm text-muted-foreground text-pretty">{w}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-secondary/50 p-8">
              <h3 className="mb-3 text-xl">What you need</h3>
              <p className="text-sm text-muted-foreground text-pretty">
                A laptop, tablet or phone with a camera, a clear space about two metres by one,
                and a mat if you have one. A chair, a cushion or a thick book stand in for
                props. Nothing to install.
              </p>
              <h3 className="mt-6 mb-3 text-lg">Who teaches</h3>
              <p className="text-sm text-muted-foreground text-pretty">
                {teachers.length > 0
                  ? `${teachers.map((t) => t.display_name).join(", ")}: clinically trained in yoga and naturopathy, teaching from India.`
                  : "Certified teachers from India, trained in yoga and naturopathy."}{" "}
                <Link href="/doctor-led-yoga-therapy" className="underline underline-offset-4 hover:text-foreground">
                  Why that training matters
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      <PackPriceTable plans={plans} />

      <section className="px-7 pb-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">Questions people ask first.</h2>
          <div className="mt-8">
            <FaqAccordion faqs={FAQS} />
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <RelatedLinks
          title="What people bring to a private session."
          items={categories.map((c) => ({
            href: `/classes/${c.slug}`,
            label: `1:1 yoga for ${c.name.toLowerCase()}`,
            note: c.description ?? undefined,
          }))}
          cta={{ href: "/classes", label: "See every class type" }}
        />
      )}

      <RelatedLinks
        title="Booking from abroad."
        items={[
          {
            href: "/online-yoga-classes-usa",
            label: "Online yoga classes in the USA",
            note: "Evening slots in US time, prices in US dollars.",
          },
          {
            href: "/online-yoga-classes-uae",
            label: "Online yoga classes in Dubai and the UAE",
            note: "Morning and evening slots in Gulf time, prices in dirhams.",
          },
          {
            href: "/guides/what-private-online-yoga-costs",
            label: "What private online yoga costs",
            note: "Our prices next to the published prices we found elsewhere.",
          },
        ]}
      />

      <FinalCTA headline="Book your first private session." />
    </>
  );
}
