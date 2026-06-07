import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Star, ArrowRight, Globe, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeacherIntroVideo } from "@/components/shared/TeacherIntroVideo";
import { getFeaturedTeachers } from "@/lib/data/landing";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const teachers = await getFeaturedTeachers();
  const t = teachers.find((x) => x.slug === slug);
  return {
    title: t ? `${t.display_name} — Yoga Teacher` : "Teacher",
    description: t?.headline ?? undefined,
  };
}

export default async function TeacherPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const teachers = await getFeaturedTeachers();
  const t = teachers.find((x) => x.slug === slug);
  if (!t) notFound();

  return (
    <article className="px-7 pt-32 pb-24">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          {t.intro_video_url ? (
            <div className="space-y-2">
              <TeacherIntroVideo src={t.intro_video_url} poster={t.avatar_url} name={t.display_name} />
              <p className="text-center text-xs text-muted-foreground">
                Meet {t.display_name.split(" ")[0]} — a quick hello.
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
              className="h-12 rounded-full bg-accent px-6 font-semibold text-white shadow-[var(--myc-shadow-soft)] hover:bg-accent/90"
            >
              <Link href={`/login?next=/onboarding%3Fteacher%3D${t.slug}`}>
                Book free 1:1 with {t.display_name.split(" ")[0]}
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
  );
}
