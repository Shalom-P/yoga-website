import { Suspense } from "react";
import { PricingTeaser } from "@/components/marketing/PricingTeaser";
import { PlanAutoStart } from "@/components/dashboard/PlanAutoStart";
import { CurrentSubscription } from "@/components/dashboard/CurrentSubscription";
import { getPlansWithFeatures } from "@/lib/data/landing";
import { requireUser } from "@/lib/auth/guards";

export default async function PlanPage() {
  const { user, supabase } = await requireUser("/dashboard/plan");
  const [{ data: subRow }, plans] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "paypal_subscription_id, status, next_billing_at, plan:plans(name, price_aud_cents, billing_interval)"
      )
      .eq("customer_id", user.id)
      .in("status", ["active", "pending", "suspended"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getPlansWithFeatures(),
  ]);

  const sub = subRow as
    | {
        paypal_subscription_id: string;
        status: "active" | "pending" | "suspended";
        next_billing_at: string | null;
        plan: { name: string; price_aud_cents: number; billing_interval: "monthly" | "quarterly" | "yearly" } | null;
      }
    | null;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium">
        Your plan
      </div>
      <h1 className="text-3xl md:text-4xl font-[family-name:var(--font-heading)] tracking-tight mt-1">
        {sub?.status === "active"
          ? "You're a member."
          : sub?.status === "pending"
          ? "Activating your plan…"
          : "You're on the free trial."}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {sub ? "Manage your subscription below." : "Upgrade when you're ready. Cancel anytime."}
      </p>

      <Suspense fallback={null}>
        <PlanAutoStart />
      </Suspense>

      {sub && sub.plan ? (
        <CurrentSubscription
          paypalSubscriptionId={sub.paypal_subscription_id}
          planName={sub.plan.name}
          planPriceCents={sub.plan.price_aud_cents}
          billingInterval={sub.plan.billing_interval}
          status={sub.status}
          nextBillingAt={sub.next_billing_at}
        />
      ) : (
        <PricingTeaser plans={plans} />
      )}
    </div>
  );
}
