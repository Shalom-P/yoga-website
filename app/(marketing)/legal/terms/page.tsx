// DRAFT — substantive but NOT a substitute for legal review before launch.
// TODO: confirm contact email hello@myyogaclasses.com.au with the business owner before publishing.

import Link from "next/link";

export const metadata = {
  title: "Terms of service — My Yoga Classes",
  description:
    "Terms governing your use of myyogaclasses.fit, including subscriptions, bookings, cancellation, and your rights under Australian Consumer Law.",
};

export default function TermsPage() {
  return (
    <article className="px-7 pt-32 pb-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[clamp(2.25rem,4vw,3rem)] leading-[1.1] tracking-tight">
          Terms of service
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 7 June 2026</p>

        <div className="mt-10 space-y-10 text-foreground/85 text-pretty">

          {/* 1. About these terms */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. About these terms</h2>
            <p>
              These Terms of Service (“<strong>Terms</strong>”) govern your access to and use
              of <strong>myyogaclasses.fit</strong> and any related services
              (collectively, the “<strong>Service</strong>”) operated by My Yoga Classes
              (ABN to be inserted, “<strong>we</strong>”, “<strong>us</strong>”,
              “<strong>our</strong>”).
            </p>
            <p>
              By creating an account or using the Service you agree to be bound by these Terms.
              If you do not agree, please do not use the Service.
            </p>
            <p>
              <strong>Nothing in these Terms limits or excludes any rights you have under the{" "}
              Australian Consumer Law (Schedule 2 of the Competition and Consumer Act 2010
              (Cth)) or other applicable Australian law that cannot be excluded by agreement.</strong>
            </p>
          </section>

          {/* 2. Service description */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Service description</h2>
            <p>
              My Yoga Classes is an online platform connecting students based in Australia with
              qualified yoga teachers based in India. Sessions are delivered live via Google
              Meet on a one-to-one basis according to your chosen subscription plan.
            </p>
            <p>
              We act as the platform operator and are responsible for scheduling, billing, and
              overall service quality. Teachers are engaged by us to deliver sessions on our
              behalf.
            </p>
          </section>

          {/* 3. Eligibility and accounts */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. Eligibility and accounts</h2>
            <p>To use the Service you must:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Be at least 18 years old (or have verifiable parental/guardian consent if younger).</li>
              <li>Provide accurate and complete registration information.</li>
              <li>Keep your account credentials confidential and not share them with others.</li>
              <li>Promptly notify us of any unauthorised use of your account.</li>
            </ul>
            <p>
              You are responsible for all activity that occurs under your account. We reserve
              the right to suspend or terminate accounts that breach these Terms.
            </p>
          </section>

          {/* 4. Bookings and the free trial */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              4. Bookings and the free 1:1 trial
            </h2>
            <p>
              Every new account is entitled to <strong>one free introductory 1:1 session</strong>{" "}
              — no payment method required. The trial session is subject to teacher availability
              and must be booked through the platform.
            </p>
            <p>
              When you book a session (free or paid):
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                A Google Meet link will be generated and sent to your registered email address
                and accessible via your dashboard.
              </li>
              <li>
                Sessions must be booked at least 15 minutes in advance of the scheduled start
                time.
              </li>
              <li>
                If you are unable to attend, please cancel or reschedule at least 24 hours
                before the session start time. Late cancellations and no-shows may count against
                your booking entitlement for that billing period.
              </li>
            </ul>
            <p>
              We will make reasonable efforts to deliver booked sessions, but we may need to
              reschedule in exceptional circumstances (for example, teacher illness). We will
              notify you as early as possible and offer an alternative time.
            </p>
          </section>

          {/* 5. Session packs and payment */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              5. Session packs and payment
            </h2>
            <p>
              Paid access is sold as <strong>one-time session packs</strong>, priced in{" "}
              <strong>Australian Dollars (AUD)</strong> and paid via Razorpay. There is no
              subscription and no automatic recurring charge.
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Buying a pack grants a number of session credits to your account. Each paid
                class you book uses one credit. You are charged once, at the time of purchase.
              </li>
              <li>
                Prices are displayed inclusive of any applicable GST. We will notify you before
                any change to pack pricing takes effect.
              </li>
              <li>
                Credits are personal to you, may not be transferred to another person, and do
                not expire unless we expressly state otherwise.
              </li>
            </ul>
          </section>

          {/* 6. Cancellation */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">6. Cancellation</h2>
            <p>
              You may cancel your subscription at any time from your account dashboard or by
              emailing us at{" "}
              <a className="underline" href="mailto:hello@myyogaclasses.com.au">
                hello@myyogaclasses.com.au
              </a>
              .
            </p>
            <p>
              Cancellation takes effect at the <strong>end of the current billing period</strong>.
              You will retain access to the Service until that date, after which no further
              charges will be made. We do not provide pro-rata refunds for partial billing
              periods except where required by law — see our{" "}
              <Link className="underline" href="/legal/refund">
                Refund Policy
              </Link>
              .
            </p>
            <p>
              We reserve the right to cancel or suspend your subscription immediately if you
              breach these Terms.
            </p>
          </section>

          {/* 7. Acceptable use */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">7. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use the Service for any unlawful purpose or in breach of any applicable law.</li>
              <li>
                Harass, abuse, threaten, or intimidate teachers, staff, or other users.
              </li>
              <li>Record sessions without the explicit consent of your teacher.</li>
              <li>
                Attempt to reverse-engineer, scrape, or interfere with the platform or its
                infrastructure.
              </li>
              <li>
                Share your account, session links, or subscription access with anyone else.
              </li>
              <li>
                Engage or attempt to engage teachers for sessions outside the platform in a
                way that circumvents our billing.
              </li>
            </ul>
            <p>
              We may suspend or terminate your account without notice for material breach of
              this section.
            </p>
          </section>

          {/* 8. Intellectual property */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">8. Intellectual property</h2>
            <p>
              All content on myyogaclasses.fit — including text, graphics, logos, teacher
              profiles, and software — is owned by or licensed to us and is protected by
              Australian and international intellectual property laws. You may not reproduce,
              distribute, or create derivative works without our prior written consent.
            </p>
            <p>
              Your use of the Service does not grant you any ownership rights in our content.
            </p>
          </section>

          {/* 9. Disclaimers */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">9. Health disclaimer</h2>
            <p>
              Yoga involves physical activity. You are responsible for assessing your own
              fitness and health before participating. We strongly recommend you consult a
              medical professional before beginning any exercise programme, particularly if
              you have a pre-existing health condition or injury.
            </p>
            <p>
              The Service does not provide medical advice. Nothing communicated during a session
              should be taken as medical or clinical guidance.
            </p>
          </section>

          {/* 10. Limitation of liability */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              10. Limitation of liability
            </h2>
            <p>
              To the maximum extent permitted by law, we exclude all liability for any indirect,
              consequential, incidental, special, or punitive loss or damage arising out of or
              in connection with the Service, including loss of data, loss of revenue, personal
              injury, or property damage.
            </p>
            <p>
              Our total aggregate liability to you (whether in contract, tort, statute, or
              otherwise) is limited to the total amount you paid us in the three months
              preceding the event giving rise to the claim.
            </p>
            <p>
              <strong>
                Nothing in this clause excludes or limits any liability that cannot be excluded
                or limited under the Australian Consumer Law or any other applicable law,
                including the consumer guarantees set out in the Australian Consumer Law.
              </strong>
            </p>
          </section>

          {/* 11. ACL rights */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              11. Australian Consumer Law rights
            </h2>
            <p>
              Our services come with guarantees that cannot be excluded under the Australian
              Consumer Law. For major failures with the service, you are entitled to:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Cancel your subscription and receive a full or partial refund; and</li>
              <li>Compensation for any other reasonably foreseeable loss or damage.</li>
            </ul>
            <p>
              If the failure does not amount to a major failure, you are entitled to have
              problems with the service rectified in a reasonable time, and, if this is not
              done, to cancel and obtain a refund for the unused portion of the subscription.
            </p>
            <p>
              Nothing in these Terms restricts, limits, or modifies those rights.
            </p>
          </section>

          {/* 12. Governing law */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">12. Governing law</h2>
            <p>
              These Terms are governed by the laws of <strong>New South Wales, Australia</strong>.
              Any disputes arising under these Terms are subject to the non-exclusive
              jurisdiction of the courts of New South Wales, Australia.
            </p>
          </section>

          {/* 13. Changes to these terms */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">13. Changes to these terms</h2>
            <p>
              We may update these Terms at any time. We will notify you of material changes by
              email at least 14 days before they take effect. Your continued use of the Service
              after the effective date constitutes acceptance of the updated Terms. If you do
              not accept the changes, you may cancel your subscription before the effective date.
            </p>
          </section>

          {/* 14. Contact */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">14. Contact us</h2>
            <p>
              Questions about these Terms? Email us at{" "}
              <a className="underline" href="mailto:hello@myyogaclasses.com.au">
                hello@myyogaclasses.com.au
              </a>
              .
            </p>
          </section>

        </div>
      </div>
    </article>
  );
}
