// Shared FAQ content. Lives in its own (non-"use client") module so it can be
// rendered by the client <FAQ> accordion AND read by server components to emit
// FAQPage JSON-LD structured data (see app/(marketing)/page.tsx etc.).

export type FaqLink = { href: string; label: string };

/**
 * One question and answer. `links` are rendered after `a` as one closing
 * sentence ("Label one and label two."), each label an anchor, so a visitor
 * reads the same words a crawler finds in the FAQPage JSON-LD (see
 * `faqAnswerText` in lib/seo/structuredData.ts, which builds that sentence
 * from the same fields). Keep the labels descriptive of the destination.
 */
export type Faq = { q: string; a: string; links?: FaqLink[] };

/** The visible closing sentence for `links`, or "" when there are none. */
export function faqLinksSentence(links: FaqLink[] | undefined): string {
  if (!links?.length) return "";
  return `${links.map((l) => l.label).join(" and ")}.`;
}

/** Site-wide questions: /faq and /pricing. */
export const FAQS: Faq[] = [
  {
    q: "How do the 1:1 sessions work?",
    a: "Each session is a 60-minute personalised 1:1 with a teacher of your choice, live online at a time shown in your local time.",
  },
  {
    q: "Do I need to be a beginner, or experienced?",
    a: "Either. Tell us your level in onboarding and we'll match you with a teacher who specialises in beginners, intermediates, or rehabilitation.",
  },
  {
    q: "Do I need a yoga mat?",
    a: "A mat helps but isn't essential for your first session. A clear 2m × 1m space, comfortable clothes, and water is enough.",
  },
  {
    q: "How does the time-zone thing work?",
    a: "All times you see are in your local time. Your teacher's calendar handles the conversion to IST automatically.",
  },
  {
    q: "What if I have a back or knee injury?",
    a: "Tell us in onboarding. We'll match you with a therapy yoga teacher who specialises in safe, gentle rehabilitation.",
  },
  {
    q: "How does paying work: is there a subscription?",
    a: "No subscription. You buy a one-time pack of 1:1 sessions (1, 5 or 10). Each booking uses one of them, and your prepaid sessions never expire.",
  },
  {
    q: "Can I cancel a booked session?",
    a: "Yes. Cancel from your dashboard before the session starts, and if it was a paid session, it goes straight back to your account to use later.",
  },
  {
    q: "How do I join the live class?",
    a: "We email you a join link as soon as you book, plus a reminder 24h and 1h before. Click the link, you're in.",
  },
  {
    q: "What's your refund policy?",
    a: "If your first paid session wasn't right for you, email us within 7 days for a full refund. After that, refunds are case-by-case.",
  },
];

/**
 * The home page's own questions, about the service as a whole. They used to
 * be the list above, which /pricing also renders, so the two pages competed
 * for the same questions and the home page said nothing about who it is for.
 * Each answer hands on to the page that goes deeper. Only facts already
 * stated elsewhere on the site (teacher degrees, hours, pack sizes).
 *
 * `priceFrom` is the lowest INR per-session price from explicit plan_prices
 * rows (the same figure the hero states); the sentence is left out when
 * nothing is priced rather than quoting a stale number.
 */
export function homeFaqs({ priceFrom }: { priceFrom: string | null }): Faq[] {
  return [
    {
      q: "Who is My Yoga Classes for?",
      a: "Adults anywhere in the world who want a live yoga teacher watching only them, rather than an app or a group stream: beginners, people returning after a long gap, and people practising with a condition such as diabetes, high blood pressure, PCOS, back pain or pregnancy, or with an older body.",
      links: [{ href: "/classes", label: "See every condition we teach for" }],
    },
    {
      q: "What happens in a live 1:1 session?",
      a: "Sixty minutes over video with one teacher and you. Your teacher sees your alignment, corrects you as you move, and builds the session around your body and goals. It is not a recording and not a group class, and you can keep the same teacher every week.",
      links: [{ href: "/private-online-yoga-classes", label: "How a private online yoga class works" }],
    },
    {
      q: "Who teaches, and what are their qualifications?",
      a: "Every teacher is based in India and holds a university degree in yoga and naturopathy, such as the BNYS (Bachelor of Naturopathy and Yogic Sciences), and in some cases a postgraduate MD in yoga. They are not MBBS doctors, and yoga supports your doctor's care rather than replacing it. Each teacher's qualifications are on their profile.",
      links: [{ href: "/teachers", label: "Meet the teachers" }],
    },
    {
      q: "Which time zones and hours do you cover?",
      a: "Teachers teach from India in two bands, about 5:30 am to 8:30 am and 7:00 pm to 11:00 pm IST, which covers evenings in North America, afternoons in the UK and Europe, and mornings and evenings in the Gulf and Asia. Every time on the site is shown in your local time.",
      links: [{ href: "/online-yoga-classes-india", label: "Private 1:1 online yoga classes in India" }],
    },
    {
      q: "How is this different from a yoga app or a group class?",
      a: "An app cannot see you, and in a group class the teacher is watching many screens at once. In a 1:1 session the teacher watches only you for the full hour, corrects your alignment on the spot, and changes the plan around your body.",
      links: [{ href: "/guides/private-vs-group-online-yoga", label: "1:1 versus group classes like Cult.fit" }],
    },
    {
      q: "Can I practise with a health condition?",
      a: "Yes, alongside the care your doctor provides. Because every teacher trained in yoga and naturopathy, a session can be adapted for diabetes, high blood pressure, PCOS, back and neck pain, pregnancy or an older body. Tell us when you sign up and tell your teacher at the start.",
      links: [{ href: "/doctor-led-yoga-therapy", label: "What doctor-led yoga therapy means here" }],
    },
    {
      q: "How much does it cost, and is there a subscription?",
      a: `No subscription. You buy a one-time pack of one, five or ten live sessions${priceFrom ? `, from ${priceFrom} a session in India` : ""}, and prepaid sessions never expire.`,
      links: [{ href: "/guides/what-private-online-yoga-costs", label: "What a private online yoga class costs" }],
    },
    {
      q: "How do I start?",
      a: "Sign in with Google or your email, tell us your level and goals, then pick a teacher and a time shown in your local time. We email you the join link as soon as you book, with reminders 24 hours and 1 hour before.",
      links: [{ href: "/pricing", label: "See the session packs and prices" }],
    },
  ];
}
