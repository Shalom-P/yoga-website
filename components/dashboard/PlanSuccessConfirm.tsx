"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type State = "loading" | "ok" | "pending" | "error";

export function PlanSuccessConfirm() {
  const params = useSearchParams();
  const subscriptionId = params.get("subscription_id");
  const [state, setState] = useState<State>(subscriptionId ? "loading" : "error");

  useEffect(() => {
    if (!subscriptionId) return;
    fetch("/api/paypal/confirm-subscription", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscriptionId }),
    })
      .then(async (r) => {
        if (!r.ok) {
          setState("error");
          return;
        }
        const data = (await r.json()) as { status?: string };
        setState(data.status === "active" ? "ok" : "pending");
      })
      .catch(() => setState("error"));
  }, [subscriptionId]);

  if (state === "loading") {
    return (
      <>
        <Loader2 className="size-10 mx-auto animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Confirming your subscription…</p>
      </>
    );
  }

  if (state === "ok") {
    return (
      <>
        <CheckCircle2 className="size-12 mx-auto text-primary" />
        <h1 className="mt-4 text-2xl font-[family-name:var(--font-heading)] tracking-tight">
          You&apos;re in.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your plan is active. Time to book your next class.
        </p>
        <Button asChild className="rounded-full mt-6">
          <Link href="/dashboard/book">Browse teachers</Link>
        </Button>
      </>
    );
  }

  if (state === "pending") {
    return (
      <>
        <Loader2 className="size-10 mx-auto animate-spin text-primary" />
        <h1 className="mt-4 text-2xl font-[family-name:var(--font-heading)] tracking-tight">
          Almost there.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          PayPal is finalising your subscription. We&apos;ll email you the moment it activates.
        </p>
        <Button asChild variant="outline" className="rounded-full mt-6">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AlertCircle className="size-12 mx-auto text-destructive" />
      <h1 className="mt-4 text-2xl font-[family-name:var(--font-heading)] tracking-tight">
        We couldn&apos;t confirm that subscription.
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        If you completed payment, your dashboard will update once PayPal finishes. Otherwise,
        please reach out to support.
      </p>
      <Button asChild variant="outline" className="rounded-full mt-6">
        <Link href="/dashboard/plan">Back to plans</Link>
      </Button>
    </>
  );
}
