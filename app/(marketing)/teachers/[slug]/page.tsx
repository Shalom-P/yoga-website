import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, ArrowRight, Globe, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <article className="pt-32 pb-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5">
          <div className="relative aspect-[4/5] rounded-3xl bg-gradient-to-br from-primary/20 to-accent/10 border border-border/60 overflow-hidden">
            <svg viewBox="0 0 300 375" className="absolute inset-0 size-full text-primary">
              <circle cx="150" cy="135" r="56" fill="currentColor" opacity="0.6" />
              <path
                d="M 60 240 Q 150 160 240 240 Q 260 320 220 360 L 80 360 Q 40 320 60 240 Z"
                fill="currentColor"
                opacity="0.5"
              />
            </svg>
          </div>
        </div>
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-1 text-sm bg-card border border-border px-3 py-1 rounded-full mb-4">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            <span className="font-medium">{Number(t.rating_avg).toFixed(1)}</span>
            <span className="text-muted-foreground">· {t.rating_count} reviews</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-heading)] tracking-tight">
            {t.display_name}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">{t.headline}</p>
          <p className="mt-6 text-foreground/85 text-pretty">{t.bio}</p>

          <div className="mt-8 space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <Award className="size-4 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Specialties</div>
                <div className="text-muted-foreground">{t.specialties.join(" · ")}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Globe className="size-4 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Languages</div>
                <div className="text-muted-foreground">{t.languages.join(" · ")}</div>
              </div>
            </div>
          </div>

          <div className="mt-10 flex gap-3">
            <Button asChild size="lg" className="h-12 px-6 rounded-full">
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
