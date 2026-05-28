import Link from "next/link";
import { Star, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFeaturedTeachers } from "@/lib/data/landing";

export default async function BookPage() {
  const teachers = await getFeaturedTeachers();

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium">
        Book a class
      </div>
      <h1 className="text-3xl md:text-4xl font-[family-name:var(--font-heading)] tracking-tight mt-1">
        Pick a teacher to start.
      </h1>
      <p className="mt-2 text-muted-foreground">
        Your first 1:1 with any teacher is free. Slots are shown in your local time.
      </p>

      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {teachers.map((t) => (
          <div
            key={t.id}
            className="rounded-3xl border border-border bg-card p-5 flex flex-col gap-4"
          >
            <div className="relative aspect-[5/4] rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 overflow-hidden">
              <svg viewBox="0 0 300 240" className="absolute inset-0 size-full text-primary">
                <circle cx="150" cy="100" r="38" fill="currentColor" opacity="0.6" />
                <path
                  d="M 70 200 Q 150 130 230 200 Q 240 230 200 240 L 100 240 Q 60 230 70 200 Z"
                  fill="currentColor"
                  opacity="0.5"
                />
              </svg>
              <div className="absolute top-3 left-3 inline-flex items-center gap-1 text-xs bg-background/85 backdrop-blur px-2 py-0.5 rounded-full">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                <span className="font-medium">{Number(t.rating_avg).toFixed(1)}</span>
              </div>
            </div>
            <div>
              <div className="font-medium">{t.display_name}</div>
              <div className="text-sm text-muted-foreground">{t.headline}</div>
            </div>
            <Button asChild size="sm" className="rounded-full mt-auto">
              <Link href={`/dashboard/book/${t.slug}`}>
                See available times
                <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
