"use client";

/**
 * The single "buy a pack" entry point for the UI. It asks the server which
 * payment rail to use (decided GeoIP-first — see /api/payments/intent) and
 * branches:
 *   - India (INR)  → the existing Razorpay Checkout flow (startRazorpayCheckout).
 *   - UAE (AED)    → a manual SWIFT transfer; `onBankTransfer` fires with the
 *                    recorded payment so the caller can open the instructions.
 *
 * Callers pass the same callbacks as the Razorpay flow plus `onBankTransfer`.
 */

import { detectBrowserTimezone } from "@/lib/timezone";
import { OUTSIDE_SERVICE_AREA } from "@/lib/geo/region";
import {
  startRazorpayCheckout,
  type StartCheckoutArgs,
} from "@/components/shared/razorpay-checkout";

export type BankTransferIntent = {
  paymentId: string;
  reference: string | null;
  amountCents: number;
  currency: string;
  planName: string;
  sessionCredits: number;
};

export type StartCheckoutArgsWithBank = StartCheckoutArgs & {
  /** Fired (UAE only) when the chosen rail is a manual bank transfer. */
  onBankTransfer: (intent: BankTransferIntent) => void;
};

export async function startCheckout(args: StartCheckoutArgsWithBank): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/payments/intent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        planSlug: args.planSlug,
        clientTimezone: detectBrowserTimezone(),
      }),
    });
  } catch {
    args.onError("Network error — please try again.");
    return;
  }

  const data = (await res.json().catch(() => ({}))) as {
    method?: "razorpay" | "bank_transfer";
    currency?: string;
    payment?: { id: string; reference: string | null; amountCents: number };
    plan?: { name: string; sessionCredits: number };
    error?: string;
  };

  if (res.status === 401) {
    // Session expired server-side. Send to login; PlanAutoStart resumes on return.
    const next = encodeURIComponent(
      `/dashboard/plan?planSlug=${encodeURIComponent(args.planSlug)}`,
    );
    window.location.href = `/login?next=${next}`;
    return;
  }
  if (res.status === 403 && data.error === OUTSIDE_SERVICE_AREA) {
    args.onError("Session packs can only be purchased from within the UAE or India.");
    return;
  }
  if (!res.ok || !data.method) {
    args.onError(data.error ?? "Couldn't start checkout. Please try again.");
    return;
  }

  if (data.method === "bank_transfer") {
    if (!data.payment || !data.plan) {
      args.onError("Couldn't start bank transfer. Please try again.");
      return;
    }
    args.onBankTransfer({
      paymentId: data.payment.id,
      reference: data.payment.reference,
      amountCents: data.payment.amountCents,
      currency: data.currency ?? "AED",
      planName: data.plan.name,
      sessionCredits: data.plan.sessionCredits,
    });
    return;
  }

  // Razorpay (India) — needs the publishable key for the modal.
  if (!args.keyId) {
    args.onError("Checkout isn't configured yet.");
    return;
  }
  await startRazorpayCheckout(args);
}
