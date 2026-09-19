import { PricingTeaser } from "@/components/marketing/PricingTeaser";
import { PageHeader } from "@/components/marketing/PageHeader";
import { FAQ } from "@/components/marketing/FAQ";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { JsonLd } from "@/components/shared/JsonLd";
import { faqPageJsonLd, offersJsonLd, breadcrumbJsonLd } from "@/lib/seo/structuredData";
import { FAQS } from "@/lib/data/faqs";
import { getPlansWithFeatures } from "@/lib/data/landing";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";

export const revalidate = 60;
export const metadata = {
  title: "Online 1:1 Yoga Prices and Session Packs",
  description:
    "One-time packs of live 1:1 yoga sessions with certified teachers in India. No subscription, no monthly fee, and your sessions never expire.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const plans = await getPlansWithFeatures();
  return (
    <>
      <JsonLd data={faqPageJsonLd(FAQS)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE}/` },
          { name: "Pricing", url: `${SITE}/pricing` },
        ])}
      />
      {(() => {
        const offers = offersJsonLd(plans, `${SITE}/pricing`);
        return offers ? <JsonLd data={offers} /> : null;
      })()}
      <PageHeader
        eyebrow="Pricing"
        title={<>Pay only when <em>you&apos;re ready.</em></>}
        subhead="Buy a one-time pack of 1:1 sessions, no subscription, and your sessions never expire."
      />
      <PricingTeaser plans={plans} showHeader={false} />
      <FAQ />
      <FinalCTA headline="Book your first 1:1 session." />
    </>
  );
}
