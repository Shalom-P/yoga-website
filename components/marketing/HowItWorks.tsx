"use client";

import Link from "next/link";
import { motion } from "motion/react";

const STEPS = [
  {
    n: "01",
    title: "Match with your teacher",
    body: "Tell us your level and goals. We'll pair you with the right 200-hr certified teacher from India — or pick your own.",
    href: "/teachers",
    cta: "Meet the teachers →",
  },
  {
    n: "02",
    title: "Book a time that suits you",
    body: "Choose a slot from live availability, shown in your local time. Your first 1:1 is free — no card needed to start.",
    href: "/pricing",
    cta: "See pricing →",
  },
  {
    n: "03",
    title: "Meet live, one-on-one",
    body: "Roll out your mat — it's just you and your teacher on Google Meet. Real-time corrections, your pace, their full attention.",
    href: "/login?next=/dashboard/book",
    cta: "Book free session →",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="myc-sec-cream py-[68px] md:py-[104px]">
      <div className="mx-auto max-w-[1240px] px-7">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6 }}
          className="mb-14 grid items-end gap-6 md:grid-cols-2 md:gap-14"
        >
          <div>
            <div className="myc-eyebrow mb-4">
              <span className="myc-dot" aria-hidden="true" />
              How it works
            </div>
            <h2 className="text-[clamp(2.25rem,5vw,4rem)] tracking-tight text-balance">
              From sign-up to <span className="myc-accent">savasana</span> in three steps.
            </h2>
          </div>
          <p className="text-lg text-muted-foreground text-pretty">
            No app to download. No equipment beyond your mat. Just you and a teacher who&apos;s
            fully focused on you — pay only for the sessions you book.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
          className="grid gap-5 md:grid-cols-3"
        >
          {STEPS.map(({ n, title, body, href, cta }) => (
            <motion.div
              key={n}
              variants={{
                hidden: { opacity: 0, y: 24 },
                show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
              }}
              className="flex min-h-[300px] flex-col gap-4 rounded-[var(--radius)] border border-border bg-card p-8 shadow-[var(--myc-shadow-card)]"
            >
              <div className="font-[family-name:var(--font-cormorant)] text-5xl font-medium italic leading-none text-accent">
                {n}
              </div>
              <h3 className="text-2xl">{title}</h3>
              <p className="text-[15px] text-muted-foreground text-pretty">{body}</p>
              <Link
                href={href}
                className="mt-auto self-start text-sm font-semibold text-primary hover:text-accent"
              >
                {cta}
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
