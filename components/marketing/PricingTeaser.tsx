"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, X, Loader2, Tag, AlertCircle } from "lucide-react";
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
import { promoCodeForCheckout, type PromoPreviewResult } from "@/lib/billing/promoPreview";

/**
 * Wait for a pause in typing before asking the server to price a code. Every
 * non-empty value is checked, however short: an unchecked value would still be
 * forwarded to checkout (promoCodeForCheckout can only withhold what it has a
 * verdict on), and checkout rejects an unknown code by refusing the sale.
 */
const PROMO_DEBOUNCE_MS = 450;

/** What we know about one specific code. */
type PromoOutcome =
  /** The server priced it (or rejected it outright); `result` says which. */
  | { kind: "answered"; result: PromoPreviewResult }
  /** Not signed in, so the code can't be checked yet. Not a failure. */
  | { kind: "signed_out" }
  | { kind: "failed" };

export function PricingTeaser({ plans }: { plans: PlanWithFeatures[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [promo, setPromo] = useState("");
  const [bankIntent, setBankIntent] = useState<BankTransferIntent | null>(null);
  // Live promo pricing. The outcome is stored against the exact code it answers,
  // so everything the UI needs is DERIVED below rather than reset field by field
  // on every keystroke: a result for a stale code simply stops matching. It also
  // means backspacing to a code we already priced re-shows it with no round trip.
  const [outcome, setOutcome] = useState<{ code: string; result: PromoOutcome } | null>(null);
  const trimmedPromo = promo.trim();
  const promoActive = trimmedPromo.length > 0;
  const settled = promoActive && outcome?.code === trimmedPromo ? outcome.result : null;
  const checkingPromo = promoActive && settled === null;
  // Null whenever we can't say (checking, failed, signed out), which is exactly
  // what promoCodeForCheckout treats as "let the server decide".
  const previewResult = settled?.kind === "answered" ? settled.result : null;
  const preview = previewResult?.ok ? previewResult : null;
  const promoError =
    previewResult && !previewResult.ok
      ? previewResult.message
      : settled?.kind === "failed"
        ? "Couldn't check that code. Please try again."
        : null;
  const promoNeedsSignIn = settled?.kind === "signed_out";
  // The charged currency is resolved server-side at create-order (GeoIP-first).
  // For *display* we best-effort detect from the browser timezone. Computed
  // during render after mount so SSR + first client render both use the default
  // (INR), no hydration mismatch, then it re-renders with the detected currency.
  const mounted = useHasMounted();
  const currency: Currency = mounted
    ? currencyForTimezone(detectBrowserTimezone()) ?? DEFAULT_CURRENCY
    : DEFAULT_CURRENCY;
  // Once a preview lands, trust its currency over the local guess: it came from
  // the same GeoIP-first resolution that will decide what the customer is charged.
  const displayCurrency: Currency = preview?.currency ?? currency;

  // Price the typed code across every pack, debounced, so the customer sees what
  // they'd pay before committing to checkout. Read-only server-side: previewing
  // reserves nothing, so an idle input can't burn the code's usage allowance.
  useEffect(() => {
    // Nothing typed: render already derives the cleared state.
    if (!trimmedPromo) return;

    let cancelled = false;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      let result: PromoOutcome;
      try {
        const res = await fetch("/api/promo/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: trimmedPromo, clientTimezone: detectBrowserTimezone() }),
          signal: controller.signal,
        });
        if (res.status === 401) {
          // The code still survives the login redirect from the CTA, so being
          // signed out is guidance, not a failure.
          result = { kind: "signed_out" };
        } else {
          const data = (await res.json().catch(() => null)) as PromoPreviewResult | null;
          result =
            !res.ok || !data || typeof data.ok !== "boolean"
              ? { kind: "failed" }
              : { kind: "answered", result: data };
        }
      } catch {
        // An abort lands here too, and `cancelled` keeps it from overwriting the
        // outcome the newer request is about to record.
        result = { kind: "failed" };
      }
      if (!cancelled) setOutcome({ code: trimmedPromo, result });
    }, PROMO_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedPromo]);

  // Pick a plan's price in the active currency, falling back to its base price.
  // Only used before a preview lands; after that the server's figure wins.
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
    // Only forward a code the preview hasn't already ruled out for THIS pack.
    // Checkout has no "partially applies" path: it would reject the whole
    // reservation and refuse to sell a pack whose card is showing a valid price.
    const promoCode = promoCodeForCheckout(promo, planSlug, previewResult);
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
        toast.success(`Promo ${d.code} applied: ${formatMoney(d.amountCents, d.currency)} off.`),
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
            Buy a one-time pack of 1:1 sessions, no subscription, and your sessions never expire.
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
              aria-describedby="promo-status"
              aria-invalid={promoError !== null}
              className={cn(
                "text-center font-mono uppercase tracking-wide",
                preview && "border-primary/60 ring-1 ring-primary/30",
                promoError && "border-destructive/60",
              )}
            />
            <p
              id="promo-status"
              aria-live="polite"
              className={cn(
                "mt-1.5 flex items-center justify-center gap-1.5 text-xs",
                preview ? "font-medium text-primary" : "text-muted-foreground",
                promoError && "text-destructive",
              )}
            >
              {checkingPromo ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Checking your code…
                </>
              ) : preview ? (
                <>
                  <Check className="size-3.5" />
                  {preview.code} applied. New prices shown below.
                </>
              ) : promoError ? (
                <>
                  <AlertCircle className="size-3.5 shrink-0" />
                  {promoError}
                </>
              ) : promoNeedsSignIn ? (
                <>Sign in to apply this code. We&apos;ll keep it for checkout.</>
              ) : (
                <>Have a code? Enter it before choosing a pack.</>
              )}
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
          {plans.map((p) => {
            // Server-priced line for this pack, if a code is currently applied.
            const line = preview?.plans.find((pp) => pp.slug === p.slug) ?? null;
            const listPrice = line?.originalAmountCents ?? planAmount(p);
            const discounted = line?.eligible ? line : null;

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
                    ? "border-primary/60 ring-2 ring-primary/30 shadow-xl shadow-primary/15"
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
                  {discounted ? (
                    <>
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                        <div className="text-4xl font-[family-name:var(--font-heading)] text-primary">
                          <span className="sr-only">New price </span>
                          {formatMoney(discounted.finalAmountCents, displayCurrency)}
                        </div>
                        <div className="text-lg text-muted-foreground line-through">
                          <span className="sr-only">was </span>
                          {formatMoney(listPrice, displayCurrency)}
                        </div>
                      </div>
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        <Tag className="size-3" />
                        You save {formatMoney(discounted.discountAmountCents, displayCurrency)}
                      </div>
                    </>
                  ) : (
                    <div className="text-4xl font-[family-name:var(--font-heading)]">
                      {formatMoney(listPrice, displayCurrency)}
                    </div>
                  )}
                  <div className="mt-1 text-sm text-muted-foreground">
                    {p.session_credits} session{p.session_credits === 1 ? "" : "s"} included
                  </div>
                  {line && !line.eligible && (
                    <div className="mt-1.5 text-xs text-muted-foreground">
                      {line.reason === "amount_below_minimum"
                        ? `${preview?.code} can't be applied to this pack.`
                        : `${preview?.code} doesn't apply to this pack.`}{" "}
                      Full price applies.
                    </div>
                  )}
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
                  ) : discounted ? (
                    `Get this pack for ${formatMoney(discounted.finalAmountCents, displayCurrency)}`
                  ) : (
                    "Get this pack"
                  )}
                </Button>
              </motion.div>
            );
          })}
        </motion.div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Prices shown in {displayCurrency}. One-time payment, no subscription. Available to
          customers in the UAE and India.{" "}
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
