// DRAFT — substantive but NOT a substitute for legal review before launch.

export const metadata = {
  title: "Privacy policy — My Yoga Classes",
  description:
    "How My Yoga Classes collects, uses, and protects your personal information, in accordance with the Australian Privacy Act 1988 (Cth) and the Australian Privacy Principles.",
  alternates: { canonical: "/legal/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="px-7 pt-32 pb-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[clamp(2.25rem,4vw,3rem)] leading-[1.1] tracking-tight">
          Privacy policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 13 June 2026</p>

        <div className="mt-10 space-y-10 text-foreground/85 text-pretty">

          {/* 1. About this policy */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. About this policy</h2>
            <p>
              My Yoga Classes (ABN to be inserted) (“<strong>we</strong>”, “<strong>us</strong>”,
              “<strong>our</strong>”) operates <strong>myyogaclasses.fit</strong>, an online
              platform that connects Australian students with yoga teachers based in India for
              live 1:1 sessions conducted over Google Meet.
            </p>
            <p>
              We are bound by the <em>Privacy Act 1988</em> (Cth) and the thirteen Australian
              Privacy Principles (APPs). This policy explains what personal information we
              collect, why we collect it, how we use and disclose it, and your rights under
              Australian privacy law.
            </p>
            <p>
              By creating an account or booking a session you consent to the practices described
              in this policy.
            </p>
          </section>

          {/* 2. Information we collect */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Information we collect</h2>
            <p>We collect personal information that is reasonably necessary for our functions:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Identity &amp; contact:</strong> full name, email address (used for
                one-time passcode authentication), and an optional phone number you may choose
                to provide for booking-related contact.
              </li>
              <li>
                <strong>Account details:</strong> your preferred timezone, yoga goals, and any
                profile information you choose to provide.
              </li>
              <li>
                <strong>Booking history:</strong> dates and times of sessions booked, attended,
                or cancelled; teacher assigned; session notes you opt to save.
              </li>
              <li>
                <strong>Payment metadata:</strong> the session pack you purchased, payment
                status, and Razorpay order / payment IDs. We do <strong>not</strong> store card
                numbers, bank account details, or full payment credentials — all payment
                processing is handled directly by Razorpay and subject to Razorpay&apos;s privacy policy.
              </li>
              <li>
                <strong>Technical data:</strong> IP address, browser type, device identifiers,
                pages visited, and session duration, collected automatically by our analytics
                and error-monitoring tools (see Section 4).
              </li>
              <li>
                <strong>Communications:</strong> emails or support messages you send us.
              </li>
            </ul>
            <p>
              We collect information directly from you (registration, booking forms), through
              automated means (cookies, log files), and from third-party authentication providers
              (Google OAuth).
            </p>
          </section>

          {/* 3. Why we collect and use it */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              3. Why we collect and use your information
            </h2>
            <p>We collect and use personal information to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Create and manage your account and authenticate you securely.</li>
              <li>Match you with an available teacher and schedule sessions across timezones.</li>
              <li>Generate and send Google Meet links for your sessions.</li>
              <li>Process one-time session-pack payments in AUD via Razorpay.</li>
              <li>Send booking confirmations, reminders, and account notifications by email.</li>
              <li>Provide customer support.</li>
              <li>Improve our platform and personalise your experience.</li>
              <li>Comply with applicable laws and enforce our terms.</li>
              <li>Send you marketing communications about our services (you may opt out at any time).</li>
            </ul>
            <p>
              We will not use your personal information for a purpose that is unrelated to why
              we collected it unless you consent or we are required to do so by law.
            </p>
          </section>

          {/* 4. Sub-processors and disclosure */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              4. Sub-processors and third-party disclosure
            </h2>
            <p>
              We share personal information with the following service providers, each bound by
              appropriate data-processing agreements:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold">Service</th>
                    <th className="text-left py-2 pr-4 font-semibold">Purpose</th>
                    <th className="text-left py-2 font-semibold">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="py-2 pr-4">Supabase</td>
                    <td className="py-2 pr-4">Authentication, database, file storage</td>
                    <td className="py-2">USA (AWS)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Razorpay</td>
                    <td className="py-2 pr-4">One-time payment processing (session packs)</td>
                    <td className="py-2">India</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Google (Calendar &amp; Meet)</td>
                    <td className="py-2 pr-4">Session scheduling and video conferencing</td>
                    <td className="py-2">USA</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Resend</td>
                    <td className="py-2 pr-4">Transactional and marketing emails</td>
                    <td className="py-2">USA</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">PostHog</td>
                    <td className="py-2 pr-4">Product analytics and usage tracking</td>
                    <td className="py-2">USA / EU</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Sentry</td>
                    <td className="py-2 pr-4">Application error monitoring</td>
                    <td className="py-2">USA</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Teachers (India)</td>
                    <td className="py-2 pr-4">Delivering yoga sessions; see your booking details</td>
                    <td className="py-2">India</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p>
              We do not sell your personal information to third parties. We may disclose
              information if required by law, in connection with legal proceedings, or to
              protect the rights and safety of our users.
            </p>
          </section>

          {/* 5. Overseas disclosure */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">5. Overseas disclosure</h2>
            <p>
              Your personal information is disclosed to recipients located outside Australia,
              primarily in the United States and India (see the table above). Before doing so,
              we take reasonable steps to ensure those recipients handle your information in a
              manner consistent with the Australian Privacy Principles, including by relying on
              contractual protections and, where applicable, the recipient country&apos;s
              privacy laws.
            </p>
            <p>
              By using our service you acknowledge that overseas disclosure is necessary for
              service delivery and consent to that disclosure under APP 8.
            </p>
          </section>

          {/* 6. Cookies and analytics */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">6. Cookies and analytics</h2>
            <p>
              We use cookies and similar tracking technologies to keep you signed in, remember
              your preferences, and understand how our site is used. Our analytics provider
              PostHog may set cookies and collect pseudonymous identifiers.
            </p>
            <p>
              You can control cookies through your browser settings. Disabling cookies may
              affect certain features (such as staying logged in).
            </p>
          </section>

          {/* 7. Data retention */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">7. Data retention</h2>
            <p>
              We retain personal information for as long as your account is active and for a
              reasonable period afterwards to fulfil legal obligations, resolve disputes, and
              enforce our agreements. Booking and payment records are typically retained for
              seven years to satisfy Australian financial record-keeping requirements. You may
              request deletion of your account at any time (see Section 9); note that some
              information may be retained where we are required by law.
            </p>
          </section>

          {/* 8. Security */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">8. Security</h2>
            <p>
              We take reasonable steps to protect personal information from misuse, interference,
              loss, and unauthorised access, including encrypted connections (TLS), row-level
              security on our database, and access controls. However, no internet transmission
              is completely secure, and we cannot guarantee absolute security.
            </p>
          </section>

          {/* 9. Access, correction, and deletion */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              9. Your access, correction, and deletion rights
            </h2>
            <p>
              Under the Australian Privacy Principles (APP 12 and APP 13) you have the right to:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Request access to the personal information we hold about you.</li>
              <li>Request correction of information that is inaccurate, out of date, or incomplete.</li>
              <li>Request deletion of your account and associated personal data.</li>
            </ul>
            <p>
              To exercise these rights, contact us at{" "}
              <a className="underline" href="mailto:hello@myyogaclasses.fit">
                hello@myyogaclasses.fit
              </a>
              . We will respond within 30 days. We may need to verify your identity before
              fulfilling a request.
            </p>
          </section>

          {/* 10. Privacy complaints */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">10. Privacy complaints</h2>
            <p>
              If you believe we have breached your privacy rights, please contact us first so
              we can try to resolve the issue (see Section 11). If you are not satisfied with
              our response you may lodge a complaint with the Office of the Australian
              Information Commissioner (OAIC):
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Website:{" "}
                <a
                  className="underline"
                  href="https://www.oaic.gov.au"
                  target="_blank"
                  rel="noreferrer"
                >
                  www.oaic.gov.au
                </a>
              </li>
              <li>Phone: 1300 363 992</li>
              <li>Post: GPO Box 5218, Sydney NSW 2001</li>
            </ul>
          </section>

          {/* 11. Contact */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">11. Contact us</h2>
            <p>
              For privacy enquiries, please email us at{" "}
              <a className="underline" href="mailto:hello@myyogaclasses.fit">
                hello@myyogaclasses.fit
              </a>
              .
            </p>
          </section>

          {/* 12. Changes */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">12. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. We will notify you of material
              changes by email or by a notice on our website. The date at the top of this
              page indicates when the policy was last revised.
            </p>
          </section>

        </div>
      </div>
    </article>
  );
}
