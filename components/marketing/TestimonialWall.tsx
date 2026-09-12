"use client";

import { motion } from "motion/react";
import type { Review } from "@/lib/supabase/types";

type ReviewWithTeacher = Review & { teacher_name?: string };

export function TestimonialWall({ reviews }: { reviews: ReviewWithTeacher[] }) {
  if (!reviews || reviews.length === 0) return null;

  return (
    <section id="reviews" className="relative overflow-hidden px-6 pb-[110px] pt-[60px]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[15%] top-[10%] size-[700px] rounded-full"
        style={{ background: "var(--myc-glow-2)" }}
      />
      <div className="relative mx-auto max-w-[1200px]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-14 max-w-[740px] text-center"
        >
          <div className="mb-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            What students say
          </div>
          <h2 className="text-[clamp(2.2rem,4.6vw,3.8rem)] font-medium leading-[1.06] tracking-[-0.015em] text-balance">
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
              className="myc-glass flex flex-col gap-[18px] p-8"
            >
              <div className="text-sm tracking-[2px] text-accent" aria-hidden="true">
                {"★".repeat(Math.max(1, Math.min(5, r.rating)))}
              </div>
              <blockquote className="font-[family-name:var(--font-cormorant)] text-2xl leading-[1.3] text-foreground text-pretty">
                <span className="text-accent">“</span>
                {r.body}
                <span className="text-accent">”</span>
              </blockquote>
              <figcaption className="mt-auto flex items-center gap-3">
                <div
                  className="flex size-[42px] shrink-0 items-center justify-center bg-gradient-to-br from-accent to-[#0f5c4e] text-[13px] font-semibold text-foreground"
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
                  <div className="text-[14.5px] font-semibold">
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
