"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  Droplet,
  Gauge,
  Baby,
  Flower2,
  Bone,
  Brain,
  Flame,
  Accessibility,
  Smile,
  Leaf,
  type LucideIcon,
} from "lucide-react";
import type { ClassCategory } from "@/lib/supabase/types";

const ICON_MAP: Record<string, LucideIcon> = {
  droplet: Droplet,
  gauge: Gauge,
  baby: Baby,
  "flower-2": Flower2,
  bone: Bone,
  brain: Brain,
  flame: Flame,
  accessibility: Accessibility,
  smile: Smile,
};

// Just the grid of class-style cards — no section wrapper or header. Shared by
// the standalone /classes page (via ClassGrid below) and the homepage's merged
// PracticeSection, so the card markup lives in exactly one place.
export function StyleCards({ categories }: { categories: ClassCategory[] }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.08 } },
      }}
      className="grid sm:grid-cols-2 md:grid-cols-3 gap-5"
    >
      {categories.map((c) => {
        const Icon = ICON_MAP[c.icon_name ?? ""] ?? Leaf;
        return (
          <motion.div
            key={c.id}
            variants={{
              hidden: { opacity: 0, scale: 0.95 },
              show: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
            }}
          >
            <Link
              href={`/classes/${c.slug}`}
              className="group block rounded-3xl border border-border bg-card hover:bg-secondary/30 p-7 h-full transition-all hover:-translate-y-1 hover:shadow-md"
            >
              <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Icon className="size-6" />
              </div>
              <h3 className="text-xl font-medium">{c.name}</h3>
              <p className="mt-2 text-muted-foreground text-pretty">{c.description}</p>
              {c.helps_with.length > 0 && (
                <div className="mt-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70 mb-2">
                    Helps with
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {c.helps_with.slice(0, 3).map((h) => (
                      <li
                        key={h}
                        className="inline-flex items-center rounded-full bg-secondary/70 px-2.5 py-1 text-[11px] font-medium text-foreground/70"
                      >
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-5 text-sm font-medium text-primary">
                Explore →
              </div>
            </Link>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export function ClassGrid({ categories }: { categories: ClassCategory[] }) {
  return (
    <section id="classes" className="py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">
            What you can work on
          </div>
          <h2 className="text-3xl md:text-5xl tracking-tight text-balance max-w-2xl mx-auto">
            Yoga shaped around whatever your body is working on.
          </h2>
        </motion.div>

        <StyleCards categories={categories} />
      </div>
    </section>
  );
}
