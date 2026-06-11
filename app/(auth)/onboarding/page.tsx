import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/redirects";
import { OnboardingForm } from "@/components/shared/OnboardingForm";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext, "/dashboard/book");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  // Returning users who already finished onboarding should never see this form
  // again — send them on to wherever they were headed.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, experience_level")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.experience_level) {
    redirect(rawNext ? next : "/dashboard");
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
          Three quick questions, then you&apos;ll see slots in your local time.
        </p>
        <OnboardingForm initialFullName={profile?.full_name ?? ""} next={next} />
      </div>
    </div>
  );
}
