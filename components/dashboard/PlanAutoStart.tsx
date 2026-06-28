"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { startCheckout, type BankTransferIntent } from "@/components/shared/checkout";
import { BankTransferDialog } from "@/components/shared/BankTransferDialog";

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
  const fired = useRef(false);
  const [bankIntent, setBankIntent] = useState<BankTransferIntent | null>(null);

  useEffect(() => {
    if (!planSlug || fired.current) return;
    fired.current = true;

    startCheckout({
      planSlug,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
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
  }, [planSlug, router]);

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
