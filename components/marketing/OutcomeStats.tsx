"use client";

import { motion } from "motion/react";

const STATS = [
  { value: "1:1", label: "Every class is private" },
  { value: "4.9★", label: "Average teacher rating" },
  { value: "60min", label: "Every live session" },
  { value: "7 days", label: "A week of slots to pick" },
];

export function OutcomeStats() {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-[1240px] px-7">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <div className="font-[family-name:var(--font-cormorant)] text-[clamp(3rem,5.5vw,4.75rem)] font-medium italic leading-none text-accent">
                {s.value}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
