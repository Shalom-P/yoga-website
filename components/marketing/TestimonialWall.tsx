"use client";

import { motion } from "motion/react";
import { Star } from "lucide-react";
import type { Review } from "@/lib/supabase/types";

type ReviewWithTeacher = Review & { teacher_name?: string };

export function TestimonialWall({ reviews }: { reviews: ReviewWithTeacher[] }) {
  const cols = [
    reviews.filter((_, i) => i % 3 === 0),
    reviews.filter((_, i) => i % 3 === 1),
    reviews.filter((_, i) => i % 3 === 2),
  ];

  return (
    <section className="py-24 md:py-32 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">
            Stories from your mat-mates
          </div>
          <h2 className="text-3xl md:text-5xl tracking-tight text-balance max-w-2xl mx-auto">
            What practising with us actually feels like.
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cols.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-5">
              {col.map((r, i) => (
                <motion.figure
                  key={r.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className="rounded-3xl border border-border bg-card p-6"
                >
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: r.rating }).map((_, k) => (
                      <Star key={k} className="size-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <blockquote className="text-foreground text-pretty">
                    “{r.body}”
                  </blockquote>
                  <figcaption className="mt-5 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{r.display_name_override ?? "A student"}</div>
                      <div className="text-muted-foreground text-xs">
                        {r.display_location}
                        {r.teacher_name ? ` · with ${r.teacher_name}` : ""}
                      </div>
                    </div>
                  </figcaption>
                </motion.figure>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
