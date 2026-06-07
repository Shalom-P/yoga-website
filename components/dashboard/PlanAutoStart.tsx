"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { startRazorpayCheckout } from "@/components/shared/razorpay-checkout";

/**
 * Resumes checkout after a logged-out customer clicks a pack and signs in: the
 * pricing button sends them to /login?next=/dashboard/plan?planSlug=…, and this
 * opens the Razorpay modal for that pack on arrival. The loading card shows
 * while `planSlug` is in the URL; each outcome replaces the URL to clear it.
 */
export function PlanAutoStart() {
  const params = useSearchParams();
  const router = useRouter();
  const planSlug = params.get("planSlug");
  const fired = useRef(false);

  useEffect(() => {
    if (!planSlug || fired.current) return;
    fired.current = true;

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!keyId) {
      toast.error("Checkout isn't configured.");
      router.replace("/dashboard/plan");
      return;
    }
    startRazorpayCheckout({
      planSlug,
      keyId,
      onPaid: () => {
        toast.success("Payment successful!");
        router.replace("/dashboard/plan?purchased=1");
        router.refresh();
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

  if (!planSlug) return null;

  return (
    <div className="mt-10 rounded-3xl border border-border bg-card p-12 text-center">
      <Loader2 className="size-8 mx-auto animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">Opening checkout…</p>
    </div>
  );
}
