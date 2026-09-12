"use client";

import Link from "next/link";
import { motion } from "motion/react";

const STEPS = [
  {
    n: "01",
    title: "Match with your teacher",
    body: "Tell us your level and goals. We'll pair you with the right 200-hr certified teacher from India, or pick your own.",
    href: "/teachers",
    cta: "Meet the teachers →",
  },
  {
    n: "02",
    title: "Book a time that suits you",
    body: "Choose a slot from live availability, shown in your local time. Book in seconds, pay only for the sessions you book.",
    href: "/pricing",
    cta: "See pricing →",
  },
  {
    n: "03",
    title: "Meet live, one-on-one",
    body: "Roll out your mat: it's just you and your teacher, live online. Real-time corrections, your pace, their full attention.",
    href: "/login?next=/dashboard/book",
    cta: "Book a session →",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 py-[110px]">
      <div className="mx-auto max-w-[1200px]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6 }}
          className="mb-14 grid items-end gap-8 md:grid-cols-2"
        >
          <div>
            <div className="myc-eyebrow mb-4 text-muted-foreground">
              <span className="myc-dot" aria-hidden="true" />
              How it works
            </div>
            <h2 className="text-[clamp(2.2rem,4.6vw,3.8rem)] font-medium leading-[1.06] tracking-[-0.015em] text-balance">
              From sign-up to <span className="myc-accent">savasana</span> in three steps.
            </h2>
          </div>
          <p className="text-lg text-muted-foreground text-pretty">
            No app to download. Nothing beyond your mat. A teacher whose full attention is on
            you.
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
              className="myc-glass flex min-h-[280px] flex-col gap-3.5 p-8 transition-[transform,background] duration-500 ease-[cubic-bezier(.2,.7,.2,1)] hover:-translate-y-1.5 hover:bg-foreground/[0.08]"
            >
              <div className="font-[family-name:var(--font-cormorant)] text-[56px] font-medium italic leading-none text-accent">
                {n}
              </div>
              <h3 className="mt-1.5 text-[28px] font-semibold leading-[1.15]">{title}</h3>
              <p className="text-[15.5px] text-muted-foreground text-pretty">{body}</p>
              <Link
                href={href}
                className="mt-auto self-start text-sm font-semibold text-accent hover:text-[var(--accent-bright)]"
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
