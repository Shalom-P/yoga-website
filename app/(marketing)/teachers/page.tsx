import Link from "next/link";
import { getAllActiveTeachers } from "@/lib/data/landing";
import { PageHeader } from "@/components/marketing/PageHeader";
import { TeacherGrid } from "@/components/marketing/TeacherGrid";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";
import { JsonLd } from "@/components/shared/JsonLd";
import { teacherListJsonLd, breadcrumbJsonLd } from "@/lib/seo/structuredData";
import { TEACHER_CONDITIONS } from "@/lib/data/condition-links";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";

export const revalidate = 300;
export const metadata = {
  title: "Certified Yoga Teachers from India",
  description:
    "Meet our certified yoga teachers from India: yoga and naturopathy doctors who teach live 1:1 sessions to students around the world, in your local time.",
  alternates: { canonical: "/teachers" },
};

/** Certification strings off the jsonb column, tolerant of its shape. */
function certifications(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((c): c is string => typeof c === "string" && c.trim() !== "")
    : [];
}

export default async function TeachersPage() {
  const teachers = await getAllActiveTeachers();
  const doctors = teachers.filter((t) => /^dr\.?\s/i.test(t.display_name));

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE}/` },
          { name: "Teachers", url: `${SITE}/teachers` },
        ])}
      />
      {teachers.length > 0 && (
        <JsonLd data={teacherListJsonLd(teachers, (t) => `${SITE}/teachers/${t.slug}`)} />
      )}
      <PageHeader
        eyebrow="Teachers"
        title={<>The humans on <em>the other end</em> of your mat.</>}
        subhead="A small roster, chosen for clinical training rather than follower counts. Every teacher holds a clinical qualification in yoga and teaches live, one-to-one, from India."
      />

      {teachers.length === 0 ? (
        <p className="mx-auto max-w-md px-6 pb-24 text-center text-muted-foreground">
          Our teachers are being onboarded right now, so check back soon, or book
          a 1:1 from the homepage and we&apos;ll match you.
        </p>
      ) : (
        <TeacherGrid teachers={teachers} showHeader={false} />
      )}

      {/* Server-rendered prose. The grid above is three photo cards; without
          this the hub was 180 words and said nothing a crawler, or a cautious
          first-time student, could use to judge who teaches here. */}
      <section className="px-7 pb-20">
        <div className="mx-auto max-w-3xl space-y-5 text-lg text-foreground/85 text-pretty">
          <h2 className="text-3xl tracking-tight md:text-4xl">Who teaches here, and why it matters.</h2>
          <p>
            Most online yoga platforms list hundreds of teachers and let you sort by rating. We
            do the opposite. We keep the roster small and choose for training: every teacher
            here holds a formal qualification in yoga and naturopathy from an Indian
            university and has years of
            one-to-one teaching behind them.
          </p>
          <p>
            That matters because most people who book a private session are not here for a
            workout. They come with something specific: a back that hurts after a decade at a
            desk, a diabetes diagnosis, a pregnancy, a parent in their seventies, a mind that
            will not switch off. A teacher who has studied how the body responds to movement
            and breath can adapt a session to that, safely, and knows when to say &ldquo;ask your
            doctor first&rdquo;.
          </p>
          <p>
            Sessions are live over video, 60 minutes, just you and your teacher, shown in your
            own time zone. You choose the teacher and keep them: the same person every week,
            who remembers what you worked on last time.{" "}
            <Link href="/doctor-led-yoga-therapy" className="underline underline-offset-4 hover:text-foreground">
              Read more about doctor-led yoga therapy
            </Link>
            , or see{" "}
            <Link href="/classes" className="underline underline-offset-4 hover:text-foreground">
              the class types we teach
            </Link>
            .
          </p>
        </div>
      </section>

      {doctors.length > 0 && (
        <section className="myc-sec-cream px-7 py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl tracking-tight md:text-3xl">Qualifications, in plain words.</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground text-pretty">
              In India, yoga and naturopathy is a regulated stream of medicine under the
              Ministry of AYUSH, with its own degrees. These are not MBBS medical doctors, and
              a session is never a substitute for your own doctor&apos;s care. It does mean
              your teacher trained in anatomy, physiology and clinical practice before they
              ever taught a class.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {doctors.map((t) => {
                const certs = certifications(t.certifications);
                const conditions = TEACHER_CONDITIONS[t.slug] ?? [];
                return (
                  <li key={t.id} className="myc-glass rounded-xl p-5">
                    <Link href={`/teachers/${t.slug}`} className="block font-medium hover:underline">
                      {t.display_name}
                    </Link>
                    {t.headline && (
                      <p className="mt-1 text-sm text-muted-foreground">{t.headline}</p>
                    )}
                    {certs.length > 0 && (
                      <ul className="mt-3 space-y-1 text-sm text-foreground/80">
                        {certs.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    )}
                    {t.years_experience > 0 && (
                      <p className="mt-2 text-sm text-foreground/80">
                        {t.years_experience} years teaching
                      </p>
                    )}
                    {t.languages.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Teaches in {t.languages.join(", ")}
                      </p>
                    )}
                    {conditions.length > 0 && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Works with:{" "}
                        {conditions.map((slug, i) => (
                          <span key={slug}>
                            {i > 0 ? ", " : ""}
                            <Link href={`/classes/${slug}`} className="underline underline-offset-2 hover:text-foreground">
                              {slug.replace(/-/g, " ")}
                            </Link>
                          </span>
                        ))}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      <RelatedLinks
        title="Where to go next."
        items={[
          {
            href: "/private-online-yoga-classes",
            label: "Private online yoga classes",
            note: "How a live 1:1 works, who it suits, and what to expect in the first session.",
          },
          {
            href: "/pricing",
            label: "Session packs and prices",
            note: "One-time packs. No subscription. Sessions never expire.",
          },
          {
            href: "/classes",
            label: "Class types by condition",
            note: "Diabetes, back pain, prenatal, PCOS, seniors, stress, and more.",
          },
        ]}
      />

      <FinalCTA headline="Book a 1:1 with any teacher above." />
    </>
  );
}
