import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";
import { getAllActiveTeachers } from "@/lib/data/landing";

export default async function BookPage() {
  const teachers = await getAllActiveTeachers();

  return (
    <div>
      <div className="myc-eyebrow">
        <span className="myc-dot" />
        Book a class
      </div>
      <h1 className="mt-2.5 font-[family-name:var(--font-cormorant)] text-[clamp(2.2rem,3.6vw,3rem)] font-medium leading-[1.05] tracking-[-0.015em]">
        Pick a teacher to start.
      </h1>
      <p className="mt-2 max-w-[40rem] text-[15px] text-muted-foreground">
        Every session is a private 1:1. Slots are shown in your local time.
      </p>

      <div className="mt-8 grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
        {teachers.map((t) => (
          <div
            key={t.id}
            className="myc-glass flex flex-col gap-3.5 p-4 transition-transform duration-[400ms] ease-[cubic-bezier(.2,.7,.2,1)] hover:-translate-y-1"
          >
            <div className="relative aspect-5/4 overflow-hidden border border-border bg-gradient-to-b from-[var(--myc-card-1)] to-[var(--myc-card-2)]">
              {t.avatar_url ? (
                <Image
                  src={t.avatar_url}
                  alt={t.display_name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover"
                />
              ) : (
                <svg viewBox="0 0 300 240" className="absolute inset-0 size-full text-primary">
                  <circle cx="150" cy="100" r="38" fill="currentColor" opacity="0.6" />
                  <path
                    d="M 70 200 Q 150 130 230 200 Q 240 230 200 240 L 100 240 Q 60 230 70 200 Z"
                    fill="currentColor"
                    opacity="0.5"
                  />
                </svg>
              )}
              {t.rating_count > 0 && (
                <div className="pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 border border-foreground/15 bg-background/55 px-2.5 py-[5px] text-xs font-semibold backdrop-blur-[12px]">
                  <Star className="size-3 fill-accent text-accent" />
                  {Number(t.rating_avg).toFixed(1)}
                </div>
              )}
            </div>
            <div>
              <div className="font-[family-name:var(--font-cormorant)] text-[23px] font-semibold leading-[1.1]">
                {t.display_name}
              </div>
              <div className="mt-0.5 text-[13.5px] text-muted-foreground">{t.headline}</div>
            </div>
            <Link
              href={`/dashboard/book/${t.slug}`}
              className="mt-auto flex items-center justify-center gap-2 bg-accent px-4 py-[11px] text-sm font-semibold text-accent-foreground transition-colors hover:bg-[var(--myc-accent-hover)]"
            >
              See available times <span aria-hidden>→</span>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
