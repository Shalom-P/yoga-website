import { FAQ } from "@/components/marketing/FAQ";
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
      <section className="pt-32 pb-4 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">
            FAQ
          </div>
          <h1 className="text-4xl md:text-6xl font-[family-name:var(--font-heading)] tracking-tight text-balance">
            Frequently asked questions.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground text-pretty">
            Quick answers to the bits people usually ask before booking. Still stuck?
            Drop us a note on the contact page.
          </p>
        </div>
      </section>
      <FAQ />
      <FinalCTA headline="Try your first 1:1 on us." />
    </>
  );
}
