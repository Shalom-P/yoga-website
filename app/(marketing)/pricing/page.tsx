import { PricingTeaser } from "@/components/marketing/PricingTeaser";
import { FAQ } from "@/components/marketing/FAQ";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { getPlansWithFeatures } from "@/lib/data/landing";

export const revalidate = 60;
export const metadata = {
  title: "Pricing",
  description: "Honest yoga pricing in AUD. Free 1:1 trial — no credit card. Cancel anytime.",
};

export default async function PricingPage() {
  const plans = await getPlansWithFeatures();
  return (
    <>
      <section className="pt-32 pb-12 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">
            Pricing
          </div>
          <h1 className="text-4xl md:text-6xl font-[family-name:var(--font-heading)] tracking-tight text-balance">
            Pay only when you&apos;re ready.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground text-pretty">
            Every plan starts with a free 1:1 — you choose to subscribe afterwards, or you don&apos;t.
          </p>
        </div>
      </section>
      <PricingTeaser plans={plans} />
      <FAQ />
      <FinalCTA headline="Try your first 1:1 on us." />
    </>
  );
}
