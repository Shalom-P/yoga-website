"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatAud } from "@/lib/i18n/money";

type Props = {
  paypalSubscriptionId: string;
  planName: string;
  planPriceCents: number;
  billingInterval: "monthly" | "quarterly" | "yearly";
  status: "active" | "pending" | "suspended";
  nextBillingAt: string | null;
};

export function CurrentSubscription({
  paypalSubscriptionId,
  planName,
  planPriceCents,
  billingInterval,
  status,
  nextBillingAt,
}: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function confirmCancel() {
    setLoading(true);
    try {
      const res = await fetch("/api/paypal/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscriptionId: paypalSubscriptionId, reason }),
      });
      if (!res.ok) {
        toast.error("Couldn't cancel. Please try again or contact support.");
        return;
      }
      toast.success("Cancellation requested. Your plan stays active until the end of the billing period.");
      setOpen(false);
      setTimeout(() => window.location.reload(), 800);
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  const cadenceLabel =
    billingInterval === "monthly" ? "month" : billingInterval === "quarterly" ? "quarter" : "year";

  return (
    <>
      <div className="mt-10 rounded-3xl border border-border bg-card p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium">
              Active plan
            </div>
            <h2 className="text-2xl font-[family-name:var(--font-heading)] mt-1">{planName}</h2>
            <div className="mt-2 text-sm text-muted-foreground">
              {formatAud(planPriceCents)} per {cadenceLabel}
              {status === "active" && nextBillingAt
                ? ` · next bill on ${new Date(nextBillingAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}`
                : ""}
            </div>
            {status === "pending" && (
              <div className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                PayPal is still activating this subscription — you&apos;ll get an email the moment it&apos;s live.
              </div>
            )}
            {status === "suspended" && (
              <div className="mt-2 text-xs text-destructive">
                Subscription suspended. Please update your PayPal payment method.
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            {status === "suspended" && (
              <Button asChild className="rounded-full">
                <a
                  href="https://www.paypal.com/myaccount/autopay/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Update payment in PayPal
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setOpen(true)}
              disabled={status !== "active"}
            >
              Cancel subscription
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel your subscription?</DialogTitle>
            <DialogDescription>
              Your plan stays active until the end of the current billing period. You can resubscribe anytime.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Mind sharing why? (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Anything we could do better?"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Keep my plan
            </Button>
            <Button variant="destructive" onClick={confirmCancel} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Cancel subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
