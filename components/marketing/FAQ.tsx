"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "motion/react";

const FAQS = [
  {
    q: "Is the free 1:1 session really free?",
    a: "Yes — one 60-minute private session with a teacher of your choice. No credit card. We never auto-charge you after.",
  },
  {
    q: "Do I need to be a beginner — or experienced?",
    a: "Either. Tell us your level in onboarding and we'll match you with a teacher who specialises in beginners, intermediates, or rehabilitation.",
  },
  {
    q: "Do I need a yoga mat?",
    a: "A mat helps but isn't essential for your first session. A clear 2m × 1m space, comfortable clothes, and water is enough.",
  },
  {
    q: "How does the time-zone thing work?",
    a: "All times you see are in your local Australian time. Your teacher's calendar handles the conversion to IST automatically.",
  },
  {
    q: "What if I have a back or knee injury?",
    a: "Tell us in onboarding. We'll match you with a therapy yoga teacher who specialises in safe, gentle rehabilitation.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your dashboard in two clicks. You keep access until the end of your billing period.",
  },
  {
    q: "How do I join the live class?",
    a: "We email you a Google Meet link as soon as you book, plus a reminder 24h and 1h before. Click the link, you're in.",
  },
  {
    q: "What's your refund policy?",
    a: "If your first paid class wasn't right for you, email us within 7 days for a full refund. After that, refunds are case-by-case.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">
            Common questions
          </div>
          <h2 className="text-3xl md:text-5xl tracking-tight text-balance">
            The bits people usually ask before booking.
          </h2>
        </motion.div>

        <Accordion className="space-y-3">
          {FAQS.map((f, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="rounded-2xl border border-border bg-card px-5 data-[state=open]:bg-secondary/30"
            >
              <AccordionTrigger className="text-left text-base font-medium hover:no-underline py-5">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 text-pretty">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
