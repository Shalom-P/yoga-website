import { Mail } from "lucide-react";
import { PageHeader } from "@/components/marketing/PageHeader";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Get in touch"
        title={<>We answer <em>every email.</em></>}
        subhead="Questions about a teacher, a class, or your subscription? We typically reply within 1 business day (Australian time)."
      />
      <div className="px-7 pb-24 text-center">
        <a
          href="mailto:hello@myyogaclasses.com.au"
          className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-semibold text-white shadow-[var(--myc-shadow-soft)] transition-opacity hover:opacity-90"
        >
          <Mail className="size-4" />
          hello@myyogaclasses.com.au
        </a>
      </div>
    </>
  );
}
