import { FAQ } from "@/components/marketing/FAQ";
import { PageHeader } from "@/components/marketing/PageHeader";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { JsonLd } from "@/components/shared/JsonLd";
import { faqPageJsonLd } from "@/lib/seo/structuredData";
import { FAQS } from "@/lib/data/faqs";

export const revalidate = 300;
export const metadata = {
  title: "FAQ",
  description:
    "Common questions about 1:1 yoga sessions, pricing, scheduling, and how online classes on Google Meet work.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <>
      <JsonLd data={faqPageJsonLd(FAQS)} />
      <PageHeader
        eyebrow="FAQ"
        title={<>Frequently asked <em>questions.</em></>}
        subhead="Quick answers to the bits people usually ask before booking. Still stuck? Drop us a note on the contact page."
      />
      <FAQ />
      <FinalCTA headline="Book your first 1:1 session." />
    </>
  );
}
