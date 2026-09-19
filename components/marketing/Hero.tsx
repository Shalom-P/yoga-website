"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/events";
import { HeroVideo } from "@/components/marketing/HeroVideo";

type HeroProps = {
  headline: string;
  subhead: string;
  trustRating: string;
  trustCount: string;
};

export function Hero({ headline, subhead, trustRating, trustCount }: HeroProps) {
  return (
    <section
      id="hero"
      // -mt-16 cancels the marketing layout's pt-16: the nav floats over the hero.
      className="relative -mt-16 flex min-h-[100svh] items-center overflow-hidden"
    >
      {/* ---------- Atmosphere ---------- */}
      <div aria-hidden="true" className="myc-hero-wash absolute inset-0" />
      <div
        aria-hidden="true"
        className="myc-breathe-glow pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 45% 65% at 76% 58%, var(--myc-glow-white), transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="myc-mist pointer-events-none absolute -inset-[20%]"
        style={{
          background:
            "radial-gradient(ellipse 40% 30% at 30% 80%, var(--myc-glow-2), transparent 70%), radial-gradient(ellipse 50% 25% at 70% 90%, var(--myc-glow-3), transparent 70%)",
        }}
      />

      {/* ---------- Video plate ----------
          Full-bleed on mobile (the copy sits over it behind a heavier scrim),
          inset to the right 62% from md up, which is the design's split. */}
      <div
        className="myc-hero-plate absolute inset-0 overflow-hidden md:left-[38%]"
        style={{
          // Feathered on md+ only; full-bleed on mobile has no edge to hide.
          maskImage:
            "linear-gradient(90deg, transparent 0%, #000 18%, #000 100%)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent 0%, #000 18%, #000 100%)",
        }}
      >
        <HeroVideo className="absolute inset-0 size-full origin-[50%_25%] scale-[1.22] object-cover object-[50%_30%]" />

        {/* Colour grade: pushes the footage into the teal palette */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "var(--myc-vid-tint)",
            mixBlendMode: "var(--myc-vid-blend)" as React.CSSProperties["mixBlendMode"],
            opacity: "var(--myc-vid-op)",
          }}
        />
        {/* Top + bottom fade into the page */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--background) 35%, transparent), transparent 30%, transparent 55%, color-mix(in srgb, var(--background) 95%, transparent) 100%)",
          }}
        />
        {/* Bottom-right corner sink */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 h-[26%] w-[38%]"
          style={{
            background:
              "radial-gradient(ellipse at 100% 100%, var(--background) 45%, transparent 100%)",
          }}
        />
      </div>

      {/* Scrim over the whole hero so the copy always clears AA against the
          footage. Heavier on mobile, where the video sits directly behind text.
          The horizontal stops are pushed further right than the design's
          (97/93/55/12 vs 95/80/25): this clip swings from a dim wide shot to a
          blown-out window across its 10s, and the copy column has to stay
          readable on every frame, not just the average one. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 md:hidden"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--background) 92%, transparent) 0%, color-mix(in srgb, var(--background) 78%, transparent) 55%, var(--background) 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden md:block"
        style={{
          background:
            "linear-gradient(90deg, color-mix(in srgb, var(--background) 97%, transparent) 0%, color-mix(in srgb, var(--background) 93%, transparent) 42%, color-mix(in srgb, var(--background) 55%, transparent) 56%, color-mix(in srgb, var(--background) 12%, transparent) 74%, transparent 88%), linear-gradient(180deg, color-mix(in srgb, var(--background) 45%, transparent), transparent 25%, transparent 72%, var(--background) 100%)",
        }}
      />

      {/* ---------- Content ---------- */}
      <div className="relative z-[2] mx-auto grid w-full max-w-[1200px] gap-10 px-6 pb-24 pt-32 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:items-end md:pb-[100px] md:pt-[140px]">
        {/* CSS entrance, not Motion: see .myc-rise in globals.css. Motion's
            `initial` prop is server-rendered as inline opacity:0, which hid the
            H1 and the primary CTA until hydration. */}
        <div className="myc-rise">
          <div className="myc-glass mb-7 inline-flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-foreground/75">
            <span className="myc-pulse-dot" aria-hidden="true" />
            Live 1:1 · Certified teachers
          </div>

          <h1 className="text-[clamp(2.8rem,6.4vw,5.6rem)] font-medium leading-[1.02] tracking-[-0.015em] text-balance">
            {headline}
          </h1>

          <p className="mt-7 max-w-[34rem] text-[19px] text-muted-foreground text-pretty">
            {subhead}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-auto px-7 py-4 text-base font-semibold bg-accent text-accent-foreground shadow-[0_20px_50px_-18px_color-mix(in_srgb,var(--accent)_45%,transparent)] hover:bg-[var(--myc-accent-hover)] hover:text-accent-foreground"
              onClick={() =>
                track("hero_cta_click", {
                  cta_text: "Book a session",
                  position: "hero",
                })
              }
            >
              <Link href="/login?next=/dashboard/book">
                Book a 1:1 session
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="ghost"
              className="myc-glass h-auto px-6 py-[15px] text-base font-medium text-foreground hover:bg-foreground/12 hover:text-foreground"
            >
              <Link href="/teachers">Meet the teachers</Link>
            </Button>
          </div>

          {/* Trust row — rating and count are admin-editable (admin_settings).
              The rating/count half only renders when BOTH are set, so we never
              publish a star rating or a review count we cannot substantiate.
              "No subscription" is a fact about the product and always shows. */}
          <div className="mt-10 flex flex-wrap items-center gap-x-3.5 gap-y-2 text-sm text-muted-foreground">
            {trustRating && trustCount && (
              <>
                <span className="tracking-[2px] text-accent" aria-hidden="true">
                  ★★★★★
                </span>
                <Link href="/reviews" className="transition-colors hover:text-foreground">
                  <strong className="font-semibold text-foreground">{trustRating}</strong> ·{" "}
                  {trustCount}
                </Link>
                <span aria-hidden="true" className="h-3.5 w-px bg-foreground/20" />
              </>
            )}
            <span>No subscription</span>
          </div>
        </div>

        {/* ---------- Floating availability card ---------- */}
        <div className="myc-rise-delayed flex justify-start md:justify-end">
          {/* Static by design. This card used to name a teacher ("Aarti") who is
              not on the roster and promise a 7:00 PM slot to every visitor in
              every timezone. Copy now states only what is true for everyone.
              Swap in a real next-open-slot render if this ever becomes live. */}
          <div className="myc-float myc-glass-over-media w-[300px] max-w-full px-[22px] py-5">
            <div className="mb-2.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Session times
            </div>
            <div className="font-[family-name:var(--font-cormorant)] text-[26px] font-semibold leading-tight">
              Early morning to late evening
            </div>
            <div className="mt-1.5 text-sm text-muted-foreground">
              Shown in your time zone · 60 min
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-foreground/12 pt-3.5">
              <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="size-[7px] rounded-full bg-accent"
                />
                Just you &amp; your teacher
              </span>
              <Link
                href="/login?next=/dashboard/book"
                className="text-[13px] font-semibold text-accent hover:text-[var(--accent-bright)]"
              >
                Book →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
