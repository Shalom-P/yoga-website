"use client";

import { motion, useInView, useMotionValue, useTransform, animate } from "motion/react";
import { useEffect, useRef } from "react";

const STATS = [
  { value: 82, label: "of students with back pain feel measurably better in 30 days" },
  { value: 76, label: "report deeper, more restful sleep after 4 weeks" },
  { value: 91, label: "say their daily stress feels easier to handle" },
];

function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.7 });
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v));

  useEffect(() => {
    if (inView) {
      const controls = animate(mv, to, { duration: 1.4, ease: "easeOut" });
      return controls.stop;
    }
  }, [inView, mv, to]);

  useEffect(() => {
    return rounded.on("change", (v) => {
      if (ref.current) ref.current.textContent = `${v}%`;
    });
  }, [rounded]);

  return (
    <span ref={ref} className="tabular-nums">
      0%
    </span>
  );
}

export function OutcomeStats() {
  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">
            What changes
          </div>
          <h2 className="text-3xl md:text-5xl tracking-tight text-balance max-w-2xl mx-auto">
            The first 30 days, by the numbers.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {STATS.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="rounded-3xl border border-border bg-card p-8 text-center"
            >
              <div className="text-6xl md:text-7xl font-[family-name:var(--font-heading)] text-primary leading-none">
                <CountUp to={s.value} />
              </div>
              <p className="mt-4 text-muted-foreground text-pretty">{s.label}</p>
            </motion.div>
          ))}
        </div>
        <p className="mt-8 text-xs text-muted-foreground text-center">
          Based on our 2026 student outcomes survey (n=1,184). Results vary.
        </p>
      </div>
    </section>
  );
}
