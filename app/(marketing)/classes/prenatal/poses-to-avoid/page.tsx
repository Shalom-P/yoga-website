import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/marketing/PageHeader";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { JsonLd } from "@/components/shared/JsonLd";
import { faqPageJsonLd, breadcrumbJsonLd, articleJsonLd } from "@/lib/seo/structuredData";
import { getAllActiveTeachers } from "@/lib/data/landing";
import { getConditionPage } from "@/lib/data/condition-pages";
import { teachersForCondition } from "@/lib/data/condition-links";
import type { Faq } from "@/lib/data/faqs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";
const PAGE_URL = `${SITE}/classes/prenatal/poses-to-avoid`;
const PUBLISHED = "2026-10-10";
const UPDATED = "2026-10-10";
const BOOK_HREF = "/login?next=/dashboard/book";

export const revalidate = 300;
export const metadata = {
  title: "Prenatal Yoga Poses to Avoid",
  description:
    "Which yoga poses to avoid in pregnancy, trimester by trimester, and what we do instead in a live 1:1 prenatal session. Written to be read alongside your midwife's or doctor's advice.",
  alternates: { canonical: "/classes/prenatal/poses-to-avoid" },
};

const AVOID = [
  {
    what: "Lying flat on your back, after early pregnancy",
    why: "From around the second trimester the weight of the uterus can press on the large vein that returns blood to the heart, which can leave you dizzy or breathless. Supine poses and final relaxation are the usual culprits.",
    instead: "Rest on your left side, or recline on a bolster set at an incline so your upper body stays raised. Side-lying relaxation replaces the usual flat finish.",
  },
  {
    what: "Deep twists",
    why: "Closed twists compress the abdomen. Even gentle ones should stay open and away from the belly rather than wringing through it.",
    instead: "Open, upper-back twists that turn the chest away from the bent knee, kept small and comfortable.",
  },
  {
    what: "Deep backbends",
    why: "Full wheel, camel and similar poses load an abdomen that is already stretching, and can strain the lower back as your centre of gravity moves forward.",
    instead: "A gentle supported bridge, cat-cow, and chest openers against a wall, all within a comfortable range.",
  },
  {
    what: "Strong abdominal and core work",
    why: "Crunches, boat pose and planks held for strength can increase the separation of the abdominal muscles (diastasis recti) that pregnancy already encourages.",
    instead: "Gentle pelvic-floor awareness and breathing that engages the deep core softly, which also prepares you for recovery after birth.",
  },
  {
    what: "Lying on your belly",
    why: "Cobra, locust and bow put direct pressure on the abdomen. They are simply uncomfortable once there is a bump, and unnecessary before.",
    instead: "Cat-cow on hands and knees, and standing chest openers.",
  },
  {
    what: "Strong inversions",
    why: "Headstand, shoulderstand and handstand carry a fall risk as your balance changes, and raise blood pressure in the head. Not worth it, at any stage.",
    instead: "Legs up the wall in early pregnancy if it feels good, a gentle downward dog with hands raised on blocks, or nothing inverted at all.",
  },
  {
    what: "Breath-holding and strong, heating breath",
    why: "Holding the breath, and fast or forceful techniques like kapalbhati and bhastrika, change oxygen and blood pressure in ways nobody wants during pregnancy.",
    instead: "Soft, even breathing, gentle alternate-nostril breathing and humming breath, with no holds and no force.",
  },
  {
    what: "Hot yoga, and anything that leaves you breathless",
    why: "Overheating and over-exertion are the two things every pregnancy exercise guideline warns against. If you cannot hold a conversation, it is too much.",
    instead: "A cool room, water nearby, and a pace at which you can always talk.",
  },
];

const FAQS: Faq[] = [
  {
    q: "Is yoga safe during pregnancy at all?",
    a: "Gentle, adapted yoga is widely considered safe once your doctor or midwife has cleared you to exercise, and public health bodies such as the NHS and ACOG list it among suitable activities. The key words are adapted and cleared. Every prenatal session we teach starts with that confirmation.",
  },
  {
    q: "Which trimester has the most restrictions?",
    a: "The first trimester, when we stay especially cautious and keep everything gentle, and then from the second trimester onward the specific pose restrictions above apply, mainly around lying on your back, twisting and loading the abdomen. Your teacher adapts week by week rather than by a fixed list.",
  },
  {
    q: "What if I feel dizzy, breathless, or have any pain or bleeding?",
    a: "Stop, and contact your doctor or midwife straight away. Tell your teacher so the session can be adapted or paused. Your safety always comes first, and nobody will ever push you to continue.",
  },
  {
    q: "Can I keep doing the yoga I did before pregnancy?",
    a: "Mostly, with the poses above taken out and the intensity turned down. If you had a strong practice you may be able to keep more of it, but the rules on your back, your belly and your breath apply to everyone. A teacher who can see you is the safest way to work out what stays.",
  },
  {
    q: "When can I start again after the birth?",
    a: "After your postnatal check and your doctor's clearance, often around six weeks, and longer after a caesarean. We rebuild gently, with particular care for the core and the pelvic floor.",
  },
];

export default async function PrenatalPosesToAvoidPage() {
  const prenatal = getConditionPage("prenatal");
  const teacherSlugs = new Set(teachersForCondition("prenatal"));
  const teachers = (await getAllActiveTeachers()).filter((t) => teacherSlugs.has(t.slug));
  const taughtBy = teachers[0] ?? null;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE}/` },
          { name: "Class types", url: `${SITE}/classes` },
          { name: "Prenatal and postnatal yoga", url: `${SITE}/classes/prenatal` },
          { name: "Poses to avoid", url: PAGE_URL },
        ])}
      />
      <JsonLd
        data={articleJsonLd({
          headline: "Prenatal yoga poses to avoid, and what to do instead",
          description: metadata.description,
          url: PAGE_URL,
          datePublished: PUBLISHED,
          dateModified: UPDATED,
        })}
      />
      <JsonLd data={faqPageJsonLd(FAQS)} />

      <PageHeader
        eyebrow="Prenatal yoga guide"
        title={<>Prenatal yoga poses to avoid, <em>and what to do instead.</em></>}
        subhead="The short list every pregnant student should know, the reason behind each one, and how a 1:1 session adapts around it. Read it alongside your midwife's or doctor's advice, not instead of it."
        align="left"
      />

      <article className="px-7 pb-16">
        <div className="mx-auto max-w-3xl space-y-5 text-lg text-foreground/85 text-pretty">
          <p className="text-sm text-muted-foreground">Published {PUBLISHED}.</p>
          <p>
            Pregnancy does not mean stopping yoga. It means changing it. Most of what makes
            a practice feel good, slow movement, steady breathing, proper rest, is exactly
            what pregnancy asks for. A small number of poses and techniques, though, work
            against a changing body, and they are worth knowing by name so you can skip them
            in any class, ours or anyone else&apos;s.
          </p>
          <p>
            One rule above all the others: get your doctor&apos;s or midwife&apos;s clearance
            before you practise, and tell them if anything about your pregnancy is
            complicated. Everything below assumes a pregnancy they have cleared for gentle
            exercise.
          </p>
        </div>
      </article>

      <section className="myc-sec-mint px-7 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl tracking-tight md:text-4xl">The list.</h2>
          <ol className="mt-8 space-y-4">
            {AVOID.map((a, i) => (
              <li key={a.what} className="rounded-3xl border border-border bg-card p-6">
                <div className="flex items-start gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-[family-name:var(--font-heading)] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-xl">{a.what}</h3>
                    <p className="mt-2 text-sm text-muted-foreground text-pretty">
                      <span className="font-medium text-foreground">Why: </span>
                      {a.why}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground text-pretty">
                      <span className="font-medium text-foreground">Instead: </span>
                      {a.instead}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {prenatal && (
        <section className="px-7 py-16">
          <div className="mx-auto max-w-3xl space-y-5 text-lg text-foreground/85 text-pretty">
            <h2 className="text-3xl tracking-tight md:text-4xl">What a prenatal session looks like instead.</h2>
            <p>
              Taking poses out is the easy half. The harder half is building a practice that
              still does something for you: eases the back and hips, settles the breath, and
              gives you real rest. In a live 1:1 session the teacher can see you, so the
              session changes week to week as your body does.
            </p>
            <ul className="space-y-3 text-base">
              {prenatal.sessionChecklist.map((w) => (
                <li key={w} className="flex gap-3">
                  <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Plus className="size-3.5" />
                  </span>
                  <span className="text-muted-foreground text-pretty">{w}</span>
                </li>
              ))}
            </ul>
            <p>
              The poses we lean on, grouped by what they do, are on the{" "}
              <Link href="/classes/prenatal" className="underline underline-offset-4 hover:text-foreground">
                prenatal and postnatal yoga page
              </Link>
              .
            </p>
            <div className="pt-2">
              <Button asChild size="lg" className="h-12 rounded-full px-6">
                <Link href={BOOK_HREF}>
                  Book a prenatal 1:1
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      <section className="px-7 pb-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">Questions people ask first.</h2>
          <div className="mt-8">
            <FaqAccordion faqs={FAQS} />
          </div>
        </div>
      </section>

      <section className="px-7 pb-20">
        <div className="mx-auto flex max-w-3xl items-start gap-4 rounded-3xl bg-accent/10 p-7">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
            aria-hidden="true"
          >
            <Plus className="size-5" />
          </span>
          <div className="text-sm text-foreground/70">
            <h3 className="mb-2 text-lg text-accent">This is general guidance, not antenatal care</h3>
            <p className="text-pretty">
              Every pregnancy is different. This page describes how we adapt a general yoga
              practice; it is not medical advice and cannot account for your history. Your
              doctor or midwife has the final say on what is safe for you, and we ask for their
              clearance before your first session.
            </p>
            {taughtBy && (
              <p className="mt-4">
                Prenatal sessions here are taught by{" "}
                <Link href={`/teachers/${taughtBy.slug}`} className="font-medium text-foreground underline underline-offset-4">
                  {taughtBy.display_name}
                </Link>
                {taughtBy.headline ? `, ${taughtBy.headline}` : ""}.
              </p>
            )}
            {prenatal?.citations && prenatal.citations.length > 0 && (
              <div className="mt-4">
                <p className="font-medium text-foreground">Further reading, from public health bodies</p>
                <ul className="mt-1.5 space-y-1">
                  {prenatal.citations.map((c) => (
                    <li key={c.url}>
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
                        {c.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      <RelatedLinks
        title="Related."
        items={[
          { href: "/classes/prenatal", label: "1:1 prenatal and postnatal yoga", note: "Trimester by trimester, then gentle recovery after birth." },
          { href: "/classes/pcos", label: "1:1 yoga for PCOS", note: "Often the chapter before this one." },
          { href: "/classes/pain-relief", label: "1:1 yoga for back and neck pain", note: "For the lower back that pregnancy finds first." },
        ]}
        cta={{ href: "/private-online-yoga-classes", label: "How a private online session works" }}
      />

      <FinalCTA headline="Book a prenatal session, cleared by your doctor." />
    </>
  );
}
