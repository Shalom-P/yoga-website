"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/events";

export function FinalCTA({ headline }: { headline: string }) {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <motion.div
        animate={{
          background: [
            "radial-gradient(at 20% 30%, oklch(0.6 0.12 150 / 0.25) 0px, transparent 50%)",
            "radial-gradient(at 80% 60%, oklch(0.62 0.14 38 / 0.25) 0px, transparent 50%)",
            "radial-gradient(at 50% 80%, oklch(0.6 0.12 150 / 0.25) 0px, transparent 50%)",
            "radial-gradient(at 20% 30%, oklch(0.6 0.12 150 / 0.25) 0px, transparent 50%)",
          ],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 -z-10"
      />
      <div className="mx-auto max-w-3xl text-center px-4 sm:px-6 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-6xl tracking-tight text-balance"
        >
          {headline}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-5 text-lg text-muted-foreground"
        >
          One 60-minute private session, with a teacher you choose. No card.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Button
            asChild
            size="lg"
            className="mt-9 h-13 px-7 rounded-full text-base"
            onClick={() => track("cta_click", { position: "final" })}
          >
            <Link href="/login?next=/onboarding">
              Book my free session
              <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
