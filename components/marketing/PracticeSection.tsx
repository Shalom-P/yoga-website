"use client";

import { motion } from "motion/react";
import { HeartPulse, Flower2, type LucideIcon } from "lucide-react";
import { StyleCards } from "@/components/marketing/ClassGrid";
import type { ClassCategory } from "@/lib/supabase/types";

// Conditions + life-stages our therapy-trained teachers work with. Plain strings
// keep this easy to edit; the two groups become the two cards below.
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

function ConditionCard({
  icon: Icon,
  title,
  blurb,
  items,
}: {
  icon: LucideIcon;
  title: string;
  blurb: string;
  items: string[];
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-7 shadow-sm md:p-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <h4 className="text-lg font-medium">{title}</h4>
      </div>
      <p className="mb-5 text-sm text-muted-foreground text-pretty">{blurb}</p>
      <motion.ul
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
        className="flex flex-wrap gap-2"
      >
        {items.map((item) => (
          <motion.li
            key={item}
            variants={{
              hidden: { opacity: 0, y: 8 },
              show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1.5 text-[13px] font-medium text-foreground/80"
          >
            <span className="size-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            {item}
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}

// Homepage "what you can practise" section. Merges the class-style grid and the
// (formerly separate) therapeutic/life-stage conditions into one flow under a
// single header, so the two no longer read as duplicate stacked sections.
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
            What you can practise
          </div>
          <h2 className="text-3xl tracking-tight text-balance md:text-5xl">
            Six styles. One mat. Whatever your body needs.
          </h2>
          <p className="mt-4 text-muted-foreground text-pretty">
            Pick a style for today — or let a yoga-therapy–trained teacher shape your
            private 1:1 around exactly what your body is working through.
          </p>
        </motion.div>

        <StyleCards categories={categories} />

        {/* Conditions, folded in as a continuation rather than a separate section:
            a soft inset panel with a demoted (h3) sub-header. */}
        <div className="mt-16 rounded-[2.5rem] border border-border/60 bg-secondary/40 p-7 md:mt-20 md:p-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-10 max-w-2xl text-center"
          >
            <div className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-primary">
              Trained in yoga therapy
            </div>
            <h3 className="text-2xl tracking-tight text-balance md:text-3xl">
              Guided for your body&apos;s needs
            </h3>
            <p className="mt-3 text-sm text-muted-foreground text-pretty">
              Whatever you&apos;re managing, your 1:1 is built around it — gently, and at
              your pace.
            </p>
          </motion.div>

          <div className="grid items-start gap-5 md:grid-cols-[1.5fr_1fr]">
            <ConditionCard
              icon={HeartPulse}
              title="Therapeutic & condition-specific"
              blurb="Yoga therapy for ongoing conditions, practised gently alongside your medical care."
              items={THERAPEUTIC}
            />
            <ConditionCard
              icon={Flower2}
              title="Yoga for every life stage"
              blurb="Sessions adapted to wherever you are in life."
              items={LIFE_STAGE}
            />
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Not sure where to start?{" "}
            <a
              href="/login?next=/onboarding"
              className="font-medium text-primary hover:underline"
            >
              Book a free 1:1
            </a>{" "}
            and tell your teacher what you&apos;re working on.
          </p>
        </div>
      </div>
    </section>
  );
}
