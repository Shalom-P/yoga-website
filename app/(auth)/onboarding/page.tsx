import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { isOnboardingPath, postAuthTarget, safeNext } from "@/lib/auth/redirects";
import { OnboardingForm } from "@/components/shared/OnboardingForm";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: rawNext } = await searchParams;
  // Where the form sends the user after completing onboarding. A stale
  // self-referencing ?next=/onboarding would bounce them straight back here,
  // so it falls through to the teacher picker like a missing param.
  const requested = safeNext(rawNext, "/dashboard/book");
  const next = isOnboardingPath(requested) ? "/dashboard/book" : requested;

  const { user, supabase } = await requireUser("/onboarding");

  // Returning users who already finished onboarding should never see this form
  // again — send them on to wherever they were headed.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, experience_level")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.experience_level) {
    redirect(postAuthTarget(safeNext(rawNext, "/dashboard"), true));
  }

  return (
    <div className="min-h-dvh px-6 py-12">
      <div className="mx-auto max-w-xl">
        <div className="myc-eyebrow mb-3">
          <span className="myc-dot" aria-hidden="true" />
          Step 1 of 2
        </div>
        <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-cormorant)] tracking-tight">
          Let&apos;s find your <span className="text-accent italic">perfect teacher.</span>
        </h1>
        <p className="mt-3 text-muted-foreground">
          A few quick details, then you&apos;ll see slots in your local time.
        </p>
        <OnboardingForm
          initialFullName={profile?.full_name ?? ""}
          initialPhone={profile?.phone ?? ""}
          next={next}
        />
      </div>
    </div>
  );
}
