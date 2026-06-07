// DRAFT — substantive but NOT a substitute for legal review before launch.
// TODO: confirm contact email hello@myyogaclasses.fit with the business owner before publishing.

export const metadata = {
  title: "Refund policy — My Yoga Classes",
  description:
    "My Yoga Classes refund and cancellation policy, including the free trial, subscription billing cycles, and your rights under the Australian Consumer Law.",
};

export default function RefundPage() {
  return (
    <article className="px-7 pt-32 pb-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[clamp(2.25rem,4vw,3rem)] leading-[1.1] tracking-tight">
          Refund policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 7 June 2026</p>

        <div className="mt-10 space-y-10 text-foreground/85 text-pretty">

          {/* 1. Free trial */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. Free introductory session</h2>
            <p>
              Your <strong>first 1:1 session is completely free</strong> — no credit card or
              PayPal account is required to book it. If you choose not to continue after your
              trial, simply do nothing; you will not be charged.
            </p>
          </section>

          {/* 2. Subscription billing */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Subscription billing</h2>
            <p>
              Paid subscriptions are billed in <strong>AUD via PayPal</strong> at the start of
              each billing period (weekly, fortnightly, or monthly, depending on your chosen
              plan). Your subscription renews automatically until you cancel.
            </p>
            <p>
              You will receive an email receipt from PayPal each time a payment is processed.
              If you believe a charge is incorrect, contact us within 30 days of the billing
              date.
            </p>
          </section>

          {/* 3. Cancellation and access */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              3. Cancellation and access after cancellation
            </h2>
            <p>
              You may cancel your subscription at any time from your account dashboard or by
              emailing{" "}
              <a className="underline" href="mailto:hello@myyogaclasses.fit">
                hello@myyogaclasses.fit
              </a>
              .
            </p>
            <p>
              When you cancel, your subscription remains active until the{" "}
              <strong>end of the current paid billing period</strong>. You will retain full
              access to the Service (including the ability to book sessions within your plan
              allowance) until that date. After the period ends, your account reverts to
              inactive and no further payments are taken.
            </p>
            <p>
              We do <strong>not</strong> provide partial-period refunds for unused days or
              sessions remaining in a billing period unless required by law (see Section 5
              below).
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
              original PayPal payment method. PayPal&apos;s own processing timelines apply once
              a refund is initiated from our side.
            </p>
          </section>

          {/* 5. Australian Consumer Law */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              5. Australian Consumer Law — your statutory rights
            </h2>
            <p>
              Nothing in this Refund Policy limits or excludes any rights you have under the{" "}
              <strong>Australian Consumer Law (Schedule 2, Competition and Consumer Act 2010
              (Cth))</strong> that cannot be excluded by agreement.
            </p>
            <p>
              Our services come with guarantees that cannot be excluded under the Australian
              Consumer Law. If the services we provide are not delivered with due care and
              skill, are not fit for the purpose we agreed to, or are not delivered within a
              reasonable time, you may be entitled to a remedy including:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                A full or partial refund, or cancellation of the subscription with a refund of
                the unused portion, in the case of a major failure; or
              </li>
              <li>
                Rectification within a reasonable time, and a refund if rectification is not
                provided, in the case of a minor failure.
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
