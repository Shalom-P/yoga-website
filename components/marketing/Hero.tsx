"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/events";

type HeroProps = {
  headline: string;
  subhead: string;
  trustRating: string;
  trustCount: string;
};

export function Hero({ headline, subhead, trustRating, trustCount }: HeroProps) {
  return (
    <section id="hero" className="relative overflow-hidden pt-10 md:pt-16 pb-12 md:pb-20">
      <div className="mx-auto max-w-[1240px] px-7">
        <div className="grid items-center gap-9 lg:gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          {/* ---------- Left: copy ---------- */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="myc-eyebrow mb-6"
            >
              <span className="myc-dot" aria-hidden="true" />
              First session free · No card needed
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.05 }}
              className="text-[clamp(2.75rem,6vw,5rem)] leading-[1.08] tracking-[-0.01em] text-balance"
            >
              {headline}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-7 max-w-[34rem] text-lg md:text-xl text-muted-foreground text-pretty"
            >
              {subhead}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="mt-8 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center"
            >
              <Button
                asChild
                size="lg"
                className="h-12 px-7 rounded-full text-base font-semibold bg-accent text-white shadow-[var(--myc-shadow-soft)] hover:bg-accent/90"
                onClick={() =>
                  track("hero_cta_click", {
                    cta_text: "Book my free session",
                    position: "hero",
                  })
                }
              >
                <Link href="/login?next=/onboarding">
                  Book my free 1:1 session
                  <ArrowRight className="size-4 ml-1" />
                </Link>
              </Button>

              <Button
                asChild
                variant="ghost"
                size="lg"
                className="h-12 px-4 rounded-full text-base hover:text-accent hover:bg-transparent"
              >
                <Link href="/teachers">See today&apos;s teachers</Link>
              </Button>
            </motion.div>

            {/* Trust row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.55 }}
              className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border pt-7"
            >
              <div className="flex items-center" aria-hidden="true">
                {[
                  "from-[var(--myc-accent-soft)] to-accent",
                  "from-[var(--myc-mint)] to-primary",
                  "from-[var(--myc-butter)] to-accent",
                  "from-[var(--myc-sky)] to-primary",
                ].map((g, i) => (
                  <span
                    key={i}
                    className={`size-9 rounded-full border-2 border-background bg-gradient-to-br ${g} ${
                      i === 0 ? "" : "-ml-2.5"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {trustRating && (
                  <span className="tracking-[1px] text-accent">★★★★★</span>
                )}
                <span>
                  {trustRating && (
                    <><strong className="text-foreground">{trustRating}</strong> · </>
                  )}
                  {trustCount}
                </span>
              </div>
            </motion.div>
          </div>

          {/* ---------- Right: visual ---------- */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="relative mx-auto aspect-[1/1.04] w-full max-w-[520px]"
          >
            {/* Morphing pastel blob */}
            <div
              aria-hidden="true"
              className="myc-blob absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 30% 25%, var(--myc-peach), transparent 55%), radial-gradient(circle at 75% 70%, var(--myc-mint), transparent 55%), var(--myc-butter)",
              }}
            />

            {/* Photo placeholder (rounded-arch) */}
            <div className="absolute inset-[14%_12%_8%_12%] overflow-hidden rounded-t-[200px] rounded-b-[28px] border border-border bg-card/40 backdrop-blur-[1px]">
              <svg viewBox="0 0 300 360" className="absolute inset-0 size-full text-primary">
                <g transform="translate(150,190)">
                  <circle cx="0" cy="-58" r="30" fill="currentColor" opacity="0.8" />
                  <path
                    d="M -72 56 Q 0 -8 72 56 Q 82 92 54 92 Q 0 64 -54 92 Q -82 92 -72 56 Z"
                    fill="currentColor"
                    opacity="0.7"
                  />
                  <ellipse cx="0" cy="104" rx="96" ry="20" fill="currentColor" opacity="0.35" />
                </g>
              </svg>
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground">
                Your private session
              </span>
            </div>

            {/* Floating "private" live card */}
            <div className="myc-float absolute left-[-14px] top-[18%] flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-[var(--myc-shadow-soft)]">
              <span className="myc-pulse-dot" aria-hidden="true" />
              <span>
                <strong>100% private</strong> · just you &amp; your teacher
              </span>
            </div>

            {/* Floating "next session" card */}
            <div className="myc-float2 absolute bottom-[8%] right-[-18px] max-w-[230px] rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--myc-shadow-soft)]">
              <div className="mb-1 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                Example session
              </div>
              <div className="font-[family-name:var(--font-cormorant)] text-xl font-semibold leading-tight">
                Gentle Hatha with Aarti
              </div>
              <div className="mt-0.5 text-[13px] text-muted-foreground">
                Your chosen time · 60 min
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
