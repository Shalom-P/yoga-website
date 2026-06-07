"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatAud } from "@/lib/i18n/money";
import { track } from "@/lib/analytics/events";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { startRazorpayCheckout } from "@/components/shared/razorpay-checkout";
import { toast } from "sonner";
import type { Plan, PlanFeature } from "@/lib/supabase/types";

type PlanWithFeatures = Plan & { features: PlanFeature[] };

export function PricingTeaser({ plans }: { plans: PlanWithFeatures[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function startBuy(planSlug: string) {
    setPending(planSlug);
    track("paid_plan_clicked", { plan_slug: planSlug, position: "pricing_teaser" });
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // Logged out: send to login, then auto-resume checkout on /dashboard/plan.
    if (!user) {
      const next = `/dashboard/plan?planSlug=${encodeURIComponent(planSlug)}`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!keyId) {
      toast.error("Checkout isn't configured yet.");
      setPending(null);
      return;
    }
    await startRazorpayCheckout({
      planSlug,
      keyId,
      prefill: { email: user.email ?? undefined },
      onPaid: () => {
        toast.success("Payment successful!");
        router.push("/dashboard/plan?purchased=1");
        router.refresh();
      },
      onError: (message) => {
        toast.error(message);
        setPending(null);
      },
      onDismiss: () => {
        setPending(null);
        toast.info("Payment cancelled.");
      },
    });
  }

  return (
    <section id="pricing" className="py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">
            Session packs
          </div>
          <h2 className="text-3xl md:text-5xl tracking-tight text-balance max-w-2xl mx-auto">
            Pay as you go. No lock-ins. AUD.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Your free 1:1 trial comes first — buy a pack of sessions when you&apos;re ready.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
          className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto"
        >
          {plans.map((p) => (
            <motion.div
              key={p.id}
              variants={{
                hidden: { opacity: 0, y: 24 },
                show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
              }}
              className={cn(
                "relative rounded-3xl border bg-card p-7 flex flex-col",
                p.is_featured
                  ? "border-primary/40 ring-2 ring-primary/15 shadow-lg shadow-primary/10"
                  : "border-border"
              )}
            >
              {p.is_featured && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground">
                  Most popular
                </Badge>
              )}
              <div>
                <h3 className="text-xl font-medium">{p.name}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{p.description}</p>
              </div>
              <div className="mt-6">
                <div className="text-4xl font-[family-name:var(--font-heading)]">
                  {formatAud(p.price_aud_cents)}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {p.session_credits} session{p.session_credits === 1 ? "" : "s"} included
                </div>
              </div>

              <ul className="mt-7 space-y-3 flex-1">
                {p.features?.map((f) => (
                  <li key={f.id} className="flex gap-2.5 text-sm">
                    {f.is_included ? (
                      <Check className="size-4 text-primary mt-0.5 shrink-0" />
                    ) : (
                      <X className="size-4 text-muted-foreground/60 mt-0.5 shrink-0" />
                    )}
                    <span className={cn(!f.is_included && "text-muted-foreground/70 line-through")}>
                      {f.feature_text}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                size="lg"
                variant={p.is_featured ? "default" : "outline"}
                className="mt-7 h-11 rounded-full"
                disabled={pending !== null}
                onClick={() => startBuy(p.slug)}
              >
                {pending === p.slug ? (
                  <>
                    <Loader2 className="size-4 mr-1 animate-spin" />
                    Starting checkout…
                  </>
                ) : (
                  "Get this pack"
                )}
              </Button>
            </motion.div>
          ))}
        </motion.div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          All prices in AUD inc. GST. One-time payment — no subscription.{" "}
          <Link href="/faq" className="text-primary hover:underline">
            Read the FAQ →
          </Link>
        </p>
      </div>
    </section>
  );
}
