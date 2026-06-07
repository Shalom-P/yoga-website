import { Suspense } from "react";
import Link from "next/link";
import { PartyPopper, CheckCircle2, Ticket } from "lucide-react";
import { PricingTeaser } from "@/components/marketing/PricingTeaser";
import { PlanAutoStart } from "@/components/dashboard/PlanAutoStart";
import { Button } from "@/components/ui/button";
import { getPlansWithFeatures } from "@/lib/data/landing";
import { requireUser } from "@/lib/auth/guards";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ booked?: string; purchased?: string }>;
}) {
  const { booked, purchased } = await searchParams;
  const { user, supabase } = await requireUser("/dashboard/plan");
  const [{ data: credits }, plans] = await Promise.all([
    supabase
      .from("customer_credits")
      .select("balance")
      .eq("customer_id", user.id)
      .maybeSingle(),
    getPlansWithFeatures(),
  ]);
  const balance = credits?.balance ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium">
        Your sessions
      </div>
      <h1 className="text-3xl md:text-4xl font-[family-name:var(--font-heading)] tracking-tight mt-1">
        {balance > 0
          ? `${balance} session credit${balance === 1 ? "" : "s"} ready.`
          : "You're on the free trial."}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {balance > 0
          ? "Use them to book any paid class. Top up with another pack anytime."
          : "Upgrade when you're ready — buy a pack of sessions, no subscription."}
      </p>

      {booked && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
          <PartyPopper className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Your free 1:1 is booked 🎉</p>
            <p className="mt-0.5 text-muted-foreground">
              We&apos;ll email your Google Meet link. Want to keep practising? Grab a pack below.
            </p>
          </div>
        </div>
      )}

      {purchased && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Pack purchased 🎉</p>
            <p className="mt-0.5 text-muted-foreground">
              Your credits are ready — time to book your next class.
            </p>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        <PlanAutoStart />
      </Suspense>

      {balance > 0 && (
        <div className="mt-8 rounded-3xl border border-border bg-card p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Ticket className="size-6 text-primary" />
              <div>
                <div className="text-2xl font-[family-name:var(--font-heading)]">
                  {balance} session{balance === 1 ? "" : "s"} left
                </div>
                <div className="text-sm text-muted-foreground">
                  Credits don&apos;t expire. Book whenever you like.
                </div>
              </div>
            </div>
            <Button asChild className="rounded-full">
              <Link href="/dashboard/book">Book a class</Link>
            </Button>
          </div>
        </div>
      )}

      <PricingTeaser plans={plans} />
    </div>
  );
}
