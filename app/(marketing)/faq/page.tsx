import { FAQ } from "@/components/marketing/FAQ";
import { PageHeader } from "@/components/marketing/PageHeader";
import { FinalCTA } from "@/components/marketing/FinalCTA";

export const revalidate = 300;
export const metadata = {
  title: "FAQ",
  description:
    "Common questions about free 1:1 yoga sessions, pricing, scheduling, and how online classes on Google Meet work.",
};

export default function FaqPage() {
  return (
    <>
      <PageHeader
        eyebrow="FAQ"
        title={<>Frequently asked <em>questions.</em></>}
        subhead="Quick answers to the bits people usually ask before booking. Still stuck? Drop us a note on the contact page."
      />
      <FAQ />
      <FinalCTA headline="Try your first 1:1 on us." />
    </>
  );
}
