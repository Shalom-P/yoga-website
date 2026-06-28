"use client";

import { useState } from "react";
import { Copy, Check, Landmark, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/i18n/money";
import { BANK_TRANSFER_FIELDS } from "@/lib/payments/bankTransfer";
import type { BankTransferIntent } from "@/components/shared/checkout";

/**
 * The reopenable "send the money to this account" message box for UAE customers.
 * Shows the SWIFT details (copy-per-field + copy-all), the amount, the match
 * reference, and a clear note that this rail is temporary. Rendering nothing for
 * a null intent lets callers keep it permanently mounted.
 */
export function BankTransferDialog({
  intent,
  open,
  onOpenChange,
}: {
  intent: BankTransferIntent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  if (!intent) return null;

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      toast.error("Couldn't copy — please copy it manually.");
    }
  }

  const amountMajor = (intent.amountCents / 100).toFixed(2);
  // Show the exact figure (with fils) — it's the amount the customer must wire,
  // and it has to match what the "copy amount" button copies (amountMajor).
  const amountDisplay = formatMoney(intent.amountCents, intent.currency, { withCents: true });
  const fields = [
    ...BANK_TRANSFER_FIELDS,
    ...(intent.reference
      ? [{ label: "Payment reference", value: intent.reference, copyable: true }]
      : []),
  ];
  const allDetails =
    `Amount: ${amountDisplay}\n` + fields.map((f) => `${f.label}: ${f.value}`).join("\n");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="size-5 text-primary" />
            Pay by bank transfer
          </DialogTitle>
          <DialogDescription>
            Send {amountDisplay} for the {intent.planName} ({intent.sessionCredits} session
            {intent.sessionCredits === 1 ? "" : "s"}) by SWIFT transfer to the account below.
          </DialogDescription>
        </DialogHeader>

        {intent.discount && (
          <div className="flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              Promo <strong className="font-mono">{intent.discount.code}</strong> applied —{" "}
              <strong>{formatMoney(intent.discount.amountCents, intent.currency, { withCents: true })}</strong>{" "}
              off. The amount below is already discounted.
            </p>
          </div>
        )}

        {intent.notice && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>{intent.notice}</p>
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            This is a <strong>temporary</strong> payment method for UAE customers while we finish
            setting up card payments. Your session credits are added as soon as we confirm your
            transfer{intent.reference ? " — quote the reference below so we can match it" : ""}.
          </p>
        </div>

        <div className="divide-y divide-border rounded-2xl border border-border">
          <Row
            label="Amount"
            value={amountDisplay}
            onCopy={() => copy(amountMajor, "__amount__")}
            copied={copied === "__amount__"}
          />
          {fields.map((f) => (
            <Row
              key={f.label}
              label={f.label}
              value={f.value}
              onCopy={f.copyable ? () => copy(f.value, f.label) : undefined}
              copied={copied === f.label}
            />
          ))}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={() => copy(allDetails, "__all__")}>
            {copied === "__all__" ? (
              <>
                <Check className="mr-1 size-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="mr-1 size-4" /> Copy all details
              </>
            )}
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="break-all font-medium">{value}</div>
      </div>
      {onCopy && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label={`Copy ${label}`}
          onClick={onCopy}
        >
          {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
        </Button>
      )}
    </div>
  );
}
