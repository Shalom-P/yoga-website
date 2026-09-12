import { Suspense } from "react";
import Link from "next/link";
import { PartyPopper, CheckCircle2 } from "lucide-react";
import { PricingTeaser } from "@/components/marketing/PricingTeaser";
import { PlanAutoStart } from "@/components/dashboard/PlanAutoStart";
import { PendingBankTransfers } from "@/components/dashboard/PendingBankTransfers";
import { getPlansWithFeatures } from "@/lib/data/landing";
import { requireUser } from "@/lib/auth/guards";
import type { BankTransferIntent } from "@/components/shared/checkout";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ booked?: string; purchased?: string }>;
}) {
  const { booked, purchased } = await searchParams;
  const { user, supabase } = await requireUser("/dashboard/plan");
  const [{ data: credits }, plans, { data: pendingTransfers }] = await Promise.all([
    supabase
      .from("customer_credits")
      .select("balance")
      .eq("customer_id", user.id)
      .maybeSingle(),
    getPlansWithFeatures(),
    supabase
      .from("payments")
      .select("id, reference, amount_cents, currency, plan_id, created_at")
      .eq("customer_id", user.id)
      .eq("method", "bank_transfer")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);
  const balance = credits?.balance ?? 0;

  // Pair each pending transfer with its pack so the reopenable instructions
  // dialog can show the plan name + credits without another round trip.
  const pending: BankTransferIntent[] = (pendingTransfers ?? []).map((t) => {
    const plan = plans.find((p) => p.id === t.plan_id);
    return {
      paymentId: t.id,
      reference: t.reference,
      amountCents: t.amount_cents,
      currency: t.currency,
      planName: plan?.name ?? "Session pack",
      sessionCredits: plan?.session_credits ?? 0,
    };
  });

  return (
    <div>
      <div className="myc-eyebrow">
        <span className="myc-dot" />
        Your sessions
      </div>
      <h1 className="mt-2.5 font-[family-name:var(--font-cormorant)] text-[clamp(2.2rem,3.6vw,3rem)] font-medium leading-[1.05] tracking-[-0.015em]">
        {balance > 0
          ? `${balance} prepaid 1:1 session${balance === 1 ? "" : "s"} ready.`
          : "You're out of sessions."}
      </h1>
      <p className="mt-2 max-w-[40rem] text-[15px] text-muted-foreground">
        {balance > 0
          ? "Use them to book any paid class. Top up with another pack anytime."
          : "Buy a pack of sessions to keep booking, no subscription."}
      </p>

      {booked && (
        <div className="mt-6 flex items-start gap-3 border border-accent/40 bg-accent/10 px-5 py-4">
          <PartyPopper className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Your 1:1 is booked 🎉</p>
            <p className="mt-0.5 text-muted-foreground">
              We&apos;ll email your join link. Want to keep practising? Grab a pack below.
            </p>
          </div>
        </div>
      )}

      {purchased && (
        <div className="mt-6 flex items-start gap-3 border border-accent/40 bg-accent/10 px-5 py-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Pack purchased 🎉</p>
            <p className="mt-0.5 text-muted-foreground">
              Your sessions are ready, time to book your next class.
            </p>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        <PlanAutoStart />
      </Suspense>

      <PendingBankTransfers transfers={pending} />

      {balance > 0 && (
        <div className="myc-glass mt-7 flex flex-wrap items-center justify-between gap-[18px] px-7 py-6">
          <div className="flex items-center gap-[18px]">
            <span
              aria-hidden
              className="font-[family-name:var(--font-cormorant)] text-[56px] italic leading-none text-accent"
            >
              {balance}
            </span>
            <div>
              <div className="font-[family-name:var(--font-cormorant)] text-2xl font-semibold leading-[1.1]">
                {balance} session{balance === 1 ? "" : "s"} left
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                Your prepaid sessions don&apos;t expire. Book whenever you like.
              </div>
            </div>
          </div>
          <Link
            href="/dashboard/book"
            className="inline-flex items-center bg-accent px-[18px] py-[11px] text-sm font-semibold text-accent-foreground transition-colors hover:bg-[var(--myc-accent-hover)]"
          >
            Book a class
          </Link>
        </div>
      )}

      <PricingTeaser plans={plans} />
    </div>
  );
}
