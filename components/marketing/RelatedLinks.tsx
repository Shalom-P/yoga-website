import Link from "next/link";

type Item = { href: string; label: string; note?: string };

/**
 * Contextual internal links. Server-rendered on purpose so the anchors are in
 * the crawlable HTML: the condition and teacher pages previously emitted only
 * nav, footer and CTA links, making them link sinks.
 *
 * Anchor text carries the destination's real subject rather than brand voice
 * ("Book a 1:1 session"), because that is the only signal a crawler gets about
 * what sits on the other end.
 */
export function RelatedLinks({
  title,
  items,
  cta,
}: {
  title: string;
  items: Item[];
  cta?: Item;
}) {
  if (!items.length && !cta) return null;
  return (
    <section className="myc-sec-cream px-7 py-16">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-tight md:text-3xl">
          {title}
        </h2>
        {items.length > 0 && (
          <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className="myc-glass block h-full rounded-xl px-5 py-4 transition-colors hover:bg-foreground/[0.06]"
                >
                  <span className="block font-medium">{it.label}</span>
                  {it.note && (
                    <span className="mt-1 block text-sm text-muted-foreground">{it.note}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {cta && (
          <p className="mt-6 text-sm text-muted-foreground">
            <Link href={cta.href} className="underline underline-offset-4 hover:text-foreground">
              {cta.label}
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
