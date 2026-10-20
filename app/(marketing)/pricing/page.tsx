import { PricingTeaser } from "@/components/marketing/PricingTeaser";
import { PackPriceTable } from "@/components/marketing/PackPriceTable";
import { PageHeader } from "@/components/marketing/PageHeader";
import { FAQ } from "@/components/marketing/FAQ";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";
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
        const products = offersJsonLd(plans, `${SITE}/pricing`);
        return products ? products.map((p) => <JsonLd key={p.sku as string} data={p} />) : null;
      })()}
      <PageHeader
        eyebrow="Pricing"
        title={<>Pay only when <em>you&apos;re ready.</em></>}
        subhead="Buy a one-time pack of 1:1 sessions, no subscription, and your sessions never expire."
      />
      <PricingTeaser plans={plans} showHeader={false} />
      {/* Server-rendered, so every currency the Product JSON-LD above offers is
          visible in the cached HTML, not only the browser-resolved one. */}
      <PackPriceTable plans={plans} />
      {/* Body links (not footer) to the pages that explain the price. */}
      <RelatedLinks
        title="Before you choose a pack."
        items={[
          {
            href: "/guides/what-private-online-yoga-costs",
            label: "What a private online yoga class costs",
            note: "How the per-session price compares with apps, group classes and tutor marketplaces.",
          },
          {
            href: "/private-online-yoga-classes",
            label: "Private 1:1 online yoga classes",
            note: "What a live 60-minute one-to-one session is and who it suits.",
          },
          {
            href: "/online-yoga-classes-india",
            label: "Private 1:1 online yoga classes in India",
            note: "Rupee prices, UPI and card payment, morning and evening IST slots.",
          },
          {
            href: "/guides/private-vs-group-online-yoga",
            label: "1:1 versus group classes like Cult.fit",
            note: "When a private teacher is worth the difference, and when it is not.",
          },
        ]}
      />
      <FAQ />
      <FinalCTA headline="Book your first 1:1 session." />
    </>
  );
}
