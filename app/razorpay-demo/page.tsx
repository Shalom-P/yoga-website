import type { Metadata } from "next";
import Link from "next/link";

import { RazorpayCheckoutButton } from "@/components/shared/RazorpayCheckoutButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Standalone dev harness for the Razorpay Standard Checkout flow (create-order
 * → modal → verify-payment). Visit /razorpay-demo, sign in, then "Pay ₹500".
 *
 * Checkout now requires an authenticated user (the API derives the price from
 * its catalog by productId, never from the client). This page is isolated from
 * the live PayPal subscription billing — delete it once you've wired
 * <RazorpayCheckoutButton /> into a real surface.
 */

export const metadata: Metadata = {
  title: "Razorpay Checkout (demo)",
  robots: { index: false, follow: false },
};

export default async function RazorpayDemoPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Razorpay Checkout demo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Test order of ₹500 (price resolved server-side from <code>productId</code>).
          Test keys only — no real money moves. Use a Razorpay test instrument
          (e.g. UPI id <code>success@razorpay</code>, or card
          4111&nbsp;1111&nbsp;1111&nbsp;1111 with any future expiry / CVV).
        </p>
      </div>

      {!user ? (
        <p className="text-sm text-muted-foreground">
          Checkout requires sign-in.{" "}
          <Link href="/login" className="text-primary underline underline-offset-4">
            Sign in
          </Link>{" "}
          first, then return here.
        </p>
      ) : null}

      <RazorpayCheckoutButton productId="demo_500" receipt="demo_receipt_1" description="Razorpay test order">
        Pay ₹500
      </RazorpayCheckoutButton>

      <p className="text-xs text-muted-foreground">
        Not wired into billing. Source: components/shared/RazorpayCheckoutButton.tsx
      </p>
    </main>
  );
}
