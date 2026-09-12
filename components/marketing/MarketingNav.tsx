"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shared/BrandMark";
import { AccountLinks, AccountMenu } from "@/components/marketing/AccountMenu";
import { useViewer, viewerPrimaryCta } from "@/lib/auth/useViewer";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/teachers", label: "Teachers" },
  { href: "/classes", label: "Classes" },
  { href: "/pricing", label: "Pricing" },
  { href: "/reviews", label: "Reviews" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
] as const;

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  // Resolved client-side (browser Supabase session) rather than passed down
  // from the server layout: a cookies() read in the layout would opt the whole
  // (marketing) group out of static/ISR rendering. Display-only, it decides
  // which links to offer; the real gates are middleware + server guards.
  const viewer = useViewer();
  // While the session is still unknown, render the signed-out bar: it is what
  // most visitors get, and the "Book a session" CTA must not wait on a cookie
  // read. A signed-in visitor sees it swap once, a frame later.
  const signedIn = viewer.signedIn === true;
  const cta = viewerPrimaryCta(viewer.role);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="pointer-events-none fixed inset-x-0 top-0 z-40 px-5 py-3.5"
    >
      <div
        className={cn(
          "pointer-events-auto mx-auto flex max-w-[1200px] items-center justify-between gap-5 py-2.5 pl-[18px] pr-3 transition-colors duration-300",
          // Transparent over the hero, frosted once the page scrolls under it.
          scrolled ? "myc-glass-bar" : "border border-transparent",
        )}
      >
        <Link href="/" className="flex items-center gap-3" aria-label="My Yoga Classes home">
          <BrandMark breathe />
          <span className="font-[family-name:var(--font-cormorant)] text-[1.55rem] font-semibold leading-none tracking-[-0.01em]">
            My Yoga Classes
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[15px] font-medium text-foreground/78 transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {signedIn ? (
            <>
              <Button asChild size="sm" className="px-5 bg-accent text-accent-foreground hover:bg-[var(--myc-accent-hover)] hover:text-accent-foreground">
                <Link href={cta.href}>{cta.label}</Link>
              </Button>
              <AccountMenu viewer={viewer} />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hover:text-accent hover:bg-transparent">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm" className="px-5 bg-accent text-accent-foreground hover:bg-[var(--myc-accent-hover)] hover:text-accent-foreground">
                <Link href="/login?next=/dashboard/book">Book a session</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="inline-flex size-11 items-center justify-center rounded-md hover:bg-muted md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="mobile-nav-menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <motion.div
          id="mobile-nav-menu"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="myc-glass-bar pointer-events-auto mx-auto mt-2 max-w-[1200px] md:hidden"
        >
          <div className="flex max-h-[calc(100dvh-7rem)] flex-col gap-3 overflow-y-auto px-7 py-4">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="py-2 text-foreground"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            {signedIn ? (
              <>
                <Button asChild className="bg-accent text-accent-foreground hover:bg-[var(--myc-accent-hover)] hover:text-accent-foreground">
                  <Link href={cta.href} onClick={() => setOpen(false)}>{cta.label}</Link>
                </Button>
                {/* Spelled out rather than behind an avatar dropdown: a second
                    layer to dismiss on a phone, and the labels are the whole
                    point of the menu. */}
                <AccountLinks viewer={viewer} onNavigate={() => setOpen(false)} />
              </>
            ) : (
              <div className="flex gap-2 pt-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/login">Log in</Link>
                </Button>
                <Button asChild className="flex-1 bg-accent text-accent-foreground hover:bg-[var(--myc-accent-hover)] hover:text-accent-foreground">
                  <Link href="/login?next=/dashboard/book">Book</Link>
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}
