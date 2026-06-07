"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatAud } from "@/lib/i18n/money";
import { track } from "@/lib/analytics/events";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Plan, PlanFeature } from "@/lib/supabase/types";

type PlanWithFeatures = Plan & { features: PlanFeature[] };

export function PricingTeaser({ plans }: { plans: PlanWithFeatures[] }) {
  const router = useRouter();
  // Toggle filters which set of admin-created plans we show. Previously we
  // synthesised a 20% "annual" discount on the displayed price while still
  // subscribing the user to the monthly plan — that was a billing lie.
  const monthlyPlans = useMemo(
    () => plans.filter((p) => p.billing_interval === "monthly"),
    [plans],
  );
  const yearlyPlans = useMemo(
    () => plans.filter((p) => p.billing_interval === "yearly"),
    [plans],
  );
  const hasYearly = yearlyPlans.length > 0;
  const [annual, setAnnual] = useState(false);
  const visiblePlans = annual && hasYearly ? yearlyPlans : monthlyPlans;
  const [pending, setPending] = useState<string | null>(null);
  const [promo, setPromo] = useState("");

  async function startSubscribe(planSlug: string) {
    setPending(planSlug);
    track("paid_plan_clicked", { plan_slug: planSlug, position: "pricing_teaser" });
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const next = `/dashboard/plan?planSlug=${encodeURIComponent(planSlug)}`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    try {
      const res = await fetch("/api/paypal/create-subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planSlug, discountCode: promo.trim() || undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        approveUrl?: string;
        error?: string;
      };
      if (!res.ok || !body.approveUrl) {
        toast.error(
          body.error === "plan not configured"
            ? "This plan isn't ready for purchase yet — please try again shortly."
            : "Couldn't start checkout. Please try again."
        );
        setPending(null);
        return;
      }
      window.location.assign(body.approveUrl);
    } catch {
      toast.error("Network error — please try again.");
      setPending(null);
    }
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
            Plans
          </div>
          <h2 className="text-3xl md:text-5xl tracking-tight text-balance max-w-2xl mx-auto">
            Honest pricing. No lock-ins. AUD.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Your free 1:1 trial comes first — pick a plan when you&apos;re ready.
          </p>

          {hasYearly && (
            <div className="mt-7 inline-flex items-center gap-3 p-1 rounded-full border border-border bg-card">
              <button
                onClick={() => setAnnual(false)}
                className={cn(
                  "px-4 py-1.5 text-sm rounded-full transition-colors",
                  !annual ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={cn(
                  "px-4 py-1.5 text-sm rounded-full transition-colors inline-flex items-center gap-2",
                  annual ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                Annual
              </button>
            </div>
          )}
        </motion.div>

        <div className="mb-10 flex flex-col items-center gap-1.5">
          <label htmlFor="promo" className="text-xs text-muted-foreground">
            Have a promo code?
          </label>
          <input
            id="promo"
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
            placeholder="Enter code"
            autoComplete="off"
            className="w-48 rounded-full border border-border bg-card px-4 py-1.5 text-center text-sm uppercase tracking-wide outline-none focus:border-primary"
          />
        </div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
          className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto"
        >
          {visiblePlans.map((p) => {
            const cadenceSuffix =
              p.billing_interval === "yearly"
                ? "/yr"
                : p.billing_interval === "quarterly"
                ? "/quarter"
                : "/mo";
            return (
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
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-[family-name:var(--font-heading)]">
                      {formatAud(p.price_aud_cents)}
                    </span>
                    <span className="text-muted-foreground">{cadenceSuffix}</span>
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
                  onClick={() => startSubscribe(p.slug)}
                >
                  {pending === p.slug ? (
                    <>
                      <Loader2 className="size-4 mr-1 animate-spin" />
                      Starting checkout…
                    </>
                  ) : (
                    "Subscribe to this plan"
                  )}
                </Button>
              </motion.div>
            );
          })}
        </motion.div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          All prices in AUD inc. GST. Cancel anytime from your dashboard.
          {" "}
          <Link href="/faq" className="text-primary hover:underline">
            Read the FAQ →
          </Link>
        </p>
      </div>
    </section>
  );
}
