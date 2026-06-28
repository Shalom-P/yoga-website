// DRAFT — substantive but NOT a substitute for legal review before launch.

import Link from "next/link";

export const metadata = {
  title: "Terms of service — My Yoga Classes",
  description:
    "Terms governing your use of myyogaclasses.fit, including session packs, bookings, cancellation, and your consumer rights under UAE and Indian law.",
  alternates: { canonical: "/legal/terms" },
};

export default function TermsPage() {
  return (
    <article className="px-7 pt-32 pb-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[clamp(2.25rem,4vw,3rem)] leading-[1.1] tracking-tight">
          Terms of service
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 21 June 2026</p>

        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground/80">
          <strong>Pending legal review.</strong> This is a good-faith draft for a service
          operating across the UAE and India. It has not yet been reviewed by a qualified lawyer
          in either jurisdiction and must be verified before launch.
        </div>

        <div className="mt-10 space-y-10 text-foreground/85 text-pretty">

          {/* 1. About these terms */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. About these terms</h2>
            <p>
              These Terms of Service (“<strong>Terms</strong>”) govern your access to and use
              of <strong>myyogaclasses.fit</strong> and any related services
              (collectively, the “<strong>Service</strong>”) operated by My Yoga Classes
              (registration / trade-licence details to be inserted, “<strong>we</strong>”,
              “<strong>us</strong>”, “<strong>our</strong>”).
            </p>
            <p>
              By creating an account or using the Service you agree to be bound by these Terms.
              If you do not agree, please do not use the Service.
            </p>
            <p>
              <strong>Nothing in these Terms limits or excludes any rights you have under
              mandatory consumer-protection law in your country of residence — including the UAE
              Consumer Protection Law (Federal Law No. 15 of 2020) and India&apos;s Consumer
              Protection Act 2019 — that cannot be excluded by agreement.</strong>
            </p>
          </section>

          {/* 2. Service description */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Service description</h2>
            <p>
              My Yoga Classes is an online platform connecting students in the United Arab
              Emirates and India with qualified yoga teachers based in India. Sessions are
              delivered live via Google Meet on a one-to-one basis, paid for with a session pack.
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

          {/* 4. Bookings */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              4. Bookings
            </h2>
            <p>
              Sessions are booked through the platform and are subject to teacher availability.
            </p>
            <p>
              When you book a session:
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
                before the session start time. Late cancellations and no-shows may result in the
                session credit used for that booking being forfeited.
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
              <strong>UAE Dirhams (AED) or Indian Rupees (INR) depending on your region</strong>{" "}
              and paid via Razorpay. There is no subscription and no automatic recurring charge.
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Buying a pack grants a number of session credits to your account. Each paid
                class you book uses one credit. You are charged once, at the time of purchase.
              </li>
              <li>
                Prices are displayed inclusive of any applicable taxes (such as UAE VAT or India
                GST). We will notify you before any change to pack pricing takes effect.
              </li>
              <li>
                Credits are personal to you, may not be transferred to another person, and do
                not expire unless we expressly state otherwise.
              </li>
            </ul>
          </section>

          {/* 6. Cancellation */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              6. Cancelling a session or your account
            </h2>
            <p>
              You may cancel a booked session at any time before it starts, from your account
              dashboard. If the booking used a session credit, that credit is returned to your
              account to use on a future booking — see our{" "}
              <Link className="underline" href="/legal/refund">
                Refund Policy
              </Link>{" "}
              for when a purchased pack itself is refundable.
            </p>
            <p>
              You may close your account at any time by emailing us at{" "}
              <a className="underline" href="mailto:hello@myyogaclasses.fit">
                hello@myyogaclasses.fit
              </a>
              . Because packs are one-time purchases, there is no recurring subscription to stop.
            </p>
            <p>
              We reserve the right to suspend or close your account immediately if you breach
              these Terms.
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
                Share your account, session links, or session credits with anyone else.
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
              profiles, and software — is owned by or licensed to us and is protected by UAE,
              Indian, and international intellectual property laws. You may not reproduce,
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
                or limited under mandatory consumer-protection law in your country of residence,
                including the UAE Consumer Protection Law and India&apos;s Consumer Protection
                Act 2019.
              </strong>
            </p>
          </section>

          {/* 11. Consumer rights */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              11. Your consumer rights
            </h2>
            <p>
              Our services come with consumer guarantees that cannot be excluded under the
              mandatory consumer-protection law that applies to you — including the{" "}
              <strong>UAE Consumer Protection Law (Federal Law No. 15 of 2020)</strong> and its
              implementing regulations for customers in the UAE, and the{" "}
              <strong>Consumer Protection Act 2019</strong> for customers in India. Where a
              service is not provided with reasonable care and skill, or otherwise fails to meet
              those standards, you may be entitled to:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Have the problem remedied within a reasonable time; and</li>
              <li>
                Where it cannot be remedied, cancel and obtain a refund for any unused session
                credits, plus any other remedy available under applicable law.
              </li>
            </ul>
            <p>
              Nothing in these Terms restricts, limits, or modifies any right you have under
              mandatory consumer-protection law.
            </p>
          </section>

          {/* 12. Governing law */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">12. Governing law</h2>
            <p>
              These Terms are governed by the laws of the{" "}
              <strong>United Arab Emirates (Emirate of Dubai)</strong>, and disputes arising under
              them are subject to the non-exclusive jurisdiction of the courts of Dubai. This does
              not deprive you of the protection of mandatory consumer-protection law in your
              country of residence: customers in India retain the right to pursue remedies under
              Indian consumer law before the appropriate Indian forum.
            </p>
          </section>

          {/* 13. Changes to these terms */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">13. Changes to these terms</h2>
            <p>
              We may update these Terms at any time. We will notify you of material changes by
              email at least 14 days before they take effect. Your continued use of the Service
              after the effective date constitutes acceptance of the updated Terms. If you do
              not accept the changes, you may stop using the Service and request a refund of any
              unused session credits before the effective date.
            </p>
          </section>

          {/* 14. Contact */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">14. Contact us</h2>
            <p>
              Questions about these Terms? Email us at{" "}
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
