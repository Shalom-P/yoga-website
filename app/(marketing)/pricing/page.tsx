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
  description: "Honest yoga pricing in AED and INR. One-time session packs, no subscription.",
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
        subhead="Buy a one-time pack of 1:1 sessions, no subscription, and your sessions never expire."
      />
      <PricingTeaser plans={plans} />
      <FAQ />
      <FinalCTA headline="Book your first 1:1 session." />
    </>
  );
}
