"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shared/BrandMark";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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
  // (marketing) group out of static/ISR rendering. Display-only, it just swaps
  // "Log in" for "Dashboard"; the real gates are middleware + server guards.
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    // getSession() reads the local auth cookie, no network round-trip.
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setIsAuthenticated(!!data.session);
    });
    // The nav stays mounted across marketing navigations, so also follow
    // sign-in/sign-out that happens after mount (including in another tab).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setIsAuthenticated(!!session);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
        scrolled
          ? "border-b border-border/60 bg-background/85 backdrop-blur-md"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-6 px-7">
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
              className="text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <>
              <Button asChild variant="ghost" size="sm" className="hover:text-accent hover:bg-transparent">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full px-5 bg-accent text-white hover:bg-accent/90">
                <Link href="/dashboard/book">Book a session</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hover:text-accent hover:bg-transparent">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full px-5 bg-accent text-white hover:bg-accent/90">
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
          className="border-t border-border bg-background md:hidden"
        >
          <div className="flex flex-col gap-3 px-7 py-4">
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
            <div className="flex gap-2 pt-2">
              {isAuthenticated ? (
                <>
                  <Button asChild variant="outline" className="flex-1">
                    <Link href="/dashboard">Dashboard</Link>
                  </Button>
                  <Button asChild className="flex-1 bg-accent text-white hover:bg-accent/90">
                    <Link href="/dashboard/book">Book</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild variant="outline" className="flex-1">
                    <Link href="/login">Log in</Link>
                  </Button>
                  <Button asChild className="flex-1 bg-accent text-white hover:bg-accent/90">
                    <Link href="/login?next=/dashboard/book">Book</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}
