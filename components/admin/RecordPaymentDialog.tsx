"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldHint, LabelWithHint } from "@/components/ui/field-hint";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerCombobox, type CustomerOption } from "@/components/ui/customer-combobox";
import { formatMoney } from "@/lib/i18n/money";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, type Currency } from "@/lib/geo/region";
import { DEFAULT_CUSTOMER_TZ, formatInTz, teacherLocalToUtc } from "@/lib/timezone";
import { friendlyAdminError } from "@/lib/ui/errors";
import type { RazorpayLookupResponse, RecordPaymentResponse } from "@/lib/admin/contracts";
import type { PackOption } from "./PaymentsAdmin";

/**
 * Same convention as PlansAdmin: prices are integer minor units everywhere
 * except the one input a human types into. Kept explicit so a zero-decimal
 * currency cannot be added later without someone noticing the /100 is wrong.
 */
const MINOR_UNITS = 100;

const RAZORPAY_ID_RE = /^pay_[A-Za-z0-9]{6,32}$/;

type Rail = "razorpay" | "bank_transfer" | "manual";

const RAIL_OPTIONS: { value: Rail; label: string; sub: string }[] = [
  { value: "razorpay", label: "Razorpay payment", sub: "Card, UPI, netbanking" },
  { value: "bank_transfer", label: "Bank transfer received", sub: "SWIFT into the UAE account" },
  { value: "manual", label: "Other (cash, UPI)", sub: "An offline receipt" },
];

type Lookup =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; code: string }
  | { state: "done"; result: RazorpayLookupResponse };

function todayInIst(): string {
  return formatInTz(new Date(), DEFAULT_CUSTOMER_TZ, "yyyy-MM-dd");
}

function safeMoney(cents: number, currency: string): string {
  try {
    return formatMoney(cents, currency);
  } catch {
    return `${(cents / MINOR_UNITS).toFixed(2)} ${currency}`;
  }
}

/**
 * Record a payment that happened outside the normal checkout: a Razorpay
 * capture the webhook never delivered, a wire that landed without a pending
 * row, a cash or UPI receipt.
 *
 * The shape of this dialog is deliberate. Step one establishes what was
 * actually paid, and on the Razorpay rail that answer comes from Razorpay
 * rather than from the operator's memory: the amount, the currency and the
 * capture time are read-only, and the client never sends a figure the server
 * would then trust. Step two is attribution, which is the only part a human is
 * genuinely the authority on. The blocking states in between exist because the
 * realistic failure here is not a typo, it is entering the same payment twice.
 */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  plans,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: PackOption[];
}) {
  const router = useRouter();

  const [rail, setRail] = useState<Rail>("razorpay");
  const [razorpayId, setRazorpayId] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });

  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [planId, setPlanId] = useState("");
  const [grantCredits, setGrantCredits] = useState(true);
  const [note, setNote] = useState("");

  const [amountMinor, setAmountMinor] = useState<number | null>(null);
  const [currency, setCurrency] = useState<Currency>(DEFAULT_CURRENCY);
  const [paidOn, setPaidOn] = useState(todayInIst());
  const [reference, setReference] = useState("");

  const [submitting, setSubmitting] = useState(false);
  /** True once the server answers 409 already_recorded. Needs a link, not a toast. */
  const [duplicate, setDuplicate] = useState(false);

  function reset() {
    setRail("razorpay");
    setRazorpayId("");
    setLookup({ state: "idle" });
    setCustomer(null);
    setPlanId("");
    setGrantCredits(true);
    setNote("");
    setAmountMinor(null);
    setCurrency(DEFAULT_CURRENCY);
    setPaidOn(todayInIst());
    setReference("");
    setSubmitting(false);
    setDuplicate(false);
  }

  function close() {
    onOpenChange(false);
    // Wait for the close animation before wiping the fields, so the dialog does
    // not visibly empty itself on the way out.
    setTimeout(reset, 200);
  }

  /**
   * Takes the id as an argument rather than reading state: the paste handler
   * calls this in the same tick it calls setRazorpayId, and the state variable
   * it closed over is still the previous value at that point.
   */
  async function lookupById(rawId: string) {
    const id = rawId.trim();
    if (!RAZORPAY_ID_RE.test(id)) {
      setLookup({ state: "error", code: "razorpay_id_required" });
      return;
    }
    setLookup({ state: "loading" });
    setDuplicate(false);
    try {
      const res = await fetch(
        `/api/admin/payments?razorpayPaymentId=${encodeURIComponent(id)}`,
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setLookup({ state: "error", code: body?.error ?? "upstream_error" });
        return;
      }
      setLookup({ state: "done", result: body as RazorpayLookupResponse });
    } catch {
      setLookup({ state: "error", code: "upstream_error" });
    }
  }

  const found = lookup.state === "done" && lookup.result.found ? lookup.result : null;
  const foundPayment = found?.payment ?? null;
  const existing = found?.existing ?? null;
  const notCaptured = foundPayment !== null && !foundPayment.captured;

  // On the Razorpay rail the money is whatever Razorpay says it is.
  const effectiveAmount = rail === "razorpay" ? (foundPayment?.amountCents ?? null) : amountMinor;
  const effectiveCurrency = rail === "razorpay" ? (foundPayment?.currency ?? currency) : currency;

  const pack = plans.find((p) => p.id === planId) ?? null;
  const credits = grantCredits ? (pack?.session_credits ?? 0) : 0;

  const referenceIsReserved = /^MYC-/i.test(reference.trim());

  const step1Ready =
    rail !== "razorpay" ||
    (found !== null && found.found && !notCaptured && existing === null);

  const canSubmit =
    !submitting &&
    step1Ready &&
    customer !== null &&
    note.trim().length >= 3 &&
    (!grantCredits || (pack !== null && pack.session_credits > 0)) &&
    (rail === "razorpay" ||
      (reference.trim().length >= 3 &&
        !referenceIsReserved &&
        amountMinor !== null &&
        amountMinor > 0 &&
        paidOn.length === 10));

  async function submit() {
    if (!customer || !canSubmit) return;
    setSubmitting(true);
    setDuplicate(false);

    const body =
      rail === "razorpay"
        ? {
            source: "razorpay" as const,
            razorpayPaymentId: razorpayId.trim(),
            customerId: customer.id,
            planId: planId || null,
            grantCredits,
            note: note.trim(),
          }
        : {
            source: rail,
            reference: reference.trim(),
            customerId: customer.id,
            planId: planId || null,
            amountCents: amountMinor,
            currency,
            // A receipt records a day, not a moment. Noon IST is the unambiguous
            // point inside that day: it cannot roll into the day before or after
            // in any timezone the studio serves.
            paidAt: teacherLocalToUtc(paidOn, "12:00").toISOString(),
            grantCredits,
            note: note.trim(),
          };

    // Reset `submitting` in a finally: a rejected fetch (offline, DNS) on this
    // screen would otherwise leave both Cancel and the submit button disabled
    // for good, with nothing said, on the one form where money is keyed in by
    // hand and the admin cannot tell whether it landed.
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        if (res.status === 409 && payload?.error === "already_recorded") {
          // The admin needs the row, not an apology.
          setDuplicate(true);
          return;
        }
        toast.error(friendlyAdminError(payload?.error));
        return;
      }

      const result = (await res.json()) as RecordPaymentResponse;
      const who = customer.fullName?.trim() || customer.email || "the customer";
      const money = effectiveAmount != null ? safeMoney(effectiveAmount, effectiveCurrency) : "";

      if (result.mode === "fulfilled") {
        toast.success(
          `Recorded ${money} for ${who}. The order was one of ours, so normal fulfilment ran. New balance ${result.balance}.`,
        );
      } else if (result.credited > 0) {
        toast.success(
          `Recorded ${money} for ${who}. ${result.credited} prepaid session${
            result.credited === 1 ? "" : "s"
          } released, new balance ${result.balance ?? "unknown"}.`,
        );
      } else {
        toast.success(`Recorded ${money} for ${who}. No prepaid sessions were released.`);
      }

      close();
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            For money that arrived outside the normal checkout: a Razorpay capture the webhook
            never delivered, a wire with no pending row, a cash or UPI receipt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* ---- Step 1: what was paid ------------------------------------ */}
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              1. How it was paid
            </p>

            <div className="grid gap-2 sm:grid-cols-3">
              {RAIL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={rail === opt.value}
                  onClick={() => {
                    setRail(opt.value);
                    setLookup({ state: "idle" });
                    setDuplicate(false);
                  }}
                  className={
                    rail === opt.value
                      ? "border border-accent bg-accent/10 px-3 py-2.5 text-left text-sm"
                      : "border border-border px-3 py-2.5 text-left text-sm transition-colors hover:bg-foreground/4"
                  }
                >
                  <span className="block font-medium">{opt.label}</span>
                  <span className="block text-xs text-muted-foreground">{opt.sub}</span>
                </button>
              ))}
            </div>

            {rail === "razorpay" ? (
              <div className="space-y-2">
                <LabelWithHint
                  htmlFor="rzp_id"
                  hint="Copy it from the Razorpay dashboard. We ask Razorpay for the amount, the currency and the capture time, so nothing about the money is typed here."
                >
                  Razorpay payment id
                </LabelWithHint>
                <div className="flex items-center gap-2">
                  <Input
                    id="rzp_id"
                    value={razorpayId}
                    placeholder="pay_..."
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono"
                    onChange={(e) => {
                      setRazorpayId(e.target.value);
                      setLookup({ state: "idle" });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void lookupById(razorpayId);
                      }
                    }}
                    onPaste={(e) => {
                      // Pasting a well-formed id is the whole interaction, so
                      // do not make the operator then press a button as well.
                      const pasted = e.clipboardData.getData("text").trim();
                      if (RAZORPAY_ID_RE.test(pasted)) {
                        e.preventDefault();
                        setRazorpayId(pasted);
                        void lookupById(pasted);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void lookupById(razorpayId)}
                    disabled={lookup.state === "loading"}
                  >
                    {lookup.state === "loading" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <Search className="size-3.5 mr-1" />
                        Look up
                      </>
                    )}
                  </Button>
                </div>

                {lookup.state === "error" && (
                  <Callout tone="amber">{friendlyAdminError(lookup.code)}</Callout>
                )}

                {lookup.state === "done" && !lookup.result.found && (
                  <Callout tone="amber">
                    Razorpay has no payment with that id. Check the id, or record it as Other if it
                    did not go through Razorpay.
                  </Callout>
                )}

                {existing && (
                  <Callout tone="red">
                    <span className="block font-medium">This payment is already recorded.</span>
                    <span className="block">
                      It is on file as {existing.status}
                      {existing.entrySource === "admin_manual" ||
                      existing.entrySource === "admin_manual_reconciled"
                        ? ", entered by hand"
                        : ""}
                      .
                    </span>
                    <Link
                      href={`/admin/payments?q=${encodeURIComponent(razorpayId.trim())}`}
                      className="mt-1 inline-block underline underline-offset-2"
                      onClick={close}
                    >
                      Open it
                    </Link>
                  </Callout>
                )}

                {notCaptured && !existing && foundPayment && (
                  <Callout tone="amber">
                    Razorpay shows this as {foundPayment.status}, not captured. Prepaid sessions are
                    only released for captured payments.
                  </Callout>
                )}

                {found?.fulfillable && !existing && !notCaptured && (
                  <Callout tone="blue">
                    This payment belongs to an order this website created. Recording it runs the
                    normal fulfilment and credits the customer named on the order.
                  </Callout>
                )}

                {foundPayment && !existing && !notCaptured && (
                  <Callout tone="green">
                    <span className="block font-medium">
                      {safeMoney(foundPayment.amountCents, foundPayment.currency)} captured
                      {foundPayment.method ? ` by ${foundPayment.method}` : ""}.
                    </span>
                    <span className="block text-xs">
                      {formatInTz(foundPayment.paidAt, DEFAULT_CUSTOMER_TZ, "d MMM yyyy, h:mm a")} IST
                      {foundPayment.email ? ` · ${foundPayment.email}` : ""}
                    </span>
                  </Callout>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <LabelWithHint
                    htmlFor="record_amount"
                    hint="What actually landed, in the currency it landed in. Stored in minor units."
                  >
                    Amount
                  </LabelWithHint>
                  <Input
                    id="record_amount"
                    type="number"
                    min={0}
                    step={0.01}
                    value={amountMinor === null ? "" : (amountMinor / MINOR_UNITS).toFixed(2)}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      setAmountMinor(raw === "" ? null : Math.round((Number(raw) || 0) * MINOR_UNITS));
                    }}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="record_currency">Currency</Label>
                  <Select
                    value={currency}
                    onValueChange={(v) => v && setCurrency(v as Currency)}
                  >
                    <SelectTrigger id="record_currency" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <LabelWithHint
                    htmlFor="record_paid_on"
                    hint="The day the money landed, read as IST. This is what the row is filed under, not today's date."
                  >
                    Received on
                  </LabelWithHint>
                  <Input
                    id="record_paid_on"
                    type="date"
                    value={paidOn}
                    onChange={(e) => setPaidOn(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <LabelWithHint
                    htmlFor="record_reference"
                    hint="Your own invoice or receipt number. Must be unique."
                  >
                    Reference
                  </LabelWithHint>
                  <Input
                    id="record_reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. INV-2026-118"
                    className="mt-1.5 font-mono"
                  />
                  {referenceIsReserved && (
                    <p className="mt-1.5 text-xs text-destructive">
                      References starting with MYC are generated by the site. Use your own receipt
                      number.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ---- Step 2: who it belongs to -------------------------------- */}
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              2. Who it belongs to
            </p>

            <div>
              <Label htmlFor="record_customer">Customer</Label>
              <div className="mt-1.5">
                <CustomerCombobox
                  id="record_customer"
                  value={customer}
                  onValueChange={setCustomer}
                />
              </div>
              {foundPayment?.email && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Razorpay has {foundPayment.email} on this payment.
                </p>
              )}
              {found?.fulfillable && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Matched from the order. Pick that same person so we can cross-check before
                  recording.
                </p>
              )}
              {customer && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {customer.fullName?.trim() || customer.email} has {customer.credits} prepaid
                  session{customer.credits === 1 ? "" : "s"} right now.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="record_plan">Pack</Label>
              <Select value={planId || "__none__"} onValueChange={(v) => v && setPlanId(v === "__none__" ? "" : v)}>
                <SelectTrigger id="record_plan" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No pack</SelectItem>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.session_credits} session{p.session_credits === 1 ? "" : "s"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox
                checked={grantCredits}
                onCheckedChange={(v) => setGrantCredits(v === true)}
              />
              Release the pack&apos;s prepaid sessions now
              <FieldHint>
                Leave this off if you have already added the sessions by hand. A refund later will
                not be able to take them back.
              </FieldHint>
            </Label>

            {grantCredits && pack && (
              <p className="text-xs text-muted-foreground">
                {pack.session_credits} prepaid session{pack.session_credits === 1 ? "" : "s"} will be
                released.
              </p>
            )}
            {grantCredits && !pack && (
              <p className="text-xs text-[var(--myc-pill-amber-fg)]">
                Pick a pack before releasing sessions.
              </p>
            )}

            <div>
              <LabelWithHint
                htmlFor="record_note"
                hint="Why this is being entered by hand. It is stored on the payment and in the audit log, and it is where a promo applied out of band belongs."
              >
                Note
              </LabelWithHint>
              <Textarea
                id="record_note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Webhook never fired, confirmed against the Razorpay dashboard."
                rows={2}
                className="mt-1.5"
              />
            </div>
          </section>

          {duplicate && (
            <Callout tone="red">
              <span className="block font-medium">This payment is already recorded.</span>
              {/* The id we just tried is what finds the row: the payments list
                  searches razorpay_payment_id, razorpay_order_id and reference. */}
              <Link
                href={`/admin/payments?q=${encodeURIComponent(razorpayId.trim() || reference.trim())}`}
                className="mt-1 inline-block underline underline-offset-2"
                onClick={close}
              >
                Open it
              </Link>
            </Callout>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : effectiveAmount != null ? (
              credits > 0 ? (
                `Record ${safeMoney(effectiveAmount, effectiveCurrency)} and release ${credits} session${
                  credits === 1 ? "" : "s"
                }`
              ) : (
                `Record ${safeMoney(effectiveAmount, effectiveCurrency)}`
              )
            ) : (
              "Record payment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The four coloured blocks the lookup drives. Text only, no raw server strings. */
function Callout({
  tone,
  children,
}: {
  tone: "red" | "amber" | "blue" | "green";
  children: React.ReactNode;
}) {
  const TONE = {
    red: "border-destructive/40 bg-destructive/10 text-destructive",
    // The pill utility already pairs the amber background with its own
    // foreground in both themes, so the block does not need its own tokens.
    amber: "myc-pill-amber border-transparent",
    blue: "border-border bg-foreground/5 text-muted-foreground",
    green: "border-primary/40 bg-primary/10 text-foreground",
  } as const;
  const Icon = tone === "green" ? CheckCircle2 : tone === "blue" ? Info : AlertTriangle;
  return (
    <div className={`flex gap-2 border px-3 py-2.5 text-sm ${TONE[tone]}`}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
