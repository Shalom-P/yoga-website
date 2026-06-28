import { PageHeader } from "@/components/marketing/PageHeader";
import { FinalCTA } from "@/components/marketing/FinalCTA";

export const metadata = {
  title: "About",
  description: "Why My Yoga Classes exists, and how we work.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="Our story"
        title={<>Old practice. New room. <em>No bullsh*t.</em></>}
        align="left"
      />

      <article className="px-7 pb-16">
        <div className="mx-auto max-w-3xl space-y-5 text-lg text-foreground/85 text-pretty">
          <p>
            We started My Yoga Classes because too many people were paying premium prices for
            a 1-hour studio session they ended up skipping half the time. Meanwhile,
            brilliant 200-hr+ certified yoga teachers in India were teaching empty rooms.
          </p>
          <p>
            Our bet: bring those teachers to your home — live, on Google Meet — for less
            than the price of a single in-person studio class.
          </p>
          <p>
            We are not an app of pre-recorded videos. We are a small studio with real
            teachers who learn your name, see your posture, and adjust you. That&apos;s the
            part that makes yoga actually work.
          </p>
          <h2 className="pt-6 text-3xl">How we work</h2>
          <p>
            Every teacher is a 200-hr Yoga Alliance certified professional. Most have
            500+ hours and years of in-studio teaching. We pay them fair, professional
            private-tutor rates — not gig-worker rates — because that&apos;s how you
            keep brilliant teachers brilliant.
          </p>
        </div>
      </article>
      <FinalCTA headline="Meet a teacher who learns your name." />
    </>
  );
}
