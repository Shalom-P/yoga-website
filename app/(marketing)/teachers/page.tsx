import Link from "next/link";
import { Star } from "lucide-react";
import { getFeaturedTeachers } from "@/lib/data/landing";
import { FinalCTA } from "@/components/marketing/FinalCTA";

export const revalidate = 300;
export const metadata = {
  title: "Teachers",
  description: "Meet our certified yoga teachers from India, teaching live to Australia.",
};

export default async function TeachersPage() {
  const teachers = await getFeaturedTeachers();
  return (
    <>
      <section className="pt-32 pb-12 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">
            Teachers
          </div>
          <h1 className="text-4xl md:text-6xl font-[family-name:var(--font-heading)] tracking-tight text-balance">
            The humans on the other end of your mat.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground text-pretty">
            Every teacher is at least 200-hr Yoga Alliance certified, with years of in-studio
            experience translated to live online classes.
          </p>
        </div>
      </section>

      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {teachers.map((t) => (
            <Link
              key={t.id}
              href={`/teachers/${t.slug}`}
              className="group rounded-3xl border border-border bg-card overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              <div className="relative aspect-[4/5] bg-gradient-to-br from-primary/15 via-accent/10 to-secondary">
                <svg viewBox="0 0 300 375" className="absolute inset-0 size-full text-primary">
                  <circle cx="150" cy="135" r="48" fill="currentColor" opacity="0.6" />
                  <path
                    d="M 60 240 Q 150 160 240 240 Q 260 320 220 360 L 80 360 Q 40 320 60 240 Z"
                    fill="currentColor"
                    opacity="0.5"
                  />
                </svg>
                <div className="absolute top-4 left-4 inline-flex items-center gap-1 text-xs bg-background/85 backdrop-blur px-2.5 py-1 rounded-full">
                  <Star className="size-3 fill-amber-400 text-amber-400" />
                  <span className="font-medium">{Number(t.rating_avg).toFixed(1)}</span>
                  <span className="text-muted-foreground">· {t.rating_count}</span>
                </div>
              </div>
              <div className="p-5">
                <div className="font-medium text-lg">{t.display_name}</div>
                <div className="text-sm text-muted-foreground mt-1">{t.headline}</div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.specialties.slice(0, 3).map((s) => (
                    <span
                      key={s}
                      className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <FinalCTA headline="Book a free 1:1 with any teacher above." />
    </>
  );
}
