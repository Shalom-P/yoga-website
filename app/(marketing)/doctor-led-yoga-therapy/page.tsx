import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/marketing/PageHeader";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { JsonLd } from "@/components/shared/JsonLd";
import { faqPageJsonLd, breadcrumbJsonLd, teacherListJsonLd } from "@/lib/seo/structuredData";
import { getAllActiveTeachers, getClassCategories } from "@/lib/data/landing";
import { TEACHER_CONDITIONS } from "@/lib/data/condition-links";
import type { Faq } from "@/lib/data/faqs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";
const BOOK_HREF = "/login?next=/dashboard/book";

export const revalidate = 300;
export const metadata = {
  title: "Doctor-Led Yoga Therapy, Online 1:1",
  description:
    "Live 1:1 yoga therapy online with teachers who hold yoga and naturopathy doctorates. Adapted for diabetes, blood pressure, back pain, PCOS and pregnancy.",
  alternates: { canonical: "/doctor-led-yoga-therapy" },
};

const FAQS: Faq[] = [
  {
    q: "What does doctor-led mean here?",
    a: "Our teachers hold formal degrees in yoga and naturopathy from Indian universities: a Bachelor of Naturopathy and Yogic Sciences (BNYS), a five-and-a-half-year programme including a clinical internship, and in some cases a postgraduate MD in yoga. They are registered practitioners in that stream, not MBBS medical doctors, and a session is never a substitute for your own doctor's care.",
  },
  {
    q: "Is yoga therapy a treatment?",
    a: "No. Yoga therapy, as we practise it, is yoga adapted to a person's body and health situation. It supports rest, movement, breathing and an active routine alongside the care your doctor provides. It does not diagnose, treat or cure any condition, and you should never change medication without your doctor.",
  },
  {
    q: "Why does the training matter if it is not treatment?",
    a: "Because adapting yoga safely for a real body takes knowledge. A teacher who has studied anatomy, physiology and clinical practice knows which poses to avoid with high blood pressure, how to support a pregnant student, how to pace a session for someone with diabetes, and when to say \"ask your doctor first\".",
  },
  {
    q: "What conditions do you adapt for?",
    a: "Diabetes, high blood pressure, back and neck pain, PCOS and hormonal health, pregnancy and the postnatal period, weight management, stress, older adults, and children. Each has its own page explaining what a session looks like.",
  },
  {
    q: "Do I need a referral or a diagnosis?",
    a: "No. Tell us what is going on when you sign up and at the start of your first session. If you have a diagnosis, bring what your doctor has told you about exercise. If something is new, severe, or unexplained, see your doctor before you practise.",
  },
  {
    q: "Can I share my medical reports with my teacher?",
    a: "Yes, if you want to. You can upload documents privately from your dashboard and choose to share a specific document with a specific teacher you have booked. You can revoke that at any time. Nobody else can see them, including our admin team.",
  },
];

const CREDENTIAL_GLOSSARY = [
  {
    term: "BNYS",
    body: "Bachelor of Naturopathy and Yogic Sciences. A university degree in India, five and a half years including a one-year clinical internship, covering anatomy, physiology, pathology, yoga and naturopathic practice.",
  },
  {
    term: "MD in Yoga, or MD in Clinical Yoga and Naturopathy",
    body: "A postgraduate clinical degree taken after the BNYS, with a research thesis and supervised clinical work in a hospital setting.",
  },
  {
    term: "Doctor of Yogic Sciences",
    body: "A doctoral qualification in yogic sciences, the study of yoga practice and its effects on the body, taken after a postgraduate degree.",
  },
  {
    term: "Yoga Alliance RYT",
    body: "The international teaching registration most studios ask for. Every teacher here holds it in addition to their degree, not instead of it.",
  },
];

function certifications(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((c): c is string => typeof c === "string" && c.trim() !== "")
    : [];
}

export default async function DoctorLedYogaTherapyPage() {
  const [teachers, categories] = await Promise.all([getAllActiveTeachers(), getClassCategories()]);
  const bySlug = new Map(categories.map((c) => [c.slug, c]));

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE}/` },
          { name: "Doctor-led yoga therapy", url: `${SITE}/doctor-led-yoga-therapy` },
        ])}
      />
      <JsonLd data={faqPageJsonLd(FAQS)} />
      {teachers.length > 0 && (
        <JsonLd data={teacherListJsonLd(teachers, (t) => `${SITE}/teachers/${t.slug}`)} />
      )}

      <PageHeader
        eyebrow="Doctor-led yoga therapy"
        title={<>Yoga, taught by people who <em>studied the body first.</em></>}
        subhead="Every teacher here holds a degree in yoga and naturopathy from an Indian university. That is what lets them adapt a live 1:1 session to a real condition, safely, alongside your doctor's care."
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
              <Link href="/teachers">See the teachers</Link>
            </Button>
          </div>

          <div className="mt-14 space-y-5 text-lg text-foreground/85 text-pretty">
            <h2 className="text-3xl tracking-tight md:text-4xl">What yoga therapy means here.</h2>
            <p>
              Yoga therapy is not a different kind of yoga. It is ordinary yoga, adapted with
              care to the person in front of the teacher: their diagnosis, their medication,
              their energy that day, the knee that was replaced two years ago. The adaptation is
              the skill, and it is a clinical one.
            </p>
            <p>
              That is why we chose teachers with a medical-style training in yoga rather than
              a weekend certificate. In India, yoga and naturopathy is a regulated stream of
              medicine under the Ministry of AYUSH, with university degrees, hospital
              internships and postgraduate study. Our teachers came through that route, and
              then added their Yoga Alliance registration on top.
            </p>
            <p>
              Two things that training does not change. First, none of this is a treatment. A
              session supports rest, breathing, movement and an active routine alongside the
              care your doctor provides, and it never replaces it. Second, our teachers are not
              MBBS medical doctors and will not diagnose you or advise on medication. If
              something is new, severe or unexplained, they will tell you to see your doctor
              before you practise. We would rather lose a booking than guess.
            </p>
          </div>
        </div>
      </section>

      {teachers.length > 0 && (
        <section className="myc-sec-cream px-7 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-3xl tracking-tight text-balance md:text-4xl">The teachers, and their training.</h2>
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {teachers.map((t) => {
                const certs = certifications(t.certifications);
                const conditions = (TEACHER_CONDITIONS[t.slug] ?? [])
                  .map((s) => bySlug.get(s))
                  .filter((c) => c !== undefined);
                return (
                  <li key={t.id} className="myc-glass rounded-xl p-6">
                    <Link href={`/teachers/${t.slug}`} className="text-xl font-medium hover:underline">
                      {t.display_name}
                    </Link>
                    {t.headline && <p className="mt-1 text-sm text-muted-foreground">{t.headline}</p>}
                    {certs.length > 0 && (
                      <ul className="mt-4 space-y-1 text-sm text-foreground/80">
                        {certs.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    )}
                    {t.years_experience > 0 && (
                      <p className="mt-2 text-sm text-foreground/80">{t.years_experience} years teaching</p>
                    )}
                    {conditions.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {conditions.map((c) => (
                          <Link
                            key={c.slug}
                            href={`/classes/${c.slug}`}
                            className="border border-foreground/12 bg-foreground/[0.06] px-2.5 py-1 text-[12px] font-medium text-foreground/85 hover:bg-foreground/[0.12]"
                          >
                            {c.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      <section id="qualifications" className="scroll-mt-28 px-7 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">The qualifications, decoded.</h2>
          <dl className="mt-8 space-y-6">
            {CREDENTIAL_GLOSSARY.map((g) => (
              <div key={g.term} className="rounded-2xl border border-border bg-card p-6">
                <dt className="font-medium">{g.term}</dt>
                <dd className="mt-2 text-sm text-muted-foreground text-pretty">{g.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

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
          title="What we adapt sessions for."
          items={categories.map((c) => ({
            href: `/classes/${c.slug}`,
            label: `1:1 yoga for ${c.name.toLowerCase()}`,
            note: c.description ?? undefined,
          }))}
          cta={{ href: "/private-online-yoga-classes", label: "How a private online session works" }}
        />
      )}

      <FinalCTA headline="Book a session with a teacher who studied the body." />
    </>
  );
}
