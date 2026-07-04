"use client";

import { motion } from "motion/react";
import { StyleCards } from "@/components/marketing/ClassGrid";
import type { ClassCategory } from "@/lib/supabase/types";

// Homepage "what you can practise" section. The class-style grid under a single
// header.
export function PracticeSection({ categories }: { categories: ClassCategory[] }) {
  return (
    <section id="classes" className="py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-12 max-w-2xl text-center"
        >
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-primary">
            What you can work on
          </div>
          <h2 className="text-3xl tracking-tight text-balance md:text-5xl">
            Yoga shaped around whatever your body needs.
          </h2>
          <p className="mt-4 text-muted-foreground text-pretty">
            Pick an area for today, or let a yoga-therapy–trained teacher shape your
            personalised 1:1 around exactly what your body is working through.
          </p>
        </motion.div>

        <StyleCards categories={categories} />
      </div>
    </section>
  );
}
