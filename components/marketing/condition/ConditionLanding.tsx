"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import type { ConditionPage } from "@/lib/data/condition-pages";

const BOOK_HREF = "/login?next=/dashboard/book";

/** Scroll-reveal wrapper matching the rest of the marketing site's Motion idiom. */
function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.6 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionEyebrow({
  children,
  centered,
}: {
  children: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <div className={`myc-eyebrow mb-4 ${centered ? "justify-center" : ""}`}>
      <span className="myc-dot" aria-hidden="true" />
      {children}
    </div>
  );
}

/** Renders the testimonial attribution, keeping the leading "<strong>…</strong>" bold. */
function TestimonialWho({ html }: { html: string }) {
  const m = html.match(/^<strong>(.*?)<\/strong>\s*(.*)$/);
  if (m) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{m[1]}</span> {m[2]}
      </p>
    );
  }
  return <p className="mt-6 text-sm text-muted-foreground">{html}</p>;
}

export function ConditionLanding({ data: d }: { data: ConditionPage }) {
  return (
    <>
      {/* 1 · HERO */}
      <section className="px-7 pt-32 pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <SectionEyebrow centered>{d.eyebrow}</SectionEyebrow>
          <h1 className="text-[clamp(2.75rem,6vw,4.5rem)] leading-[1.08] tracking-tight text-balance [&_em]:text-accent [&_em]:italic">
            {d.h1Before}
            <em>{d.h1Em}</em>
            {d.h1After}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground text-pretty">
            {d.heroLead}
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-full px-6">
              <Link href={BOOK_HREF}>
                Book a 1:1 session
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 rounded-full px-6">
              <Link href="#how-it-helps">How it helps</Link>
            </Button>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
60 min · 1:1 · live on Google Meet
          </p>
        </div>
      </section>

      {/* 2 · EMPATHY */}
      <section className="bg-primary px-7 py-20 text-primary-foreground">
        <Reveal className="mx-auto max-w-3xl">
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground/60">
            {d.empathyLabel}
          </div>
          <p className="font-[family-name:var(--font-heading)] text-[clamp(1.4rem,3vw,1.9rem)] leading-snug text-primary-foreground/95 text-pretty">
            {d.empathyText}
          </p>
        </Reveal>
      </section>

      {/* 3 · HOW YOGA HELPS */}
      <section id="how-it-helps" className="scroll-mt-24 px-7 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-12 max-w-2xl">
            <SectionEyebrow>Why it works</SectionEyebrow>
            <h2 className="text-3xl tracking-tight text-balance md:text-5xl">{d.helpsH2}</h2>
            <p className="mt-4 text-lg text-muted-foreground text-pretty">{d.helpsSubhead}</p>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {d.levers.map((l, i) => (
              <Reveal key={i} className="rounded-3xl border border-border bg-card p-6">
                <div className="font-[family-name:var(--font-heading)] text-sm font-semibold text-accent">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-3 text-xl">{l.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground text-pretty">{l.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 4 · POSES */}
      <section className="myc-sec-mint px-7 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-10 max-w-2xl">
            <SectionEyebrow>What you&apos;ll actually do</SectionEyebrow>
            <h2 className="text-3xl tracking-tight text-balance md:text-5xl">{d.posesH2}</h2>
            <p className="mt-4 text-lg text-muted-foreground text-pretty">{d.posesSubhead}</p>
          </Reveal>
          <div className="space-y-10">
            {d.poseGroups.map((g, gi) => (
              <Reveal key={gi}>
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border pb-3">
                  <span className="font-[family-name:var(--font-heading)] text-2xl">{g.tag}</span>
                  <span className="text-sm text-muted-foreground">{g.why}</span>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {g.poses.map((p, pi) => (
                    <div key={pi} className="rounded-2xl border border-border bg-card p-5">
                      <div className="font-[family-name:var(--font-heading)] text-lg">{p.sa}</div>
                      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.06em] text-primary">
                        {p.en}
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground text-pretty">{p.desc}</p>
                    </div>
                  ))}
                </div>
                {g.note ? (
                  <p className="mt-4 max-w-3xl text-sm italic text-muted-foreground text-pretty">
                    {g.note}
                  </p>
                ) : null}
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-10">
            <p className="max-w-2xl font-[family-name:var(--font-heading)] text-xl leading-snug text-foreground text-pretty">
              {d.selectionNote}
            </p>
          </Reveal>
        </div>
      </section>

      {/* 5 · HOW WE WORK */}
      <section className="px-7 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-12 max-w-2xl">
            <SectionEyebrow>Working together</SectionEyebrow>
            <h2 className="text-3xl tracking-tight text-balance md:text-5xl">{d.howH2}</h2>
            <p className="mt-4 text-lg text-muted-foreground text-pretty">{d.howSubhead}</p>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {d.steps.map((s, i) => (
              <Reveal key={i} className="rounded-3xl border border-border bg-card p-6">
                <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 font-[family-name:var(--font-heading)] font-semibold text-primary">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-lg">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground text-pretty">{s.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 6 + 7 · SESSION + WHO-FOR */}
      <section className="px-7 pb-24">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-[1.1fr_.9fr]">
          <Reveal className="rounded-3xl border border-border bg-card p-8">
            <h3 className="mb-5 text-xl">{d.sessionTitle}</h3>
            <ul className="space-y-3">
              {d.sessionChecklist.map((w, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="size-3.5" />
                  </span>
                  <span className="text-sm text-muted-foreground text-pretty">{w}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal className="rounded-3xl bg-secondary/50 p-8">
            <h3 className="mb-3 text-xl">{d.whoForTitle}</h3>
            <p className="text-sm text-muted-foreground text-pretty">{d.whoForText}</p>
            <h3 className="mt-6 mb-3 text-lg">{d.propsTitle}</h3>
            <div className="flex flex-wrap gap-2">
              {d.props.map((p, i) => (
                <span
                  key={i}
                  className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium"
                >
                  {p}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 8 · TESTIMONIAL */}
      <section className="myc-sec-cream px-7 py-20">
        <Reveal className="mx-auto max-w-3xl text-center">
          <blockquote className="font-[family-name:var(--font-heading)] text-[clamp(1.5rem,3.4vw,2rem)] italic leading-snug text-balance">
            &ldquo;{d.testimonialQuote}&rdquo;
          </blockquote>
          <TestimonialWho html={d.testimonialWho} />
        </Reveal>
      </section>

      {/* 9 · FAQ */}
      <section className="px-7 py-24">
        <div className="mx-auto max-w-3xl">
          <Reveal className="mb-12 text-center">
            <SectionEyebrow centered>Good to know</SectionEyebrow>
            <h2 className="text-3xl tracking-tight text-balance md:text-5xl">{d.faqH2}</h2>
          </Reveal>
          <Accordion className="space-y-3">
            {d.faqs.map((f, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="rounded-2xl border border-border bg-card px-5 data-[state=open]:bg-secondary/30"
              >
                <AccordionTrigger className="py-5 text-left text-base font-medium hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-muted-foreground text-pretty">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* 10 · SAFETY */}
      <section className="px-7 pb-20">
        <Reveal className="mx-auto flex max-w-3xl items-start gap-4 rounded-3xl bg-accent/10 p-7">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-white"
            aria-hidden="true"
          >
            <Plus className="size-5" />
          </span>
          <div>
            <h3 className="mb-2 text-lg text-accent">{d.safetyTitle}</h3>
            <p className="text-sm text-foreground/70 text-pretty">{d.safetyText}</p>
          </div>
        </Reveal>
      </section>

      {/* 11 · FINAL CTA (shared marketing component) */}
      <FinalCTA headline="Book your 1:1 session today." />
    </>
  );
}
