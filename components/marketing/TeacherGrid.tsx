"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import type { Teacher } from "@/lib/supabase/types";
import { track } from "@/lib/analytics/events";

type TeacherGridProps = {
  teachers: Teacher[];
  /** Landing shows the section header + "see all" link; /teachers has its own. */
  showHeader?: boolean;
};

/**
 * Teacher cards as a responsive grid. Each card is a portrait plate with the
 * name, headline and specialities in a glass panel floated over the bottom of
 * the photo, per the design. (Previously a horizontal scroll carousel.)
 */
export function TeacherGrid({ teachers, showHeader = true }: TeacherGridProps) {
  if (teachers.length === 0) return null;

  return (
    <section
      id="teachers"
      className="relative overflow-hidden px-6 pb-[110px] pt-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[20%] h-[500px] w-[900px] -translate-x-1/2 rounded-full"
        style={{ background: "var(--myc-glow-1)" }}
      />

      <div className="relative mx-auto max-w-[1200px]">
        {showHeader && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
            className="mb-12 flex flex-wrap items-end justify-between gap-5"
          >
            <div>
              <div className="mb-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Meet your teachers
              </div>
              <h2 className="max-w-[18ch] text-[clamp(2.2rem,4.6vw,3.8rem)] font-medium leading-[1.06] tracking-[-0.015em] text-balance">
                Real teachers. Real adjustments.
              </h2>
            </div>
            <Link
              href="/teachers"
              className="shrink-0 text-[15px] font-semibold text-accent hover:text-[var(--accent-bright)]"
            >
              See all teachers →
            </Link>
          </motion.div>
        )}

        <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
          {teachers.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: Math.min(i, 4) * 0.06 }}
            >
              <Link
                href={`/teachers/${t.slug}`}
                onClick={() =>
                  track("teacher_card_click", { teacher_id: t.id, position: "landing" })
                }
                className="group relative block aspect-[3/4] overflow-hidden border border-foreground/12 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.55)] transition-transform duration-[600ms] ease-[cubic-bezier(.2,.7,.2,1)] hover:-translate-y-1.5 hover:scale-[1.01]"
                style={{
                  background:
                    "repeating-linear-gradient(135deg, color-mix(in srgb, var(--foreground) 4%, transparent) 0 12px, transparent 12px 24px), linear-gradient(180deg, var(--myc-card-1) 0%, var(--myc-card-2) 100%)",
                }}
              >
                {t.avatar_url && (
                  <Image
                    src={t.avatar_url}
                    alt={t.display_name}
                    fill
                    // The first card's photo is the LCP on most viewports once
                    // the hero video's poster has painted.
                    priority={i === 0}
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1200px) 33vw, 280px"
                  />
                )}

                {t.rating_count > 0 && (
                  <span className="myc-glass-bar absolute right-4 top-4 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold">
                    <span className="text-accent" aria-hidden="true">
                      ★
                    </span>
                    {Number(t.rating_avg).toFixed(1)}
                  </span>
                )}

                <span className="myc-glass-bar absolute inset-x-3 bottom-3 block px-[18px] py-4">
                  <span className="block font-[family-name:var(--font-cormorant)] text-2xl font-semibold leading-[1.1]">
                    {t.display_name}
                  </span>
                  {t.headline && (
                    <span className="mt-1 block text-[13.5px] text-muted-foreground">
                      {t.headline}
                    </span>
                  )}
                  {t.specialties.length > 0 && (
                    <span className="mt-3 flex flex-wrap gap-1.5">
                      {t.specialties.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="border border-foreground/12 bg-foreground/[0.08] px-2.5 py-1 text-[11.5px] font-medium text-foreground/85"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
