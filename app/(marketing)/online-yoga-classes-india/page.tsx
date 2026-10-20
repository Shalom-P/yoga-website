import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/marketing/PageHeader";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { PackPriceTable, perSessionRange } from "@/components/marketing/PackPriceTable";
import { JsonLd } from "@/components/shared/JsonLd";
import { faqPageJsonLd, breadcrumbJsonLd } from "@/lib/seo/structuredData";
import { getPlansWithFeatures, getAllActiveTeachers } from "@/lib/data/landing";
import { formatMoney } from "@/lib/i18n/money";
import { rosterLanguageSentence } from "@/lib/copy/languages";
import type { Faq } from "@/lib/data/faqs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";
const BOOK_HREF = "/login?next=/dashboard/book";

export const revalidate = 300;
export const metadata = {
  title: "Private 1:1 Online Yoga Classes in India",
  description:
    "Live one-to-one online yoga in India with BNYS-qualified yoga and naturopathy teachers. Morning and evening IST slots, priced in rupees, no monthly subscription.",
  alternates: { canonical: "/online-yoga-classes-india" },
};

/** The IST hours teachers cover; the same list the UAE and USA pages convert. */
const MORNING = "5:30 am to 8:30 am";
const EVENING = "7:00 pm to 11:00 pm";

const STATIC_FAQS: Faq[] = [
  {
    q: "Can I take live one-to-one yoga online in India in the morning or evening?",
    a: `Yes. Teachers are in India and teach in IST, with sessions starting from about ${MORNING} and ${EVENING}. Exact availability varies by teacher, and the booking page shows the real open slots before you pay.`,
  },
  {
    q: "Do I need a monthly subscription?",
    a: "No. You buy a one-time pack of one, five or ten sessions, paid in rupees. There is no monthly fee, nothing renews, and prepaid sessions never expire.",
  },
  {
    q: "Who are the teachers?",
    a: "Every teacher holds a degree in yoga and naturopathy from an Indian university, such as the BNYS (Bachelor of Naturopathy and Yogic Sciences) and in some cases a postgraduate MD in yoga, plus a Yoga Alliance registration. They are not MBBS doctors, and yoga supports your doctor's care rather than replacing it. Each teacher's qualifications are on their profile.",
  },
  // One entry per condition, phrased the way a student in India asks it. These
  // replaced a single lumped "PCOS, diabetes, blood pressure, back pain or
  // pregnancy?" entry that linked nowhere; each now hands on to its page.
  {
    q: "Is there a 1:1 online yoga teacher for PCOS in India?",
    a: "Yes. A PCOS session is live, one-to-one and 60 minutes over video, with gentle movement, breathwork and rest built around how you feel that week rather than a fixed routine, alongside the care your doctor provides. Your teacher is a yoga and naturopathy graduate based in India, and you keep the same teacher from week to week.",
    links: [{ href: "/classes/pcos", label: "Read about 1:1 yoga for PCOS" }],
  },
  {
    q: "Can online yoga therapy help with type 2 diabetes and high blood pressure?",
    a: "Yoga supports your doctor's care and never replaces it or your medication. Sessions are live, one-to-one and 60 minutes, paced gently around movement, calming breathwork and rest, with the poses to avoid for high blood pressure left out and the plan adapted to how you feel that day. Teachers hold a degree in yoga and naturopathy, so tell them your diagnosis and medication at the start.",
    links: [
      { href: "/classes/diabetes", label: "Read about 1:1 yoga for diabetes" },
      { href: "/classes/hypertension", label: "1:1 yoga for high blood pressure" },
    ],
  },
  {
    q: "Do you teach chair yoga for elderly parents at home?",
    a: "Yes. Sessions for older adults are live, one-to-one and 60 minutes, slow and supportive, with seated and chair-supported options for balance and everyday movement, at home on a laptop, tablet or phone. The teacher, a yoga and naturopathy graduate, adapts every pose to the person in front of them. Ask their doctor before starting after a heart condition, a recent fall or surgery.",
    links: [{ href: "/classes/geriatric", label: "Read about 1:1 yoga for senior citizens" }],
  },
  {
    q: "Is there prenatal 1:1 yoga online with a certified teacher?",
    a: "Yes, once your doctor or midwife has cleared you. Prenatal sessions are live, one-to-one and 60 minutes, with gentle movement, breathwork and rest tailored to your trimester and adapted week to week as your body changes. Every teacher holds a university degree in yoga and naturopathy and knows which poses to leave out in pregnancy.",
    links: [
      { href: "/classes/prenatal", label: "Read about 1:1 prenatal yoga" },
      { href: "/classes/prenatal/poses-to-avoid", label: "the poses to avoid in pregnancy" },
    ],
  },
  {
    q: "Can doctor-led yoga therapy help chronic back pain?",
    a: "Sessions for back and neck pain are live, one-to-one and 60 minutes, built from easy stretching, mobility and posture work kept inside a comfortable, pain-free range, and changed after your teacher watches how you move. Teachers hold a BNYS or similar degree in yoga and naturopathy; they are not MBBS doctors, and the practice sits alongside any care from your doctor or physiotherapist.",
    links: [
      { href: "/doctor-led-yoga-therapy", label: "What doctor-led yoga therapy means here" },
      { href: "/classes/pain-relief", label: "1:1 yoga for back and neck pain" },
    ],
  },
  {
    q: "Can a beginner get posture correction in a 1:1 online class?",
    a: "Yes, and it is the main reason to choose one-to-one over an app or a group class. For the full 60 minutes the teacher watches only you, corrects your alignment as you move, and starts from your level rather than the room's. Most students here are beginners or returning after a long gap.",
    links: [{ href: "/private-online-yoga-classes", label: "How a private online yoga class works" }],
  },
  {
    q: "How is this different from a group live class?",
    a: "In a group class the teacher is watching many screens at once. In a private session the teacher watches only you for the full hour, corrects your alignment, and changes the plan around your body. You also keep the same teacher from week to week.",
  },
  {
    q: "How do I pay?",
    a: "In rupees, online at checkout through Razorpay, by UPI, debit or credit card, or netbanking. You pay once for the pack you choose; nothing renews.",
  },
  {
    q: "What if I need to cancel?",
    a: "Cancel from your dashboard before the session starts and the session goes back to your account to use another time.",
  },
];

export default async function IndiaPage() {
  const [plans, teachers] = await Promise.all([getPlansWithFeatures(), getAllActiveTeachers()]);
  const inrPlans = plans.map((p) => ({ ...p, prices: p.prices.filter((pr) => pr.currency === "INR") }));
  const inr = perSessionRange(plans, "INR");
  const inrRange = inr
    ? inr.low === inr.high
      ? formatMoney(inr.low, "INR")
      : `${formatMoney(inr.low, "INR")} to ${formatMoney(inr.high, "INR")}`
    : null;

  // Built from the roster's `languages` column, so it follows the roster.
  const languages = rosterLanguageSentence(teachers);
  const faqs: Faq[] = [
    ...(inrRange
      ? [
          {
            q: "How much does a private online yoga class cost in India?",
            a: `A live 60-minute one-to-one session costs ${inrRange}, depending on whether you buy a single session or a pack of five or ten. Prices are in rupees with no subscription.`,
          },
        ]
      : []),
    ...STATIC_FAQS,
    ...(languages
      ? [
          {
            q: "Which languages are sessions taught in?",
            a: `${languages} You choose your teacher when you book, and each teacher's languages are on their profile.`,
          },
        ]
      : []),
  ];

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE}/` },
          { name: "Online yoga classes in India", url: `${SITE}/online-yoga-classes-india` },
        ])}
      />
      <JsonLd data={faqPageJsonLd(faqs)} />

      <PageHeader
        eyebrow="India"
        title={<>Private online yoga classes in India, <em>one-to-one and live.</em></>}
        subhead={`A 60-minute session over video with a yoga and naturopathy graduate who is watching only you. Morning and evening slots in IST${inrRange ? `, ${inrRange} a session` : ""}, no monthly subscription.`}
      />

      <section className="px-7 pb-16">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-full px-6">
              <Link href={BOOK_HREF}>
                Book a 1:1 session
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 rounded-full px-6">
              <Link href="/teachers">Meet the teachers</Link>
            </Button>
          </div>

          <div className="mt-14 space-y-5 text-lg text-foreground/85 text-pretty">
            <p>
              My Yoga Classes is a live, one-to-one online yoga studio. Every teacher is based in
              India and holds a university degree in yoga and naturopathy, such as the BNYS, so
              a session can be adapted for diabetes, blood pressure, PCOS, back pain, pregnancy
              or an older body, alongside the care your doctor provides.
            </p>
            <p>
              You choose your teacher, book a time that suits you between {MORNING} or{" "}
              {EVENING} IST, and join from home on a laptop, tablet or phone. You pay once for a
              single session or a pack of five or ten, in rupees. Nothing renews and prepaid
              sessions never expire.{" "}
              <Link href="/private-online-yoga-classes" className="underline underline-offset-4 hover:text-foreground">
                How a private online session works
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <PackPriceTable plans={inrPlans} />

      {teachers.length > 0 && (
        <RelatedLinks
          title="Who you would be practising with."
          items={teachers.map((t) => ({
            href: `/teachers/${t.slug}`,
            label: t.display_name,
            note: t.headline ?? undefined,
          }))}
          cta={{ href: "/doctor-led-yoga-therapy", label: "What their qualifications mean" }}
        />
      )}

      <section className="px-7 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">Questions from students in India.</h2>
          <div className="mt-8">
            <FaqAccordion faqs={faqs} />
          </div>
        </div>
      </section>

      <RelatedLinks
        title="What students in India book most."
        items={[
          { href: "/classes/pcos", label: "1:1 yoga for PCOS", note: "An active routine, rest, and comfort through your cycle." },
          { href: "/classes/diabetes", label: "1:1 yoga for diabetes", note: "Gentle movement and breathwork alongside your doctor's care." },
          { href: "/classes/hypertension", label: "1:1 yoga for blood pressure", note: "Calm, steady practice with the poses to avoid left out." },
          { href: "/classes/pain-relief", label: "1:1 yoga for back and neck pain", note: "Mobility and posture work inside a comfortable range." },
          { href: "/classes/prenatal", label: "1:1 prenatal yoga", note: "Adapted to your trimester, once you are cleared." },
          { href: "/classes/geriatric", label: "1:1 yoga for senior citizens", note: "Chair-supported options for everyday mobility." },
        ]}
        cta={{ href: "/guides/private-vs-group-online-yoga", label: "Private 1:1, group classes or a tutor marketplace?" }}
      />

      <FinalCTA headline="Book a morning or evening session." />
    </>
  );
}
