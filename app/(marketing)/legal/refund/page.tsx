export const metadata = { title: "Refund policy" };

export default function RefundPage() {
  return (
    <article className="px-7 pt-32 pb-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[clamp(2.25rem,4vw,3rem)] leading-[1.1] tracking-tight">
          Refund policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 28 May 2026</p>
        <div className="mt-10 space-y-6 text-foreground/85 text-pretty">
          <p>
            Your first 1:1 session is always free — no card, no risk.
          </p>
          <p>
            For paid subscriptions: if your first paid class wasn&apos;t right for you,
            email <a className="underline" href="mailto:hello@myyogaclasses.com.au">hello@myyogaclasses.com.au</a>{" "}
            within 7 days for a full refund. After that, refunds are case-by-case.
          </p>
          <p>
            We comply with all Australian Consumer Law guarantees. This policy doesn&apos;t
            override your statutory rights.
          </p>
        </div>
      </div>
    </article>
  );
}
