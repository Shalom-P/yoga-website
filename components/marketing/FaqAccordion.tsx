"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { Faq } from "@/lib/data/faqs";

/**
 * A page-specific FAQ accordion. The shared <FAQ> renders the site-wide FAQS;
 * guide and service pages carry their own questions and pair this with
 * faqPageJsonLd() on the server so the answers are also machine-readable.
 * Collapsed answers stay in the DOM (`hidden="until-found"` in the accordion
 * primitive), so the copy is crawlable without opening a panel.
 */
export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  return (
    <Accordion className="space-y-3">
      {faqs.map((f, i) => (
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
  );
}
