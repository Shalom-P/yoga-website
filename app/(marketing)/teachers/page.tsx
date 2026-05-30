import Link from "next/link";
import { Star } from "lucide-react";
import { getFeaturedTeachers } from "@/lib/data/landing";
import { PageHeader } from "@/components/marketing/PageHeader";
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
      <PageHeader
        eyebrow="Teachers"
        title={<>The humans on <em>the other end</em> of your mat.</>}
        subhead="Every teacher is at least 200-hr Yoga Alliance certified, with years of in-studio experience translated to live online classes."
      />

      <section className="pb-24">
        <div className="mx-auto grid max-w-[1240px] gap-6 px-7 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((t) => (
            <Link
              key={t.id}
              href={`/teachers/${t.slug}`}
              className="group overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-[var(--myc-shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--myc-shadow-soft)]"
            >
              <div
                className="relative aspect-[4/5]"
                style={{
                  background:
                    "radial-gradient(circle at 30% 25%, var(--myc-peach), transparent 55%), radial-gradient(circle at 75% 70%, var(--myc-mint), transparent 55%), var(--myc-butter)",
                }}
              >
                <svg viewBox="0 0 300 375" className="absolute inset-0 size-full text-primary">
                  <circle cx="150" cy="135" r="48" fill="currentColor" opacity="0.55" />
                  <path
                    d="M 60 240 Q 150 160 240 240 Q 260 320 220 360 L 80 360 Q 40 320 60 240 Z"
                    fill="currentColor"
                    opacity="0.45"
                  />
                </svg>
                <div className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full border border-border bg-card/90 px-2.5 py-1 text-xs backdrop-blur">
                  <Star className="size-3 fill-accent text-accent" />
                  <span className="font-medium">{Number(t.rating_avg).toFixed(1)}</span>
                  <span className="text-muted-foreground">· {t.rating_count}</span>
                </div>
              </div>
              <div className="p-6">
                <div className="font-[family-name:var(--font-cormorant)] text-2xl font-semibold leading-tight">
                  {t.display_name}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{t.headline}</div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {t.specialties.slice(0, 3).map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <div className="mt-5 text-sm font-semibold text-primary group-hover:text-accent">
                  Book with {t.display_name.split(" ")[0]} →
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
