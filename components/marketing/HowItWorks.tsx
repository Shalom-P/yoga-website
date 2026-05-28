"use client";

import { motion } from "motion/react";
import { UserRound, CalendarClock, Video } from "lucide-react";

const STEPS = [
  {
    n: "01",
    icon: UserRound,
    title: "Pick your teacher",
    body: "Browse 200-hr+ certified yoga teachers from India. Read their stories, watch a 30-second intro, choose your match.",
  },
  {
    n: "02",
    icon: CalendarClock,
    title: "Choose a time",
    body: "Slots are shown in your local Australian time. Mornings, evenings, weekends — 7 days a week.",
  },
  {
    n: "03",
    icon: Video,
    title: "Join on Google Meet",
    body: "We email you a Meet link. Roll out your mat. Your teacher sees you, corrects you, guides you for 60 minutes.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">
            How it works
          </div>
          <h2 className="text-3xl md:text-5xl tracking-tight text-balance">
            Three small steps to your first class.
          </h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.12 } },
          }}
          className="grid md:grid-cols-3 gap-6 md:gap-8"
        >
          {STEPS.map(({ n, icon: Icon, title, body }) => (
            <motion.div
              key={n}
              variants={{
                hidden: { opacity: 0, x: 40 },
                show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } },
              }}
              className="relative rounded-3xl border border-border bg-card p-7 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300"
            >
              <span className="absolute top-6 right-6 text-xs text-muted-foreground font-mono">{n}</span>
              <Icon className="size-7 text-primary mb-5" />
              <h3 className="text-xl font-medium mb-2">{title}</h3>
              <p className="text-muted-foreground text-pretty">{body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
