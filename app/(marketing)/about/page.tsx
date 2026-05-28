import { FinalCTA } from "@/components/marketing/FinalCTA";

export const metadata = {
  title: "About",
  description: "Why Sahaja Yoga exists, and how we work.",
};

export default function AboutPage() {
  return (
    <>
      <article className="pt-32 pb-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">
            Our story
          </div>
          <h1 className="text-4xl md:text-6xl font-[family-name:var(--font-heading)] tracking-tight text-balance">
            Old practice. New room. No bullsh*t.
          </h1>
          <div className="mt-10 prose prose-lg max-w-none text-foreground/85 space-y-5">
            <p>
              We started Sahaja Yoga because too many Australians were paying $30/class for
              a 1-hour studio session they ended up skipping half the time. Meanwhile,
              brilliant 200-hr+ certified yoga teachers in India were teaching empty rooms.
            </p>
            <p>
              Our bet: bring those teachers to your home — live, on Google Meet — for less
              than the price of one in-person class per month.
            </p>
            <p>
              We are not an app of pre-recorded videos. We are a small studio with real
              teachers who learn your name, see your posture, and adjust you. That&apos;s the
              part that makes yoga actually work.
            </p>
            <h2 className="text-2xl font-[family-name:var(--font-heading)] mt-10">How we work</h2>
            <p>
              Every teacher is a 200-hr Yoga Alliance certified professional. Most have
              500+ hours and years of in-studio teaching. We pay them at Australian
              private-tutor rates — not Indian gig-worker rates — because that&apos;s how you
              keep brilliant teachers brilliant.
            </p>
          </div>
        </div>
      </article>
      <FinalCTA headline="Meet a teacher. On us." />
    </>
  );
}
