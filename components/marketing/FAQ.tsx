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
    <section id="faq" className="px-6 pb-[110px] pt-10">
      <div className="mx-auto max-w-[760px]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="mb-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Common questions
          </div>
          <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-medium leading-[1.08] tracking-[-0.015em] text-balance">
            Before you book.
          </h2>
        </motion.div>

        <Accordion className="flex flex-col gap-2.5">
          {FAQS.map((f, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="myc-glass px-[22px] data-[state=open]:bg-foreground/[0.08]"
            >
              <AccordionTrigger className="py-5 text-left text-[16.5px] font-medium hover:no-underline">
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
