"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "motion/react";
import { FAQS } from "@/lib/data/faqs";

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
