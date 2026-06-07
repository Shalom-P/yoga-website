import { PricingTeaser } from "@/components/marketing/PricingTeaser";
import { PageHeader } from "@/components/marketing/PageHeader";
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
      <PageHeader
        eyebrow="Pricing"
        title={<>Pay only when <em>you&apos;re ready.</em></>}
        subhead="Every plan starts with a free 1:1 — buy a pack of sessions afterwards, or you don't."
      />
      <PricingTeaser plans={plans} />
      <FAQ />
      <FinalCTA headline="Try your first 1:1 on us." />
    </>
  );
}
