import { PricingTeaser } from "@/components/marketing/PricingTeaser";
import { PageHeader } from "@/components/marketing/PageHeader";
import { FAQ } from "@/components/marketing/FAQ";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { JsonLd } from "@/components/shared/JsonLd";
import { faqPageJsonLd } from "@/lib/seo/structuredData";
import { FAQS } from "@/lib/data/faqs";
import { getPlansWithFeatures } from "@/lib/data/landing";

export const revalidate = 60;
export const metadata = {
  title: "Pricing",
  description: "Honest yoga pricing in AED and INR. Free 1:1 trial — no credit card. One-time session packs, no subscription.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const plans = await getPlansWithFeatures();
  return (
    <>
      <JsonLd data={faqPageJsonLd(FAQS)} />
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
