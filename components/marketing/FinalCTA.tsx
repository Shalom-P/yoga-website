"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/events";

export function FinalCTA({ headline }: { headline: string }) {
  return (
    <section className="px-6 pb-[120px] pt-5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        // Fixed teal panel in both palettes: it has to read as a lifted plate
        // against the page, so it does not follow --primary.
        style={{ background: "linear-gradient(160deg, #0f5c4e, #0b463b)" }}
        className="relative mx-auto max-w-[1200px] overflow-hidden border border-[rgba(251,247,239,0.14)] px-8 py-20 text-center text-[#fbf7ef] shadow-[0_60px_120px_-60px_rgba(0,0,0,0.6)] md:px-8 md:py-24"
      >
        {/* decorative orbs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-[120px] -top-[140px] size-[420px] rounded-full bg-[rgba(255,106,77,0.35)] blur-[110px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[160px] -left-[100px] size-[380px] rounded-full bg-[rgba(251,247,239,0.12)] blur-[110px]"
        />

        <div className="relative z-10">
          <div className="mb-5 text-[13px] font-semibold uppercase tracking-[0.16em] text-[rgba(251,247,239,0.7)]">
            Start your practice
          </div>
          <h2 className="mx-auto max-w-[18ch] text-[clamp(2.4rem,5.2vw,4.6rem)] font-medium leading-[1.04] tracking-[-0.015em] text-balance text-[#fbf7ef]">
            {headline}
          </h2>
          <p className="mx-auto mt-5 max-w-[34rem] text-lg text-[rgba(251,247,239,0.75)] text-pretty">
            Meet a teacher who&apos;ll know your name, and your goals.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-9 h-auto bg-accent px-[30px] py-4 text-base font-semibold text-accent-foreground shadow-[0_20px_50px_-18px_rgba(207,58,31,0.35)] hover:bg-[var(--myc-accent-hover)] hover:text-accent-foreground"
            onClick={() => track("cta_click", { position: "final" })}
          >
            <Link href="/login?next=/dashboard/book">
              Book a session
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
          <div className="mt-6 text-sm text-[rgba(251,247,239,0.7)]">
            100% personalised 1:1s · No subscription · Pay only for what you book
          </div>
        </div>
      </motion.div>
    </section>
  );
}
