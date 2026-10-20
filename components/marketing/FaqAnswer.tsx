import Link from "next/link";
import type { Faq } from "@/lib/data/faqs";

/**
 * The answer body of one FAQ entry: the prose, then the optional closing
 * sentence of links. Both accordions render this so the visible words are
 * exactly what `faqAnswerText` puts into the FAQPage JSON-LD (the sentence
 * shape, "Label one and label two.", is shared through `faqLinksSentence`).
 * Server-safe; the client accordions import it.
 */
export function FaqAnswer({ faq }: { faq: Faq }) {
  const links = faq.links ?? [];
  if (links.length === 0) return <>{faq.a}</>;
  return (
    <>
      {faq.a}{" "}
      {links.map((l, i) => (
        <span key={l.href}>
          {i > 0 && " and "}
          <Link href={l.href} className="underline underline-offset-4 hover:text-foreground">
            {l.label}
          </Link>
        </span>
      ))}
      .
    </>
  );
}
