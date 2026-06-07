"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const SCRIPT_TIMEOUT_MS = 10_000;

// Minimal typings for the global injected by checkout.js — only what we use.
type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayFailureResponse = {
  error: { code: string; description: string; reason?: string };
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", cb: (response: RazorpayFailureResponse) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

/**
 * Lazily inject the Checkout script once, on first use. Resolves false on
 * failure and after a timeout, so the caller never hangs if the script element
 * exists but its load/error event already fired (or never arrives).
 */
function loadCheckoutScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);

    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    // Fallback: if no event fires in time, resolve on whether the global appeared.
    const timer = setTimeout(() => finish(Boolean(window.Razorpay)), SCRIPT_TIMEOUT_MS);

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => finish(true));
      existing.addEventListener("error", () => finish(false));
      return;
    }

    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT_SRC;
    script.async = true;
    script.onload = () => finish(true);
    script.onerror = () => finish(false);
    document.body.appendChild(script);
  });
}

export type RazorpayCheckoutButtonProps = {
  /** Catalog product id resolved to a price server-side (never an amount). */
  productId: string;
  /** Optional receipt reference shown in the Razorpay dashboard. */
  receipt?: string;
  /** Business/product name shown in the modal. */
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  /** Modal accent color. */
  themeColor?: string;
  children?: ReactNode;
  className?: string;
  /** Called after the server confirms the payment signature + capture. */
  onPaid?: (result: { orderId: string; paymentId: string }) => void;
};

export function RazorpayCheckoutButton({
  productId,
  receipt,
  name = "MYYOGACLASSES",
  description = "Yoga session",
  prefill,
  themeColor = "#111827",
  children,
  className,
  onPaid,
}: RazorpayCheckoutButtonProps) {
  // `loading` stays true from click until the modal closes (dismiss / success /
  // failure), so the trigger can't be clicked twice into two parallel orders.
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!keyId) {
      toast.error("Razorpay isn't configured (missing NEXT_PUBLIC_RAZORPAY_KEY_ID).");
      return;
    }

    setLoading(true);

    // 1. Create the order on our backend (price resolved there).
    let orderRes: Response;
    try {
      orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, receipt }),
      });
    } catch {
      toast.error("Network error — please try again.");
      setLoading(false);
      return;
    }

    const order = (await orderRes.json().catch(() => ({}))) as {
      orderId?: string;
      amount?: number;
      currency?: string;
      error?: string;
    };

    if (orderRes.status === 401) {
      toast.error("Please sign in to continue.");
      setLoading(false);
      return;
    }
    if (!orderRes.ok || !order.orderId || order.amount == null || !order.currency) {
      toast.error(order.error ?? "Couldn't start checkout. Please try again.");
      setLoading(false);
      return;
    }

    // 2. Make sure the Razorpay Checkout script is available.
    const ready = await loadCheckoutScript();
    if (!ready || !window.Razorpay) {
      toast.error("Couldn't load the payment window. Check your connection.");
      setLoading(false);
      return;
    }

    // 3. Open the modal against the order we just created.
    const rzp = new window.Razorpay({
      key: keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name,
      description,
      prefill,
      theme: { color: themeColor },
      handler: async (response) => {
        // 4. Verify signature + capture server-side before trusting success.
        try {
          const verifyRes = await fetch("/api/razorpay/verify-payment", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(response),
          });
          const verify = (await verifyRes.json().catch(() => ({}))) as {
            verified?: boolean;
            error?: string;
          };
          if (verifyRes.ok && verify.verified) {
            toast.success("Payment successful!");
            onPaid?.({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
            });
          } else {
            toast.error(verify.error ?? "Payment couldn't be verified.");
          }
        } catch {
          toast.error("Payment verification failed. Please contact support.");
        } finally {
          setLoading(false);
        }
      },
      modal: {
        ondismiss: () => {
          setLoading(false);
          toast.info("Payment cancelled.");
        },
      },
    });

    rzp.on("payment.failed", (response) => {
      toast.error(response.error?.description ?? "Payment failed. Please try again.");
      setLoading(false);
    });

    rzp.open();
  }

  return (
    <Button onClick={handleClick} disabled={loading} className={className}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      {children ?? "Pay now"}
    </Button>
  );
}
