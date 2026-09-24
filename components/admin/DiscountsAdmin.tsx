"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldHint, LabelWithHint } from "@/components/ui/field-hint";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { SUPPORTED_CURRENCIES } from "@/lib/geo/region";
import {
  DEFAULT_CUSTOMER_TZ,
  dayInIst,
  formatInTz,
  istDayEnd,
  istDayStart,
} from "@/lib/timezone";
import type { DiscountCode, DiscountType, Plan } from "@/lib/supabase/types";
import { AdminPageHeader } from "@/components/admin/AdminPage";

type Draft = {
  id?: string;
  code: string;
  discount_type: DiscountType;
  // Value as displayed: percent (0-100) or a fixed amount in major units (decimals)
  discount_value_display: string;
  applies_to_all: boolean;
  applies_to_plan_ids: string[];
  max_uses: string;
  per_email_max: string;
  currency: string; // "" = any; else one of SUPPORTED_CURRENCIES
  valid_from: string;
  valid_until: string;
  is_active: boolean;
};

/**
 * Validity dates are IST calendar days, the zone the studio runs on. They
 * used to be written as the admin's local midnight but read back with
 * `.slice(0, 10)`, the UTC date, so IST midnight (18:30Z the day before) came
 * back a day early and every re-save moved `valid_from` back another day.
 */
function istDateInput(at: string | Date): string {
  return formatInTz(at, DEFAULT_CUSTOMER_TZ, "yyyy-MM-dd");
}

const EMPTY: Draft = {
  code: "",
  discount_type: "percentage",
  discount_value_display: "10",
  applies_to_all: true,
  applies_to_plan_ids: [],
  max_uses: "",
  per_email_max: "",
  currency: "",
  valid_from: "", // today in IST, filled in when the dialog opens
  valid_until: "",
  is_active: true,
};

function toDraft(c: DiscountCode): Draft {
  return {
    id: c.id,
    code: c.code,
    discount_type: c.discount_type,
    discount_value_display:
      c.discount_type === "percentage"
        ? String(c.discount_value)
        : (c.discount_value / 100).toFixed(2),
    applies_to_all: c.applies_to_plan_ids === null || c.applies_to_plan_ids.length === 0,
    applies_to_plan_ids: c.applies_to_plan_ids ?? [],
    max_uses: c.max_uses === null ? "" : String(c.max_uses),
    per_email_max: c.per_email_max === null ? "" : String(c.per_email_max),
    currency: c.currency ?? "",
    valid_from: istDateInput(c.valid_from),
    valid_until: c.valid_until ? istDateInput(c.valid_until) : "",
    is_active: c.is_active,
  };
}

function renderValue(c: DiscountCode) {
  return c.discount_type === "percentage"
    ? `${c.discount_value}% off`
    : `${(c.discount_value / 100).toFixed(2)} off`;
}

export function DiscountsAdmin({
  discounts,
  plans,
}: {
  discounts: DiscountCode[];
  plans: Pick<Plan, "id" | "name">[];
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setDraft({ ...EMPTY, valid_from: istDateInput(new Date()) });
    setOpen(true);
  }
  function openEdit(c: DiscountCode) {
    setDraft(toDraft(c));
    setOpen(true);
  }

  async function save() {
    if (!draft.code) {
      toast.error("Code is required.");
      return;
    }
    const valueNum = Number(draft.discount_value_display);
    if (!Number.isFinite(valueNum) || valueNum <= 0) {
      toast.error("Discount value must be a positive number.");
      return;
    }
    if (draft.discount_type === "percentage" && valueNum > 100) {
      toast.error("Percentage can't exceed 100.");
      return;
    }
    if (draft.per_email_max !== "") {
      const pem = Number(draft.per_email_max);
      if (!Number.isInteger(pem) || pem <= 0) {
        toast.error("Max uses per email must be a positive whole number.");
        return;
      }
    }
    if (!draft.valid_from) {
      toast.error("Valid from date is required.");
      return;
    }

    const payload = {
      code: draft.code.toUpperCase().trim(),
      discount_type: draft.discount_type,
      discount_value:
        draft.discount_type === "percentage" ? Math.round(valueNum) : Math.round(valueNum * 100),
      applies_to_plan_ids: draft.applies_to_all ? null : draft.applies_to_plan_ids,
      max_uses: draft.max_uses === "" ? null : Number(draft.max_uses),
      per_email_max: draft.per_email_max === "" ? null : Number(draft.per_email_max),
      currency: draft.currency === "" ? null : draft.currency,
      // Whole IST days, whatever zone the admin's browser is in. The backend
      // compares instants (valid_from <= now() < valid_until), so "until 1 Oct"
      // means through the end of 1 Oct IST, which is the day the table shows.
      valid_from: istDayStart(draft.valid_from).toISOString(),
      valid_until: draft.valid_until ? istDayEnd(draft.valid_until).toISOString() : null,
      is_active: draft.is_active,
    };

    setSaving(true);
    const { error } = draft.id
      ? await supabase.from("discount_codes").update(payload).eq("id", draft.id)
      : await supabase.from("discount_codes").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(draft.id ? "Code updated." : "Code created.");
    setOpen(false);
    router.refresh();
  }

  function togglePlan(planId: string) {
    setDraft((d) => ({
      ...d,
      applies_to_plan_ids: d.applies_to_plan_ids.includes(planId)
        ? d.applies_to_plan_ids.filter((id) => id !== planId)
        : [...d.applies_to_plan_ids, planId],
    }));
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalog"
        title="Discount codes"
        sub="Codes customers can apply at checkout, with per-email and total caps."
        className="mb-7"
        actions={
          <Button onClick={openAdd}>
            <Plus className="size-4 mr-1" />
            New code
          </Button>
        }
      />

      {discounts.length === 0 ? (
        <div className="border border-dashed border-border bg-foreground/3 p-12 text-center text-muted-foreground">
          No discount codes yet. Click <b>New code</b> to create one.
        </div>
      ) : (
        <div className="myc-glass overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">Code</th>
                <th className="bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">Discount</th>
                <th className="bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">Uses</th>
                <th className="bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">Valid until</th>
                <th className="bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">Status</th>
                <th className="bg-foreground/4 px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((c) => (
                <tr key={c.id} className="border-t border-border transition-colors hover:bg-foreground/4">
                  <td className="px-4 py-3 font-mono">{c.code}</td>
                  <td className="px-4 py-3">{renderValue(c)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.times_used}
                    {c.max_uses !== null && ` / ${c.max_uses}`}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {dayInIst(c.valid_until)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={c.is_active ? "secondary" : "outline"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                      <Pencil className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit code" : "New discount code"}</DialogTitle>
            <DialogDescription>
              Codes apply at checkout when buying a session pack. The discount comes off the
              charged amount, and every redemption is recorded against the customer&apos;s email.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelWithHint
                  htmlFor="code"
                  hint="Case-insensitive code the customer types at checkout (e.g. WELCOME10). Auto-uppercased on save."
                >
                  Code
                </LabelWithHint>
                <Input
                  id="code"
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                  placeholder="WELCOME10"
                  className="mt-1.5 font-mono"
                />
              </div>
              <div>
                <LabelWithHint hint="Percentage subtracts from the plan price; Fixed subtracts a flat amount.">
                  Type
                </LabelWithHint>
                <Select
                  value={draft.discount_type}
                  onValueChange={(v) =>
                    v && setDraft({ ...draft, discount_type: v as DiscountType })
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed_amount_cents">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelWithHint
                  htmlFor="value"
                  hint={
                    draft.discount_type === "percentage"
                      ? "Percent off the purchase amount. Not yet applied to one-time checkout."
                      : "Flat amount off, in the purchase currency's major units. Not yet applied to one-time checkout."
                  }
                >
                  Value {draft.discount_type === "percentage" ? "(0-100 %)" : "(amount)"}
                </LabelWithHint>
                <Input
                  id="value"
                  type="number"
                  min={0}
                  step={draft.discount_type === "percentage" ? 1 : 0.01}
                  value={draft.discount_value_display}
                  onChange={(e) => setDraft({ ...draft, discount_value_display: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <LabelWithHint
                  htmlFor="max"
                  hint="Total redemptions allowed across all customers."
                >
                  Max uses (blank = unlimited)
                </LabelWithHint>
                <Input
                  id="max"
                  type="number"
                  min={0}
                  value={draft.max_uses}
                  onChange={(e) => setDraft({ ...draft, max_uses: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelWithHint
                  htmlFor="peremail"
                  hint="Max redemptions allowed per customer email for this code. Blank = no per-email limit."
                >
                  Max uses per email
                </LabelWithHint>
                <Input
                  id="peremail"
                  type="number"
                  min={0}
                  value={draft.per_email_max}
                  onChange={(e) => setDraft({ ...draft, per_email_max: e.target.value })}
                  placeholder="Unlimited"
                  className="mt-1.5"
                />
              </div>
              <div>
                <LabelWithHint hint="Lock a fixed-amount code to one currency so the same integer value isn't applied across currencies whose minor units differ by up to ~90x. 'Any' is fine for percentage codes, which are currency-agnostic.">
                  Currency
                </LabelWithHint>
                <Select
                  value={draft.currency || "any"}
                  onValueChange={(v) =>
                    setDraft({ ...draft, currency: v && v !== "any" ? v : "" })
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any currency</SelectItem>
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c} only
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelWithHint
                  htmlFor="from"
                  hint="First day the code works, from the start of the day in IST. Defaults to today."
                >
                  Valid from (IST)
                </LabelWithHint>
                <Input
                  id="from"
                  type="date"
                  value={draft.valid_from}
                  onChange={(e) => setDraft({ ...draft, valid_from: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <LabelWithHint
                  htmlFor="until"
                  hint="Last day the code works, up to the end of the day in IST. Leave blank for no end."
                >
                  Valid until (IST, optional)
                </LabelWithHint>
                <Input
                  id="until"
                  type="date"
                  value={draft.valid_until}
                  onChange={(e) => setDraft({ ...draft, valid_until: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <LabelWithHint
                className="mb-2"
                hint="Restrict which plans accept this code. Tick 'All active plans' to allow any."
              >
                Applies to
              </LabelWithHint>
              <Label className="flex items-center gap-2 text-sm font-normal">
                <Checkbox
                  checked={draft.applies_to_all}
                  onCheckedChange={(v) => setDraft({ ...draft, applies_to_all: v === true })}
                />
                All active plans
              </Label>
              {!draft.applies_to_all && (
                <div className="mt-2 space-y-1.5 pl-6">
                  {plans.map((p) => (
                    <Label key={p.id} className="flex items-center gap-2 text-sm font-normal">
                      <Checkbox
                        checked={draft.applies_to_plan_ids.includes(p.id)}
                        onCheckedChange={() => togglePlan(p.id)}
                      />
                      {p.name}
                    </Label>
                  ))}
                </div>
              )}
            </div>

            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox
                checked={draft.is_active}
                onCheckedChange={(v) => setDraft({ ...draft, is_active: v === true })}
              />
              Active
              <FieldHint>
                Inactive codes immediately stop working at checkout but stay around for reporting.
              </FieldHint>
            </Label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
