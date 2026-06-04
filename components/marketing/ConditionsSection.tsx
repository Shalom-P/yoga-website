"use client";

import { motion } from "motion/react";

// Conditions and life-stages our therapy-trained teachers work with. Plain
// strings keep this easy to edit; group headers give the list structure.
const THERAPEUTIC = [
  "Diabetes",
  "Hypertension",
  "PCOD",
  "Thyroid disorders",
  "Dyslipidemia",
  "Obesity",
  "Bronchial asthma",
  "Migraine & headaches",
  "Stress",
  "Anxiety, depression & PTSD",
  "Pain relief",
  "Gut health — gastritis, IBS, IBD, constipation, indigestion",
];

const LIFE_STAGE = [
  "Peri-menopausal yoga",
  "Prenatal yoga",
  "Geriatric yoga",
  "Kids yoga",
];

function Pills({ items }: { items: string[] }) {
  return (
    <motion.ul
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
      className="flex flex-wrap gap-2.5"
    >
      {items.map((item) => (
        <motion.li
          key={item}
          variants={{
            hidden: { opacity: 0, y: 10 },
            show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
          }}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm"
        >
          <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
          {item}
        </motion.li>
      ))}
    </motion.ul>
  );
}

export function ConditionsSection() {
  return (
    <section id="conditions" className="myc-sec-cream py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 max-w-2xl"
        >
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-primary">
            What we help with
          </div>
          <h2 className="text-3xl tracking-tight text-balance md:text-5xl">
            Yoga, guided for your body&apos;s needs.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Our teachers are trained in yoga therapy. Whatever you&apos;re managing, your
            private 1:1 is built around it — gently, and at your pace.
          </p>
        </motion.div>

        <div className="grid gap-12 md:grid-cols-[2fr_1fr]">
          <div>
            <h3 className="mb-5 text-sm font-semibold uppercase tracking-[0.12em] text-foreground/70">
              Therapeutic &amp; condition-specific yoga
            </h3>
            <Pills items={THERAPEUTIC} />
          </div>
          <div>
            <h3 className="mb-5 text-sm font-semibold uppercase tracking-[0.12em] text-foreground/70">
              Yoga for every life stage
            </h3>
            <Pills items={LIFE_STAGE} />
          </div>
        </div>

        <p className="mt-12 text-sm text-muted-foreground">
          Not sure where to start?{" "}
          <a href="/login?next=/onboarding" className="font-medium text-primary hover:underline">
            Book a free 1:1
          </a>{" "}
          and tell your teacher what you&apos;re working on.
        </p>
      </div>
    </section>
  );
}
