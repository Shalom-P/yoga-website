"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { ClassCategory } from "@/lib/supabase/types";

/**
 * Homepage "what you can work on" band. The design compresses what used to be a
 * full card grid (StyleCards, still used on /classes) into a single glass panel
 * with one chip per condition, so the landing page stays scannable and the
 * detail pages carry the depth.
 */
export function PracticeSection({ categories }: { categories: ClassCategory[] }) {
  if (categories.length === 0) return null;

  return (
    <section id="classes" className="px-6 pb-[110px] pt-5">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
        style={{
          background:
            "linear-gradient(135deg, var(--myc-glow-1), color-mix(in srgb, var(--foreground) 3%, transparent))",
        }}
        className="mx-auto grid max-w-[1200px] items-center gap-8 border border-foreground/12 p-10 backdrop-blur-[18px] md:grid-cols-2"
      >
        <div>
          <div className="mb-3.5 text-[13px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            What you can work on
          </div>
          <h2 className="text-[clamp(1.9rem,3.4vw,2.8rem)] font-medium leading-[1.1] tracking-[-0.01em] text-balance">
            Yoga shaped around whatever your body needs.
          </h2>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/classes/${c.slug}`}
              className="border border-foreground/16 bg-foreground/[0.07] px-[18px] py-2.5 text-[15px] font-medium text-foreground transition-colors duration-300 hover:bg-accent/25"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
