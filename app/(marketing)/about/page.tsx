import Link from "next/link";
import { PageHeader } from "@/components/marketing/PageHeader";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { perSessionRange } from "@/components/marketing/PackPriceTable";
import { getPlansWithFeatures } from "@/lib/data/landing";
import { formatMoney } from "@/lib/i18n/money";

export const revalidate = 3600;

export const metadata = {
  title: "About Our Online 1:1 Yoga Studio",
  description:
    "We pair you with a certified yoga teacher in India for live 1:1 sessions, built around your body and shown in your local time. Here is how we work.",
  alternates: { canonical: "/about" },
};

const linkClass = "underline underline-offset-4 hover:text-foreground";

export default async function AboutPage() {
  // Same figures as /pricing and the condition pages: explicit INR
  // plan_prices rows only, never the base price under another symbol.
  const inr = perSessionRange(await getPlansWithFeatures(), "INR");
  const priceFrom = inr ? formatMoney(inr.low, "INR") : null;
  const priceTo = inr ? formatMoney(inr.high, "INR") : null;

  return (
    <>
      <PageHeader
        eyebrow="Our story"
        title={<>Old practice. New room. <em>No bullsh*t.</em></>}
        align="left"
      />

      <article className="px-7 pb-16">
        <div className="mx-auto max-w-3xl space-y-5 text-lg text-foreground/85 text-pretty">
          {/* Plain statement of what this is, first. The story below is for
              people; this paragraph is for a reader (or a crawler) who has
              30 seconds and one question: what is My Yoga Classes? */}
          <p>
            My Yoga Classes is a live, one-to-one online yoga studio. Students anywhere in
            the world book a 60-minute private session over video with a yoga and
            naturopathy graduate based in India, shown in their own time zone. Sessions
            are sold as one-time packs
            {priceFrom && priceTo ? (
              <>
                , {priceFrom} to {priceTo} a session depending on the pack,
              </>
            ) : null}{" "}
            with no subscription, and they never expire.
          </p>
          <p>
            We started My Yoga Classes because too many people were paying premium prices for
            a 1-hour studio session they ended up skipping half the time. Meanwhile,
            brilliant certified yoga teachers in India were teaching empty rooms.
          </p>
          <p>
            Our bet: bring those teachers to your home (live, online) for less
            than the price of a single in-person studio class.
          </p>
          <p>
            We are not an app of pre-recorded videos. We are a small studio with real
            teachers who learn your name, see your posture, and adjust you. That&apos;s the
            part that makes yoga actually work.
          </p>

          <h2 className="pt-6 text-3xl">Who teaches</h2>
          <p>
            Every teacher holds a formal qualification in yoga and naturopathy from an
            Indian university, such as the BNYS (Bachelor of Naturopathy and Yogic
            Sciences), alongside their Yoga Alliance registration, and has years of
            one-to-one teaching behind them. In India, yoga and naturopathy is a regulated
            stream of medicine under the Ministry of AYUSH; these are not MBBS medical
            doctors, and a session never replaces your own doctor&apos;s care. Each
            teacher&apos;s degrees, specialties and languages are listed on{" "}
            <Link href="/teachers" className={linkClass}>
              their profile
            </Link>
            .
          </p>
          <p>
            We pay them fair, professional private-tutor rates (not gig-worker rates)
            because that&apos;s how you keep brilliant teachers brilliant.
          </p>

          <h2 className="pt-6 text-3xl">How a session works</h2>
          <p>
            You pick a teacher and keep them: the same person every week, who remembers
            what you worked on last time. Sessions are 60 minutes, live over video, just
            you and your teacher, with your camera on so they can see your alignment and
            correct it as you go. Teachers are in India (IST) and cover early morning to
            late evening there; the booking page shows their open slots in your local
            time. Sessions are adapted to what you are working on, from{" "}
            <Link href="/classes/diabetes" className={linkClass}>
              diabetes
            </Link>{" "}
            and{" "}
            <Link href="/classes/hypertension" className={linkClass}>
              blood pressure
            </Link>{" "}
            to{" "}
            <Link href="/classes/prenatal" className={linkClass}>
              pregnancy
            </Link>
            ,{" "}
            <Link href="/classes/pain-relief" className={linkClass}>
              back pain
            </Link>{" "}
            and{" "}
            <Link href="/classes/geriatric" className={linkClass}>
              older adults
            </Link>
            . See{" "}
            <Link href="/classes" className={linkClass}>
              every class type
            </Link>{" "}
            or{" "}
            <Link href="/pricing" className={linkClass}>
              the session packs and prices
            </Link>
            .
          </p>

          <h2 className="pt-6 text-3xl">Contact</h2>
          <p>
            Write to{" "}
            <a href="mailto:hello@myyogaclasses.fit" className={linkClass}>
              hello@myyogaclasses.fit
            </a>{" "}
            or use the{" "}
            <Link href="/contact" className={linkClass}>
              contact page
            </Link>
            . Common questions are answered on the{" "}
            <Link href="/faq" className={linkClass}>
              FAQ
            </Link>
            .
          </p>
        </div>
      </article>
      <FinalCTA headline="Meet a teacher who learns your name." />
    </>
  );
}
