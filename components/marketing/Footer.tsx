import Link from "next/link";
import { NewsletterForm } from "@/components/marketing/NewsletterForm";
import { BrandMark } from "@/components/shared/BrandMark";
import { YogaFigure } from "@/components/shared/YogaFigure";

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-foreground text-background">
      {/* decorative figure motif */}
      <YogaFigure
        pose="tree"
        className="pointer-events-none absolute -right-6 top-10 hidden w-40 text-background/10 md:block"
      />

      <div className="mx-auto grid max-w-[1240px] gap-12 px-7 pb-10 pt-20 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="mb-4 flex items-center gap-3">
            <BrandMark className="bg-background text-foreground" />
            <span className="font-[family-name:var(--font-cormorant)] text-[1.55rem] font-semibold leading-none">
              My Yoga Classes
            </span>
          </Link>
          <p className="max-w-xs text-pretty text-sm text-background/75">
            Live, private 1:1 yoga with expert teachers from India. Book a free session in your
            local time — no credit card required.
          </p>
          <div className="mt-6 max-w-sm">
            <NewsletterForm />
          </div>
        </div>

        <div>
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-background/60">
            Explore
          </div>
          <ul className="space-y-2.5 text-sm text-background/80">
            <li><Link href="/teachers" className="hover:text-accent">Teachers</Link></li>
            <li><Link href="/classes" className="hover:text-accent">Class types</Link></li>
            <li><Link href="/pricing" className="hover:text-accent">Pricing</Link></li>
            <li><Link href="/faq" className="hover:text-accent">FAQ</Link></li>
            <li><Link href="/reviews" className="hover:text-accent">Reviews</Link></li>
          </ul>
        </div>

        <div>
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-background/60">
            Company
          </div>
          <ul className="space-y-2.5 text-sm text-background/80">
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
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-background/60">
            Legal
          </div>
          <ul className="space-y-2.5 text-sm text-background/80">
            <li><Link href="/legal/terms" className="hover:text-accent">Terms</Link></li>
            <li><Link href="/legal/privacy" className="hover:text-accent">Privacy</Link></li>
            <li><Link href="/legal/refund" className="hover:text-accent">Refund policy</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-background/15">
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-4 px-7 py-6 text-xs text-background/55 sm:flex-row">
          <span>© {new Date().getFullYear()} My Yoga Classes.{process.env.NEXT_PUBLIC_ABN ? ` ABN ${process.env.NEXT_PUBLIC_ABN}.` : ""}</span>
          <span>Crafted with care · Teachers in India</span>
        </div>
      </div>
    </footer>
  );
}
