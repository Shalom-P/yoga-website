import { PricingTeaser } from "@/components/marketing/PricingTeaser";
import { getPlansWithFeatures } from "@/lib/data/landing";

export default async function PlanPage() {
  const plans = await getPlansWithFeatures();
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium">
        Your plan
      </div>
      <h1 className="text-3xl md:text-4xl font-[family-name:var(--font-heading)] tracking-tight mt-1">
        You&apos;re on the free trial.
      </h1>
      <p className="mt-2 text-muted-foreground">
        Upgrade when you&apos;re ready. Cancel anytime.
      </p>
      <PricingTeaser plans={plans} />
    </div>
  );
}
