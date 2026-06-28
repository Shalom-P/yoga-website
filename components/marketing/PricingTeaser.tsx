"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/i18n/money";
import { currencyForTimezone, DEFAULT_CURRENCY, type Currency } from "@/lib/geo/region";
import { detectBrowserTimezone } from "@/lib/timezone";
import { useHasMounted } from "@/components/dashboard/local-time";
import { track } from "@/lib/analytics/events";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { startCheckout, type BankTransferIntent } from "@/components/shared/checkout";
import { BankTransferDialog } from "@/components/shared/BankTransferDialog";
import { toast } from "sonner";
import type { PlanWithFeatures } from "@/lib/data/landing";

export function PricingTeaser({ plans }: { plans: PlanWithFeatures[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [promo, setPromo] = useState("");
  const [bankIntent, setBankIntent] = useState<BankTransferIntent | null>(null);
  // The charged currency is resolved server-side at create-order (GeoIP-first).
  // For *display* we best-effort detect from the browser timezone. Computed
  // during render after mount so SSR + first client render both use the default
  // (INR) — no hydration mismatch — then it re-renders with the detected currency.
  const mounted = useHasMounted();
  const currency: Currency = mounted
    ? currencyForTimezone(detectBrowserTimezone()) ?? DEFAULT_CURRENCY
    : DEFAULT_CURRENCY;

  // Pick a plan's price in the active currency, falling back to its base price.
  function planAmount(p: PlanWithFeatures): number {
    return p.prices.find((pp) => pp.currency === currency)?.amount_cents ?? p.price_base_cents;
  }

  async function startBuy(planSlug: string) {
    setPending(planSlug);
    track("paid_plan_clicked", { plan_slug: planSlug, position: "pricing_teaser" });
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const promoCode = promo.trim() || undefined;
    // Logged out: send to login, then auto-resume checkout on /dashboard/plan.
    if (!user) {
      const promoQs = promoCode ? `&promo=${encodeURIComponent(promoCode)}` : "";
      const next = `/dashboard/plan?planSlug=${encodeURIComponent(planSlug)}${promoQs}`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    await startCheckout({
      planSlug,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
      promoCode,
      prefill: { email: user.email ?? undefined },
      onDiscountApplied: (d) =>
        toast.success(`Promo ${d.code} applied — ${formatMoney(d.amountCents, d.currency)} off.`),
      onPaid: () => {
        toast.success("Payment successful!");
        router.push("/dashboard/plan?purchased=1");
        router.refresh();
      },
      onBankTransfer: (intent) => {
        setBankIntent(intent);
        setPending(null);
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
            Pay as you go. No lock-ins.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Buy a one-time pack of sessions — no subscription, and your credits never expire.
          </p>

          <div className="mx-auto mt-6 flex max-w-xs flex-col items-center">
            <label htmlFor="promo-code" className="sr-only">
              Promo code
            </label>
            <Input
              id="promo-code"
              value={promo}
              onChange={(e) => setPromo(e.target.value.toUpperCase())}
              placeholder="Promo code (optional)"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="text-center font-mono uppercase tracking-wide"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Have a code? Enter it before choosing a pack.
            </p>
          </div>
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
                  {formatMoney(planAmount(p), currency)}
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
          Prices shown in {currency}. One-time payment — no subscription. Available to customers
          in the UAE and India.{" "}
          <Link href="/faq" className="text-primary hover:underline">
            Read the FAQ →
          </Link>
        </p>
      </div>

      <BankTransferDialog
        intent={bankIntent}
        open={bankIntent !== null}
        onOpenChange={(o) => !o && setBankIntent(null)}
      />
    </section>
  );
}
