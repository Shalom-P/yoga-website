export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <article className="px-7 pt-32 pb-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[clamp(2.25rem,4vw,3rem)] leading-[1.1] tracking-tight">
          Privacy policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 28 May 2026</p>
        <div className="mt-10 space-y-6 text-foreground/85 text-pretty">
          <p>
            Placeholder privacy policy. Final copy should comply with the Australian
            Privacy Act 1988 (Cth) and address: collected data (email, phone, timezone,
            goals, payment metadata via PayPal), purpose of collection, sharing (Supabase,
            PayPal, Twilio, Google, Resend, PostHog), retention, your access/correction
            rights, and how to lodge a privacy complaint with the OAIC.
          </p>
        </div>
      </div>
    </article>
  );
}
