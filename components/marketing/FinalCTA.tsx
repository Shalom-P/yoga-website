"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/events";

export function FinalCTA({ headline }: { headline: string }) {
  return (
    <section className="px-7 pb-[104px] pt-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative mx-auto max-w-[1240px] overflow-hidden rounded-[36px] bg-primary px-6 py-20 text-center text-primary-foreground md:px-12 md:py-24"
      >
        {/* decorative orbs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-accent/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -left-10 size-72 rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative z-10">
          <div className="myc-eyebrow mb-5 justify-center !text-primary-foreground/80">
            <span
              className="myc-dot"
              style={{ background: "var(--myc-accent-soft)" }}
              aria-hidden="true"
            />
            Your first session is on us
          </div>
          <h2 className="text-[clamp(2.5rem,5.5vw,4.75rem)] tracking-tight text-balance text-primary-foreground">
            {headline}
          </h2>
          <p className="mx-auto mt-5 max-w-[540px] text-lg text-primary-foreground/80 text-pretty">
            No card, no commitment. Book a private 1:1 today and meet a teacher who&apos;ll know
            your name — and your goals.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-9 h-12 rounded-full bg-accent px-8 text-base font-semibold text-white hover:bg-accent/90"
            onClick={() => track("cta_click", { position: "final" })}
          >
            <Link href="/login?next=/onboarding">
              Book my free session
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
          <div className="mt-6 text-sm text-primary-foreground/70">
            100% private 1:1s · Cancel anytime · No credit card for your trial
          </div>
        </div>
      </motion.div>
    </section>
  );
}
