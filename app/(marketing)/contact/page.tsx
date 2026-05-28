import { Mail } from "lucide-react";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <article className="pt-32 pb-24">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">
          Get in touch
        </div>
        <h1 className="text-4xl md:text-6xl font-[family-name:var(--font-heading)] tracking-tight text-balance">
          We answer every email.
        </h1>
        <p className="mt-5 text-muted-foreground text-pretty">
          Questions about a teacher, a class, or your subscription? We typically reply
          within 1 business day (Australian time).
        </p>
        <a
          href="mailto:hello@sahajayoga.com.au"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 h-12 font-medium hover:opacity-90"
        >
          <Mail className="size-4" />
          hello@sahajayoga.com.au
        </a>
      </div>
    </article>
  );
}
