import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PricingTeaser } from "@/components/marketing/PricingTeaser";
import { PlanAutoStart } from "@/components/dashboard/PlanAutoStart";
import { PendingBankTransfers } from "@/components/dashboard/PendingBankTransfers";
import { BookedConversion } from "@/components/dashboard/BookedConversion";
import {
  BookedConfirmation,
  type BookedSession,
} from "@/components/dashboard/BookedConfirmation";
import { getPlansWithFeatures } from "@/lib/data/landing";
import { requireUser } from "@/lib/auth/guards";
import { DEFAULT_CUSTOMER_TZ } from "@/lib/timezone";
import type { BankTransferIntent } from "@/components/shared/checkout";

type LatestBooking = {
  id: string;
  session: {
    start_at: string;
    end_at: string;
    teacher: { display_name: string } | null;
  } | null;
};

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ booked?: string; purchased?: string }>;
}) {
  const { booked, purchased } = await searchParams;
  const { user, supabase } = await requireUser("/dashboard/plan");
  const [{ data: credits }, plans, { data: pendingTransfers }, latestBooking, bookedProfile] =
    await Promise.all([
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
      // The booking flow lands here with ?booked=1 the moment a first 1:1 commits.
      // Its id keys the Google Ads booking conversion (one count per id); the
      // nested session confirms the booking back to the customer. Neither is
      // fatal to read back: the ad conversion or the detail card is just skipped.
      booked
        ? supabase
            .from("bookings")
            .select("id, session:sessions!session_id(start_at, end_at, teacher:teachers(display_name))")
            .eq("customer_id", user.id)
            .eq("status", "confirmed")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : null,
      booked
        ? supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle()
        : null,
    ]);
  const balance = credits?.balance ?? 0;
  const bookedRow: LatestBooking | null = latestBooking?.data ?? null;
  const bookedId: string | null = bookedRow?.id ?? null;
  const bookedSession: BookedSession | null = bookedRow?.session
    ? {
        startAt: bookedRow.session.start_at,
        endAt: bookedRow.session.end_at,
        teacherName: bookedRow.session.teacher?.display_name ?? null,
      }
    : null;

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
      {booked ? (
        <>
          {bookedId && <BookedConversion bookingId={bookedId} />}
          <BookedConfirmation
            session={bookedSession}
            timezone={bookedProfile?.data?.timezone ?? DEFAULT_CUSTOMER_TZ}
          />
        </>
      ) : (
        <>
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
        </>
      )}

      {purchased && (
        <div className="mt-6 flex items-start gap-3 border border-accent/40 bg-accent/10 px-5 py-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Pack purchased</p>
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

      {/* After a booking the packs are the follow-up, not the headline: a quiet
          heading in place of the teaser's marketing-sized one, set off below a
          rule so it can't compete with the confirmation above. */}
      <div className={booked ? "mt-12 border-t border-border" : undefined}>
        <PricingTeaser
          plans={plans}
          header={
            booked ? (
              <>
                <div className="mb-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Keep practising
                </div>
                <h2 className="font-[family-name:var(--font-cormorant)] text-[clamp(1.7rem,2.6vw,2.1rem)] font-medium leading-[1.1]">
                  {balance > 0 ? "Top up anytime." : "Ready for your next 1:1?"}
                </h2>
                <p className="mx-auto mt-2 max-w-[32rem] text-[15px] text-muted-foreground">
                  Choose a pack of prepaid 1:1 sessions. One-time payment, no subscription,
                  and your sessions never expire.
                </p>
              </>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
