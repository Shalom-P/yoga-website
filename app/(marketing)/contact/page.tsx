import { Mail } from "lucide-react";
import { PageHeader } from "@/components/marketing/PageHeader";
import { ContactForm } from "@/components/marketing/ContactForm";

export const metadata = {
  title: "Contact",
  description: "Get in touch with My Yoga Classes. Questions about teachers, classes, or your bookings? We reply within 1 business day.",
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
      </div>
    </>
  );
}
