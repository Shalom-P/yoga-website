"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Star, ShieldCheck } from "lucide-react";
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
    <section
      id="hero"
      className="relative pt-32 md:pt-40 pb-20 md:pb-28 overflow-hidden gradient-mesh"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        {/* Left */}
        <div className="lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary mb-6"
          >
            <ShieldCheck className="size-3.5" />
            No credit card · No commitment · Cancel anytime
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-[64px] leading-[1.05] tracking-[-0.025em] text-balance"
          >
            {headline}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.25 }}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl text-pretty"
          >
            {subhead}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
            className="mt-8 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center"
          >
            <Button
              asChild
              size="lg"
              className="h-12 px-6 rounded-full text-base font-medium"
              onClick={() =>
                track("hero_cta_click", { cta_text: "Book my free session", position: "hero" })
              }
            >
              <Link href="/login?next=/onboarding">
                Book my free 1:1 session
                <ArrowRight className="size-4 ml-1" />
              </Link>
            </Button>

            <Button asChild variant="ghost" size="lg" className="h-12 px-4 rounded-full">
              <Link href="/teachers">Meet the teachers</Link>
            </Button>
          </motion.div>

          {/* Trust strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
              ))}
              <span className="ml-1 font-medium text-foreground">{trustRating}</span>
              <span>· {trustCount}</span>
            </div>
            <span className="hidden sm:inline text-border">|</span>
            <span>As featured in <span className="font-medium text-foreground">Wellbeing AU</span></span>
            <span className="hidden sm:inline text-border">|</span>
            <span>Teachers in India · 200-hr Yoga Alliance</span>
          </motion.div>
        </div>

        {/* Right — visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className="lg:col-span-5 relative"
        >
          <div className="relative aspect-[4/5] w-full max-w-md mx-auto rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-primary/20 via-accent/15 to-secondary border border-border/60 shadow-xl shadow-primary/5">
            {/* Placeholder visual — replace with real video poster once promotional_media is wired */}
            <svg viewBox="0 0 400 500" className="absolute inset-0 size-full">
              <defs>
                <radialGradient id="glow" cx="50%" cy="35%" r="60%">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="400" height="500" fill="url(#glow)" className="text-primary" />
              {/* Stylised seated figure */}
              <g transform="translate(200,260)" className="text-primary">
                <circle cx="0" cy="-70" r="34" fill="currentColor" opacity="0.85" />
                <path d="M -80 60 Q 0 -10 80 60 Q 90 100 60 100 Q 0 70 -60 100 Q -90 100 -80 60 Z" fill="currentColor" opacity="0.75" />
                <ellipse cx="0" cy="120" rx="110" ry="25" fill="currentColor" opacity="0.4" />
              </g>
            </svg>
            <div className="absolute bottom-4 left-4 right-4 bg-background/85 backdrop-blur rounded-2xl p-4 border border-border/40">
              <div className="text-xs text-muted-foreground">Next available 1:1</div>
              <div className="font-medium mt-0.5">Tomorrow · 7:30 AM AEST</div>
              <div className="text-xs text-muted-foreground mt-1">with Aarti · 60 min</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
