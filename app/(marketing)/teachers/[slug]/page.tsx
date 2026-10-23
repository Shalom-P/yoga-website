import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Star, ArrowRight, Globe, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeacherIntroVideo } from "@/components/shared/TeacherIntroVideo";
import { JsonLd } from "@/components/shared/JsonLd";
import { personJsonLd, breadcrumbJsonLd } from "@/lib/seo/structuredData";
import { getTeacherBySlug, getAllActiveTeachers, getClassCategories } from "@/lib/data/landing";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";

import { RelatedLinks } from "@/components/marketing/RelatedLinks";
import { TEACHER_CONDITIONS } from "@/lib/data/condition-links";

export const revalidate = 300;

// display_name carries an honorific for every teacher on the roster ("Dr
// Sangeeta"), so a bare split(" ")[0] rendered "Meet Dr , a quick hello." and
// "Book a 1:1 with Dr" on all three profiles. Drop a leading honorific before
// taking the first token, and fall back to the full name if nothing is left.
const HONORIFICS = new Set(["dr", "dr.", "mr", "mr.", "mrs", "mrs.", "ms", "ms.", "prof", "prof."]);

function firstName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  const rest = parts.length > 1 && HONORIFICS.has(parts[0].toLowerCase()) ? parts.slice(1) : parts;
  return rest[0] ?? displayName;
}


// Without this, `revalidate` above is inert: a dynamic segment with no known
// params is server-rendered on every request and never enters the ISR cache.
// The roster is small, so prerender it all. dynamicParams stays on (default),
// so a teacher added after the build still renders on demand and is then cached.
export async function generateStaticParams() {
  const teachers = await getAllActiveTeachers();
  return teachers.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTeacherBySlug(slug);
  if (!t) {
    return { title: "Teacher", alternates: { canonical: `/teachers/${slug}` } };
  }
  // The raw `headline` alone is far too short to work as a snippet (as little
  // as 27 characters, e.g. "Yoga and Naturopathy Doctor"). Compose the pieces
  // we already hold into something that reads as a result and states the offer.
  const specialties = (t.specialties ?? []).slice(0, 2).join(", ");
  const description = [
    t.headline ? `${t.display_name}, ${t.headline}.` : `${t.display_name}, yoga teacher.`,
    specialties ? `Works with ${specialties}.` : "",
    "Book a live 1:1 online session in your local time.",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    title: `${t.display_name}: Private Yoga Teacher`,
    description,
    alternates: { canonical: `/teachers/${slug}` },
  };
}

export default async function TeacherPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTeacherBySlug(slug);
  if (!t) notFound();

  // Conditions this teacher actually works with, plus the rest of the roster.
  // Both were missing entirely: teacher pages linked only nav, footer and CTA.
  const wanted = new Set(TEACHER_CONDITIONS[slug] ?? []);
  const categories = await getClassCategories();
  const worksWith = categories
    .filter((c) => wanted.has(c.slug))
    .map((c) => ({
      href: `/classes/${c.slug}`,
      label: `1:1 yoga for ${c.name.toLowerCase()}`,
      note: c.description ?? undefined,
    }));
  const peers = (await getAllActiveTeachers())
    .filter((x) => x.slug !== slug)
    .map((x) => ({
      href: `/teachers/${x.slug}`,
      label: x.display_name,
      note: x.headline ?? undefined,
    }));

  const teacherUrl = `${siteUrl}/teachers/${t.slug}`;
  // `certifications` is jsonb (typed unknown); keep only non-empty strings, as
  // /doctor-led-yoga-therapy does.
  const certs = Array.isArray(t.certifications)
    ? t.certifications.filter((c): c is string => typeof c === "string" && c.trim() !== "")
    : [];
  // The clinical-route paragraph is only true for a teacher whose own record
  // shows a yoga/naturopathy doctor's training. Anyone else gets their
  // credentials listed and nothing more.
  const clinical = /\b(dr\.?|doctor|bnys|md|naturopath\w*|yogic sciences)\b/i.test(
    [t.display_name, t.headline ?? "", ...certs].join(" "),
  );

  return (
    <>
    <article className="px-7 pt-32 pb-24">
      <JsonLd data={personJsonLd(t, teacherUrl)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Teachers", url: `${siteUrl}/teachers` },
          { name: t.display_name, url: teacherUrl },
        ])}
      />
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          {t.intro_video_url ? (
            <div className="space-y-2">
              <TeacherIntroVideo src={t.intro_video_url} poster={t.avatar_url} name={t.display_name} />
              <p className="text-center text-xs text-muted-foreground">
                Meet {firstName(t.display_name)}, a quick hello.
              </p>
            </div>
          ) : (
            <div
              className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius)] border border-border"
              style={{
                background:
                  "radial-gradient(circle at 30% 25%, var(--myc-peach), transparent 55%), radial-gradient(circle at 75% 70%, var(--myc-mint), transparent 55%), var(--myc-butter)",
              }}
            >
              {t.avatar_url ? (
                <Image
                  src={t.avatar_url}
                  alt={t.display_name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 40vw"
                />
              ) : (
                <svg viewBox="0 0 300 375" className="absolute inset-0 size-full text-primary">
                  <circle cx="150" cy="135" r="56" fill="currentColor" opacity="0.55" />
                  <path
                    d="M 60 240 Q 150 160 240 240 Q 260 320 220 360 L 80 360 Q 40 320 60 240 Z"
                    fill="currentColor"
                    opacity="0.45"
                  />
                </svg>
              )}
            </div>
          )}
        </div>
        <div className="lg:col-span-7">
          {t.rating_count > 0 && (
            <div className="mb-4 inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-sm">
              <Star className="size-3.5 fill-accent text-accent" />
              <span className="font-medium">{Number(t.rating_avg).toFixed(1)}</span>
              <span className="text-muted-foreground">· {t.rating_count} reviews</span>
            </div>
          )}
          <h1 className="text-[clamp(2.5rem,5vw,3.5rem)] leading-[1.08] tracking-tight">
            {t.display_name}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">{t.headline}</p>
          <p className="mt-6 text-foreground/85 text-pretty">{t.bio}</p>

          <div className="mt-8 space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <Award className="mt-0.5 size-4 text-accent" />
              <div>
                <div className="font-medium">Specialties</div>
                <div className="text-muted-foreground">{t.specialties.join(" · ")}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Globe className="mt-0.5 size-4 text-accent" />
              <div>
                <div className="font-medium">Languages</div>
                <div className="text-muted-foreground">{t.languages.join(" · ")}</div>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-accent px-6 font-semibold text-accent-foreground shadow-[var(--myc-shadow-soft)] hover:bg-accent/90"
            >
              <Link href={`/login?next=${encodeURIComponent(`/dashboard/book/${t.slug}`)}`}>
                Book a 1:1 with {firstName(t.display_name)}
                <ArrowRight className="size-4 ml-1" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 rounded-full">
              <Link href="/teachers">All teachers</Link>
            </Button>
          </div>
        </div>
      </div>
    </article>
    {/* Teacher bios are a few sentences of DB text, which left these pages at
        150-280 words. Everything below is composed from the teacher's own record
        (degrees, years, specialties, languages, conditions), so it stays true
        per teacher rather than repeating marketing copy. */}
    <section className="px-7 pb-20">
      <div className="mx-auto max-w-3xl space-y-5 text-lg text-foreground/85 text-pretty">
        <h2 className="text-3xl tracking-tight md:text-4xl">
          {firstName(t.display_name)}&apos;s training.
        </h2>
        {certs.length > 0 ? (
          <ul className="list-disc space-y-1 pl-6">
            {certs.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : t.headline ? (
          <p>{t.headline}.</p>
        ) : null}
        {clinical && (
        <p>
          {t.display_name}{" "}trained in yoga through India&apos;s clinical route: a university
          stream regulated by the Ministry of AYUSH, with anatomy, physiology and supervised
          clinical work, rather than a short teacher-training course
          {t.years_experience ? `, and has ${t.years_experience} years of experience` : ""}.
          This is not an MBBS medical degree: {firstName(t.display_name)}{" "}will not diagnose you
          or advise on medication, and a session supports your own doctor&apos;s care rather
          than replacing it. What each degree means is set out on{" "}
          <Link href="/doctor-led-yoga-therapy#qualifications" className="font-medium text-primary hover:underline">
            our doctor-led yoga therapy page
          </Link>
          .
        </p>
        )}

        <h2 className="pt-6 text-3xl tracking-tight md:text-4xl">
          Your first session with {firstName(t.display_name)}.
        </h2>
        <p>
          Sessions are 60 minutes, live over video, with {firstName(t.display_name)} watching
          only you. The first one starts with a conversation about your goals, your health
          and anything your doctor has told you about exercise, then moves into a practice
          built around that
          {t.specialties.length > 0
            ? `, drawing on ${firstName(t.display_name)}'s focus on ${t.specialties
                .slice(0, 3)
                .join(", ")
                .toLowerCase()}`
            : ""}
          .
        </p>
        <p>
          {firstName(t.display_name)} teaches from India
          {t.languages.length > 0 ? ` in ${t.languages.join(", ")}` : ""}, and every slot on
          the booking page is shown in your own time zone, so you pick a time that fits your
          day without converting from IST. If you have medical reports you want{" "}
          {firstName(t.display_name)} to see, you can share them privately from your
          dashboard after booking, one document at a time, and revoke access whenever you
          like. Sessions come in one-time packs with no subscription; see{" "}
          <Link href="/pricing" className="font-medium text-primary hover:underline">
            prices for 1:1 online yoga
          </Link>
          .
        </p>
      </div>
    </section>
    {worksWith.length > 0 && (
      <RelatedLinks
        title={`What ${firstName(t.display_name)} works with.`}
        items={worksWith}
      />
    )}
    {peers.length > 0 && (
      <RelatedLinks
        title="Other teachers on the roster."
        items={peers}
        cta={{ href: "/classes", label: "Browse every class type we teach" }}
      />
    )}
    </>
  );
}
