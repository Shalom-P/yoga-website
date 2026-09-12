import Link from "next/link";
import { Instagram } from "lucide-react";
import { NewsletterForm } from "@/components/marketing/NewsletterForm";
import { BrandMark } from "@/components/shared/BrandMark";
import { YogaFigure } from "@/components/shared/YogaFigure";
import { INSTAGRAM_URL } from "@/lib/seo/structuredData";

export function Footer() {
  // The design's footer sits on the page background behind a hairline rule
  // rather than being an inverted block: on the dark palette `bg-foreground`
  // would paint a full-width cream slab.
  return (
    <footer className="relative overflow-hidden border-t border-foreground/10">
      {/* decorative figure motif */}
      <YogaFigure
        pose="tree"
        className="pointer-events-none absolute -right-6 top-10 hidden w-40 text-foreground/10 md:block"
      />

      <div className="mx-auto grid max-w-[1200px] gap-9 px-6 pb-8 pt-14 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="mb-4 flex items-center gap-3">
            <BrandMark />
            <span className="font-[family-name:var(--font-cormorant)] text-[1.55rem] font-semibold leading-none">
              My Yoga Classes
            </span>
          </Link>
          <p className="max-w-xs text-pretty text-sm text-muted-foreground">
            Live, personalised 1:1 yoga with expert teachers from India. Book a session in your
            local time.
          </p>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm text-foreground/80 hover:text-accent"
          >
            <Instagram className="size-4" aria-hidden />
            @myyogaclasses.fit
          </a>
          <div className="mt-6 max-w-sm">
            <NewsletterForm />
          </div>
        </div>

        <div>
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Explore
          </div>
          <ul className="space-y-2.5 text-sm text-foreground/80">
            <li><Link href="/teachers" className="hover:text-accent">Teachers</Link></li>
            <li><Link href="/classes" className="hover:text-accent">Class types</Link></li>
            <li><Link href="/pricing" className="hover:text-accent">Pricing</Link></li>
            <li><Link href="/faq" className="hover:text-accent">FAQ</Link></li>
            <li><Link href="/reviews" className="hover:text-accent">Reviews</Link></li>
          </ul>
        </div>

        <div>
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Company
          </div>
          <ul className="space-y-2.5 text-sm text-foreground/80">
            <li><Link href="/about" className="hover:text-accent">About</Link></li>
            <li><Link href="/contact" className="hover:text-accent">Contact</Link></li>
            <li>
              <a href="mailto:hello@myyogaclasses.fit" className="hover:text-accent">
                Email us
              </a>
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Legal
          </div>
          <ul className="space-y-2.5 text-sm text-foreground/80">
            <li><Link href="/legal/terms" className="hover:text-accent">Terms</Link></li>
            <li><Link href="/legal/privacy" className="hover:text-accent">Privacy</Link></li>
            <li><Link href="/legal/refund" className="hover:text-accent">Refund policy</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-foreground/[0.08]">
        <div className="mx-auto flex max-w-[1200px] flex-col justify-between gap-2 px-6 py-5 text-[12.5px] text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} My Yoga Classes.{process.env.NEXT_PUBLIC_ABN ? ` ABN ${process.env.NEXT_PUBLIC_ABN}.` : ""}</span>
          <span>Crafted with care · Teachers in India</span>
        </div>
      </div>
    </footer>
  );
}
