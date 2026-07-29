"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BankTransferDialog } from "@/components/shared/BankTransferDialog";
import { formatMoney } from "@/lib/i18n/money";
import type { BankTransferIntent } from "@/components/shared/checkout";

/**
 * The persistent, reopenable "your bank transfer is pending" surface on
 * /dashboard/plan, so a UAE customer can pull the SWIFT instructions back up at
 * any time after first clicking "Get this pack" — the rows disappear once an
 * admin verifies the transfer (the credits then show up as a balance instead).
 */
export function PendingBankTransfers({ transfers }: { transfers: BankTransferIntent[] }) {
  const [active, setActive] = useState<BankTransferIntent | null>(null);

  if (transfers.length === 0) return null;

  return (
    <div className="mt-8 space-y-3">
      {transfers.map((t) => (
        <div
          key={t.paymentId}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4"
        >
          <div className="flex items-start gap-3">
            <Landmark className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Bank transfer pending verification</p>
              <p className="text-muted-foreground">
                {t.planName} · {formatMoney(t.amountCents, t.currency)} · we&apos;ll add{" "}
                {t.sessionCredits} session{t.sessionCredits === 1 ? "" : "s"} once we confirm it
                {t.reference ? ` · ref ${t.reference}` : ""}.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setActive(t)}
          >
            View payment instructions
          </Button>
        </div>
      ))}

      <BankTransferDialog
        intent={active}
        open={active !== null}
        onOpenChange={(o) => !o && setActive(null)}
      />
    </div>
  );
}
