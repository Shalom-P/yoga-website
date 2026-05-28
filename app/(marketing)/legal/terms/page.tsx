export const metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <article className="pt-32 pb-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-[family-name:var(--font-heading)] tracking-tight">
          Terms of service
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 28 May 2026</p>
        <div className="mt-10 space-y-6 text-foreground/85 text-pretty">
          <p>
            This is a placeholder Terms of Service. Before going live, replace this content
            with terms reviewed by an Australian lawyer covering: service scope, account
            obligations, subscription billing, refunds (see Refund Policy), liability,
            governing law (NSW), and dispute resolution.
          </p>
          <p>
            By using MYYOGACLASSES you agree to act in good faith with our teachers and
            other students.
          </p>
        </div>
      </div>
    </article>
  );
}
