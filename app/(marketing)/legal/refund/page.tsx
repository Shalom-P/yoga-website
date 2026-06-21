// DRAFT — substantive but NOT a substitute for legal review before launch.

export const metadata = {
  title: "Refund policy — My Yoga Classes",
  description:
    "My Yoga Classes refund and cancellation policy, including the free trial, one-time session packs, and your statutory rights under UAE and Indian consumer law.",
  alternates: { canonical: "/legal/refund" },
};

export default function RefundPage() {
  return (
    <article className="px-7 pt-32 pb-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[clamp(2.25rem,4vw,3rem)] leading-[1.1] tracking-tight">
          Refund policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 21 June 2026</p>

        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground/80">
          <strong>Pending legal review.</strong> This is a good-faith draft for a service
          operating across the UAE and India. It has not yet been reviewed by a qualified lawyer
          in either jurisdiction and must be verified before launch.
        </div>

        <div className="mt-10 space-y-10 text-foreground/85 text-pretty">

          {/* 1. Free trial */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. Free introductory session</h2>
            <p>
              Your <strong>first 1:1 session is completely free</strong> — no credit card or
              payment is required to book it. If you choose not to continue after your
              trial, simply do nothing; you will not be charged.
            </p>
          </section>

          {/* 2. Session pack payments */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Session pack payments</h2>
            <p>
              Paid access is sold as{" "}
              <strong>one-time session packs in AED or INR (by region) via Razorpay</strong>. You
              are charged once when you buy a pack — there is no subscription and no automatic
              recurring charge.
            </p>
            <p>
              You will receive an email receipt each time a payment is processed. If you believe
              a charge is incorrect, contact us within 30 days of the purchase date.
            </p>
          </section>

          {/* 3. Unused credits */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. Unused credits</h2>
            <p>
              Because packs are one-time purchases, there is no subscription to cancel and no
              recurring charge to stop. Any session credits you have purchased remain on your
              account until you use them.
            </p>
            <p>
              We do <strong>not</strong> provide refunds for unused credits except as required
              by law (see Section 5 below) or at our discretion. If you have a problem with a
              purchase, please contact us — see Section 4.
            </p>
          </section>

          {/* 4. Requesting a refund */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. Requesting a refund</h2>
            <p>
              If you believe you are entitled to a refund (including under Section 5), please
              contact us at{" "}
              <a className="underline" href="mailto:hello@myyogaclasses.fit">
                hello@myyogaclasses.fit
              </a>{" "}
              with:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your full name and the email address on your account.</li>
              <li>The date and amount of the charge in question.</li>
              <li>A brief description of the reason for your refund request.</li>
            </ul>
            <p>
              We will acknowledge your request within 2 business days and aim to resolve it
              within 10 business days. Where a refund is approved, funds are returned to your
              original payment method via Razorpay. Razorpay&apos;s own processing timelines apply
              once a refund is initiated from our side.
            </p>
          </section>

          {/* 5. Statutory consumer rights */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              5. Your statutory consumer rights
            </h2>
            <p>
              Nothing in this Refund Policy limits or excludes any rights you have under the
              mandatory consumer-protection law that applies to you — including the{" "}
              <strong>UAE Consumer Protection Law (Federal Law No. 15 of 2020)</strong> for
              customers in the UAE and the <strong>Consumer Protection Act 2019</strong> for
              customers in India — that cannot be excluded by agreement.
            </p>
            <p>
              If the services we provide are not delivered with due care and skill, are not fit
              for the purpose we agreed to, or are not delivered within a reasonable time, you may
              be entitled to a remedy including:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                A full or partial refund, including a refund of unused credits, where the failure
                is serious or cannot be put right; or
              </li>
              <li>
                Rectification within a reasonable time, and a refund if rectification is not
                provided, for a less serious failure.
              </li>
            </ul>
            <p>
              This policy is in addition to, and does not replace or limit, those statutory
              rights.
            </p>
          </section>

          {/* 6. Technical issues and service interruptions */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              6. Technical issues and service interruptions
            </h2>
            <p>
              If a session cannot be delivered due to a fault on our side (for example, a
              teacher no-show or a platform outage) we will make-good by offering a replacement
              session at no additional charge. If a replacement session is not possible, we will
              credit or refund you for that session proportionally.
            </p>
            <p>
              We are not responsible for connectivity issues on your end (internet outages,
              device problems) but we will do our best to accommodate rescheduling requests
              where reasonable.
            </p>
          </section>

          {/* 7. Contact */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">7. Contact us</h2>
            <p>
              Refund queries and cancellation requests:{" "}
              <a className="underline" href="mailto:hello@myyogaclasses.fit">
                hello@myyogaclasses.fit
              </a>
              .
            </p>
          </section>

        </div>
      </div>
    </article>
  );
}
