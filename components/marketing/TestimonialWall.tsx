"use client";

import { motion } from "motion/react";
import type { Review } from "@/lib/supabase/types";

type ReviewWithTeacher = Review & { teacher_name?: string };

export function TestimonialWall({ reviews }: { reviews: ReviewWithTeacher[] }) {
  if (!reviews || reviews.length === 0) return null;

  return (
    <section className="myc-sec-peach py-[68px] md:py-[104px]">
      <div className="mx-auto max-w-[1240px] px-7">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-14 max-w-[740px] text-center"
        >
          <div className="myc-eyebrow mb-4 justify-center">
            <span className="myc-dot" aria-hidden="true" />
            What our students say
          </div>
          <h2 className="text-[clamp(2.25rem,5vw,4rem)] tracking-tight text-balance">
            Real practice, <span className="myc-accent">one mat at a time.</span>
          </h2>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-3">
          {reviews.slice(0, 6).map((r, i) => (
            <motion.figure
              key={r.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="flex flex-col gap-5 rounded-[var(--radius)] border border-border bg-card p-8 shadow-[var(--myc-shadow-card)]"
            >
              <div className="tracking-[1px] text-accent" aria-hidden="true">
                {"★".repeat(Math.max(1, Math.min(5, r.rating)))}
              </div>
              <blockquote className="font-[family-name:var(--font-cormorant)] text-[1.5rem] leading-[1.32] text-foreground text-pretty">
                <span className="text-accent">“</span>
                {r.body}
                <span className="text-accent">”</span>
              </blockquote>
              <figcaption className="mt-auto flex items-center gap-3">
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary text-sm font-semibold text-accent-foreground"
                  aria-hidden="true"
                >
                  {(r.display_name_override ?? "")
                    .split(" ")
                    .map((w) => w[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase() || "★"}
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    {r.display_name_override ?? "Verified student"}
                  </div>
                  <div className="text-[13px] text-muted-foreground">
                    {r.display_location ?? r.teacher_name ?? "Practising with us"}
                  </div>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
