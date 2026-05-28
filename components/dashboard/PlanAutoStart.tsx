"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function PlanAutoStart() {
  const params = useSearchParams();
  const router = useRouter();
  const planSlug = params.get("planSlug");
  const fired = useRef(false);

  useEffect(() => {
    if (!planSlug || fired.current) return;
    fired.current = true;

    (async () => {
      try {
        const res = await fetch("/api/paypal/create-subscription", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ planSlug }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          approveUrl?: string;
          error?: string;
        };
        if (!res.ok || !body.approveUrl) {
          toast.error(
            body.error === "plan not configured"
              ? "This plan isn't ready for purchase yet."
              : "Couldn't start checkout. Please try again."
          );
          router.replace("/dashboard/plan");
          return;
        }
        window.location.href = body.approveUrl;
      } catch {
        toast.error("Network error — please try again.");
        router.replace("/dashboard/plan");
      }
    })();
  }, [planSlug, router]);

  if (!planSlug) return null;

  return (
    <div className="mt-10 rounded-3xl border border-border bg-card p-12 text-center">
      <Loader2 className="size-8 mx-auto animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">Starting PayPal checkout…</p>
    </div>
  );
}
