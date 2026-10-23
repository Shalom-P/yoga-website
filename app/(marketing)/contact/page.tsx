import Link from "next/link";
import { Mail } from "lucide-react";
import { PageHeader } from "@/components/marketing/PageHeader";
import { ContactForm } from "@/components/marketing/ContactForm";

export const metadata = {
  title: "Contact Us: Questions and Bookings",
  description: "Questions about a 1:1 online yoga teacher, a class, a pack or a booking? Email us or use the form. We reply within 1 business day.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Get in touch"
        title={<>We answer <em>every email.</em></>}
        subhead="Questions about a teacher, a class, or your bookings? We typically reply within 1 business day (your local time)."
      />
      <div className="px-7 pb-24">
        <div className="mx-auto max-w-md">
          <ContactForm />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Prefer email? Reach us directly at{" "}
            <a
              href="mailto:hello@myyogaclasses.fit"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <Mail className="size-3.5" />
              hello@myyogaclasses.fit
            </a>
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-3xl space-y-5 text-foreground/85 text-pretty">
          <h2 className="text-2xl tracking-tight md:text-3xl">Before you write</h2>
          <p>
            Many questions are answered already: what a session costs is on{" "}
            <Link href="/pricing" className="font-medium text-primary hover:underline">
              the pricing page
            </Link>
            , who teaches is on{" "}
            <Link href="/teachers" className="font-medium text-primary hover:underline">
              our teachers page
            </Link>
            , and booking, cancelling and refunds are covered in{" "}
            <Link href="/faq" className="font-medium text-primary hover:underline">
              the FAQ
            </Link>{" "}
            and{" "}
            <Link href="/legal/refund" className="font-medium text-primary hover:underline">
              refund policy
            </Link>
            .
          </p>
          <p>
            For anything about a booking you have made, write from the email address you
            signed in with so we can find it quickly. If you want to tell a teacher about a
            health condition before your first session, you can do that at the start of the
            session, or share a medical report privately from your dashboard. Please don&apos;t
            send medical documents by email.
          </p>
          <p>
            Our teachers are in India (IST). If something about your health is urgent,
            contact your doctor or your local emergency number rather than us.
          </p>
        </div>
      </div>
    </>
  );
}
