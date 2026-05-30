import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { OnboardingForm } from "@/components/shared/OnboardingForm";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-xl">
        <div className="myc-eyebrow mb-3">
          <span className="myc-dot" aria-hidden="true" />
          Step 1 of 2
        </div>
        <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-cormorant)] tracking-tight">
          Let&apos;s find your <span className="text-accent italic">perfect teacher.</span>
        </h1>
        <p className="mt-3 text-muted-foreground">
          Three quick questions, then you&apos;ll see slots in your local time.
        </p>
        <OnboardingForm />
      </div>
    </div>
  );
}
