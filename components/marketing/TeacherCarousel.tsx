"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Star } from "lucide-react";
import type { Teacher } from "@/lib/supabase/types";
import { track } from "@/lib/analytics/events";

export function TeacherCarousel({ teachers }: { teachers: Teacher[] }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const parallaxY = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <section ref={sectionRef} className="relative py-24 md:py-32 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">
              Meet your teachers
            </div>
            <h2 className="text-3xl md:text-5xl tracking-tight text-balance max-w-2xl">
              Real teachers. Real stories. Real adjustments.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl text-pretty">
              Every teacher is a 200-hr Yoga Alliance certified professional based in India,
              teaching live to your home in Australia.
            </p>
          </motion.div>
          <Link
            href="/teachers"
            className="text-sm font-medium text-primary hover:underline shrink-0"
          >
            See all teachers →
          </Link>
        </div>
      </div>

      <div className="relative overflow-x-auto overflow-y-hidden scroll-snap-x scrollbar-hide pb-4">
        <div className="flex gap-5 px-4 sm:px-6 lg:px-8 min-w-max">
          {teachers.map((t, i) => (
            <motion.div
              key={t.id}
              style={{ y: i % 2 ? parallaxY : undefined }}
              className="snap-start"
            >
              <Link
                href={`/teachers/${t.slug}`}
                onClick={() => track("teacher_card_click", { teacher_id: t.id, position: "landing" })}
                className="block w-[260px] sm:w-[300px] group"
              >
                <div className="relative aspect-[3/4] rounded-3xl bg-gradient-to-br from-primary/20 via-accent/10 to-secondary border border-border/60 overflow-hidden transition-transform duration-500 group-hover:scale-[1.02]">
                  {t.avatar_url ? (
                    <Image
                      src={t.avatar_url}
                      alt={t.display_name}
                      fill
                      // The first card's photo is the homepage LCP on most
                      // viewports — prioritise it so it isn't lazy-loaded.
                      priority={i === 0}
                      className="object-cover"
                      sizes="(max-width: 640px) 260px, 300px"
                    />
                  ) : (
                    /* Stylised silhouette placeholder until photos are uploaded */
                    <svg viewBox="0 0 300 400" className="absolute inset-0 size-full text-primary">
                      <circle cx="150" cy="135" r="48" fill="currentColor" opacity="0.6" />
                      <path
                        d="M 60 240 Q 150 160 240 240 Q 260 320 220 360 L 80 360 Q 40 320 60 240 Z"
                        fill="currentColor"
                        opacity="0.5"
                      />
                    </svg>
                  )}
                  {t.rating_count > 0 && (
                    <div className="absolute top-4 left-4 inline-flex items-center gap-1 text-xs bg-background/85 backdrop-blur px-2.5 py-1 rounded-full">
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      <span className="font-medium">{Number(t.rating_avg).toFixed(1)}</span>
                      <span className="text-muted-foreground">· {t.rating_count}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 px-1">
                  <div className="font-medium text-base">{t.display_name}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{t.headline}</div>
                  <div className="mt-2 text-xs text-primary font-medium">
                    Book with {t.display_name.split(" ")[0]} →
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
