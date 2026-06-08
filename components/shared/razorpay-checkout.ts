"use client";

/**
 * Shared client-side Razorpay Checkout flow, used by every "buy a pack" surface
 * (pricing cards, auto-resume after login). It:
 *   1. creates the order on our server (price resolved there from planSlug),
 *   2. lazily loads checkout.js,
 *   3. opens the modal, then
 *   4. verifies + fulfils server-side (credits are granted there, never here).
 *
 * Outcomes are delivered via callbacks so each caller controls its own UI.
 */

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const SCRIPT_TIMEOUT_MS = 10_000;

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

/** Inject checkout.js once. Resolves false on failure/timeout so callers can't hang. */
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

export type StartCheckoutArgs = {
  /** Catalog plan slug — resolved to a price + credit count server-side. */
  planSlug: string;
  /** NEXT_PUBLIC_RAZORPAY_KEY_ID. */
  keyId: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  themeColor?: string;
  /** Fired only after the server confirms the signature + capture. */
  onPaid: (result: { orderId: string; paymentId: string; credits?: number }) => void;
  onError: (message: string) => void;
  onDismiss?: () => void;
};

export async function startRazorpayCheckout(args: StartCheckoutArgs): Promise<void> {
  // 1. Create the order on our backend (price resolved there).
  let orderRes: Response;
  try {
    orderRes = await fetch("/api/razorpay/create-order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planSlug: args.planSlug }),
    });
  } catch {
    args.onError("Network error — please try again.");
    return;
  }

  const order = (await orderRes.json().catch(() => ({}))) as {
    orderId?: string;
    amount?: number;
    currency?: string;
    error?: string;
  };
  if (orderRes.status === 401) {
    // Session expired server-side after the client-side auth check. Redirect
    // to login; PlanAutoStart on /dashboard/plan?planSlug=… resumes checkout.
    const next = encodeURIComponent(`/dashboard/plan?planSlug=${encodeURIComponent(args.planSlug)}`);
    window.location.href = `/login?next=${next}`;
    return;
  }
  if (!orderRes.ok || !order.orderId || order.amount == null || !order.currency) {
    args.onError(order.error ?? "Couldn't start checkout. Please try again.");
    return;
  }

  // 2. Make sure the Checkout script is available.
  const ready = await loadCheckoutScript();
  if (!ready || !window.Razorpay) {
    args.onError("Couldn't load the payment window. Check your connection.");
    return;
  }

  // 3. Open the modal against the order we just created.
  const rzp = new window.Razorpay({
    key: args.keyId,
    amount: order.amount,
    currency: order.currency,
    order_id: order.orderId,
    name: args.name ?? "MYYOGACLASSES",
    description: args.description ?? "Session pack",
    prefill: args.prefill,
    theme: { color: args.themeColor ?? "#111827" },
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
          credits?: number;
          error?: string;
        };
        if (verifyRes.ok && verify.verified) {
          args.onPaid({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            credits: verify.credits,
          });
        } else {
          args.onError(verify.error ?? "Payment couldn't be verified.");
        }
      } catch {
        args.onError("Payment verification failed. Please contact support.");
      }
    },
    modal: { ondismiss: () => args.onDismiss?.() },
  });

  rzp.on("payment.failed", (response) => {
    args.onError(response.error?.description ?? "Payment failed. Please try again.");
  });

  rzp.open();
}
