// Shared FAQ content. Lives in its own (non-"use client") module so it can be
// rendered by the client <FAQ> accordion AND read by server components to emit
// FAQPage JSON-LD structured data (see app/(marketing)/page.tsx etc.).

export type Faq = { q: string; a: string };

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
    a: "No subscription. You buy a one-time pack of sessions (5 or 10). Each booking spends one credit, and your credits never expire.",
  },
  {
    q: "Can I cancel a booked session?",
    a: "Yes. Cancel from your dashboard before the session starts, and if it was a paid session, the credit goes straight back to your account to use later.",
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
