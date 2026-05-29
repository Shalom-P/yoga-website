import Link from "next/link";
import { NewsletterForm } from "@/components/marketing/NewsletterForm";

export function Footer() {
  return (
    <footer className="mt-32 border-t border-border bg-muted/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 grid gap-12 md:grid-cols-5">
        <div className="md:col-span-2">
          <Link href="/" className="flex items-center gap-2 mb-4">
            <span className="size-7 rounded-full bg-primary inline-flex items-center justify-center">
              <span className="size-2.5 rounded-full bg-background" />
            </span>
            <span className="font-[family-name:var(--font-heading)] text-lg">
              MYYOGACLASSES
            </span>
          </Link>
          <p className="text-sm text-muted-foreground max-w-xs text-pretty">
            Live online yoga with expert teachers from India. Book a free 1:1 in your
            local time — no credit card required.
          </p>
          <div className="mt-6 max-w-sm">
            <NewsletterForm />
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Explore
          </div>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/teachers"  className="hover:text-foreground">Teachers</Link></li>
            <li><Link href="/classes"   className="hover:text-foreground">Class types</Link></li>
            <li><Link href="/pricing"   className="hover:text-foreground">Pricing</Link></li>
            <li><Link href="/faq"       className="hover:text-foreground">FAQ</Link></li>
            <li><Link href="/reviews"   className="hover:text-foreground">Reviews</Link></li>
          </ul>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Company
          </div>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/about"     className="hover:text-foreground">About</Link></li>
            <li><Link href="/contact"   className="hover:text-foreground">Contact</Link></li>
            <li><a href="mailto:hello@myyogaclasses.com.au" className="hover:text-foreground">Email us</a></li>
          </ul>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Legal
          </div>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/legal/terms"   className="hover:text-foreground">Terms</Link></li>
            <li><Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link></li>
            <li><Link href="/legal/refund"  className="hover:text-foreground">Refund policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} MYYOGACLASSES. ABN xx xxx xxx xxx.</span>
          <span>Made with care in Australia · Teachers in India</span>
        </div>
      </div>
    </footer>
  );
}
