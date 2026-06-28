"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { startCheckout, type BankTransferIntent } from "@/components/shared/checkout";
import { BankTransferDialog } from "@/components/shared/BankTransferDialog";
import { formatMoney } from "@/lib/i18n/money";

/**
 * Resumes checkout after a logged-out customer clicks a pack and signs in: the
 * pricing button sends them to /login?next=/dashboard/plan?planSlug=…, and this
 * opens the right rail on arrival — Razorpay (India) or the SWIFT instructions
 * dialog (UAE). The loading card shows while `planSlug` is in the URL; each
 * outcome replaces the URL to clear it.
 */
export function PlanAutoStart() {
  const params = useSearchParams();
  const router = useRouter();
  const planSlug = params.get("planSlug");
  // Carried across the login redirect from the pricing CTA so a promo entered
  // while logged out isn't lost when checkout resumes here.
  const promoCode = params.get("promo") ?? undefined;
  const fired = useRef(false);
  const [bankIntent, setBankIntent] = useState<BankTransferIntent | null>(null);

  useEffect(() => {
    if (!planSlug || fired.current) return;
    fired.current = true;

    startCheckout({
      planSlug,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
      promoCode,
      onDiscountApplied: (d) =>
        toast.success(`Promo ${d.code} applied — ${formatMoney(d.amountCents, d.currency)} off.`),
      onPaid: () => {
        toast.success("Payment successful!");
        router.replace("/dashboard/plan?purchased=1");
        router.refresh();
      },
      onBankTransfer: (intent) => {
        setBankIntent(intent);
        router.replace("/dashboard/plan");
      },
      onError: (message) => {
        toast.error(message);
        router.replace("/dashboard/plan");
      },
      onDismiss: () => {
        router.replace("/dashboard/plan");
      },
    });
  }, [planSlug, promoCode, router]);

  return (
    <>
      {planSlug && (
        <div className="mt-10 rounded-3xl border border-border bg-card p-12 text-center">
          <Loader2 className="size-8 mx-auto animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Opening checkout…</p>
        </div>
      )}
      <BankTransferDialog
        intent={bankIntent}
        open={bankIntent !== null}
        onOpenChange={(o) => !o && setBankIntent(null)}
      />
    </>
  );
}
