"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, X, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/i18n/money";
import { toast } from "sonner";
import type { Plan, PlanFeature, PlanPrice, BillingInterval } from "@/lib/supabase/types";

type PlanWithFeatures = Plan & { features: PlanFeature[]; prices: PlanPrice[] };

type FeatureDraft = { id?: string; feature_text: string; is_included: boolean };

// Helper: read a plan's price in a currency (minor units) from its price rows.
function priceFor(prices: PlanPrice[], currency: string, fallback: number): number {
  return prices.find((p) => p.currency === currency)?.amount_cents ?? fallback;
}

type Draft = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  // Per-currency prices in minor units (paise / fils). India INR, UAE AED.
  price_inr_cents: number;
  price_aed_cents: number;
  billing_interval: BillingInterval;
  session_credits: number;
  included_sessions_per_month: number | null;
  included_session_types: string;
  sort_order: number;
  is_featured: boolean;
  is_active: boolean;
  features: FeatureDraft[];
};

const EMPTY: Draft = {
  slug: "",
  name: "",
  description: "",
  price_inr_cents: 750000,
  price_aed_cents: 35000,
  billing_interval: "one_time",
  session_credits: 5,
  included_sessions_per_month: null,
  included_session_types: "",
  sort_order: 0,
  is_featured: false,
  is_active: true,
  features: [{ feature_text: "", is_included: true }],
};

export function PlansAdmin({ plans }: { plans: PlanWithFeatures[] }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setDraft({ ...EMPTY, features: [{ feature_text: "", is_included: true }] });
    setDialogOpen(true);
  }

  function openEdit(p: PlanWithFeatures) {
    setDraft({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description ?? "",
      price_inr_cents: priceFor(p.prices, "INR", p.price_base_cents),
      price_aed_cents: priceFor(p.prices, "AED", 0),
      billing_interval: p.billing_interval,
      session_credits: p.session_credits,
      included_sessions_per_month: p.included_sessions_per_month,
      included_session_types: (p.included_session_types ?? []).join(", "),
      sort_order: p.sort_order ?? 0,
      is_featured: p.is_featured,
      is_active: p.is_active,
      features: p.features.length
        ? p.features.map((f) => ({
            id: f.id,
            feature_text: f.feature_text,
            is_included: f.is_included,
          }))
        : [{ feature_text: "", is_included: true }],
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!draft.slug || !draft.name) {
      toast.error("Slug and name are required.");
      return;
    }
    if (draft.price_inr_cents < 0 || draft.price_aed_cents < 0) {
      toast.error("Prices can't be negative.");
      return;
    }
    setSaving(true);

    const planPayload = {
      slug: draft.slug,
      name: draft.name,
      description: draft.description || null,
      // Base/fallback price (used when a currency row is missing) tracks INR.
      price_base_cents: draft.price_inr_cents,
      billing_interval: draft.billing_interval,
      session_credits: draft.session_credits,
      included_sessions_per_month: draft.included_sessions_per_month,
      included_session_types: draft.included_session_types
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      sort_order: draft.sort_order,
      is_featured: draft.is_featured,
      is_active: draft.is_active,
    };

    let planId = draft.id;
    if (planId) {
      const { error } = await supabase.from("plans").update(planPayload).eq("id", planId);
      if (error) {
        setSaving(false);
        toast.error(error.message);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("plans")
        .insert(planPayload)
        .select("id")
        .single();
      if (error || !data) {
        setSaving(false);
        toast.error(error?.message ?? "Insert failed");
        return;
      }
      planId = data.id;
    }

    // Upsert per-currency prices (INR + AED) for this plan.
    const { error: priceErr } = await supabase.from("plan_prices").upsert(
      [
        { plan_id: planId!, currency: "INR", amount_cents: draft.price_inr_cents },
        { plan_id: planId!, currency: "AED", amount_cents: draft.price_aed_cents },
      ],
      { onConflict: "plan_id,currency" },
    );
    if (priceErr) {
      setSaving(false);
      toast.error(`Saved plan but prices failed: ${priceErr.message}`);
      return;
    }

    const trimmedFeatures = draft.features
      .map((f, i) => ({ ...f, feature_text: f.feature_text.trim(), sort_order: i }))
      .filter((f) => f.feature_text.length > 0);

    await supabase.from("plan_features").delete().eq("plan_id", planId);
    if (trimmedFeatures.length > 0) {
      const { error: featErr } = await supabase.from("plan_features").insert(
        trimmedFeatures.map((f) => ({
          plan_id: planId!,
          feature_text: f.feature_text,
          is_included: f.is_included,
          sort_order: f.sort_order,
        }))
      );
      if (featErr) {
        setSaving(false);
        toast.error(`Saved plan but features failed: ${featErr.message}`);
        return;
      }
    }

    setSaving(false);
    setDialogOpen(false);
    toast.success(draft.id ? "Plan updated." : "Plan created.");
    router.refresh();
  }

  function updateFeature(i: number, patch: Partial<FeatureDraft>) {
    setDraft((d) => ({
      ...d,
      features: d.features.map((f, idx) => (idx === i ? { ...f, ...patch } : f)),
    }));
  }
  function addFeature() {
    setDraft((d) => ({
      ...d,
      features: [...d.features, { feature_text: "", is_included: true }],
    }));
  }
  function removeFeature(i: number) {
    setDraft((d) => ({ ...d, features: d.features.filter((_, idx) => idx !== i) }));
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
          Plans
        </h1>
        <Button className="rounded-full" onClick={openAdd}>
          <Plus className="size-4 mr-1" />
          Add plan
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {plans.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-medium text-lg">{p.name}</h2>
                <div className="text-xs text-muted-foreground">/{p.slug}</div>
              </div>
              <div className="flex gap-1.5">
                {p.is_featured && <Badge variant="secondary">Featured</Badge>}
                {!p.is_active && <Badge variant="outline">Hidden</Badge>}
              </div>
            </div>
            <div className="mt-3 text-2xl font-[family-name:var(--font-heading)]">
              {formatMoney(priceFor(p.prices, "INR", p.price_base_cents), "INR")}
              <span className="text-base text-muted-foreground">
                {" · "}
                {formatMoney(priceFor(p.prices, "AED", 0), "AED")}
              </span>
              <span className="text-sm text-muted-foreground">
                {p.billing_interval === "one_time"
                  ? ` · ${p.session_credits} credit${p.session_credits === 1 ? "" : "s"}`
                  : `/${p.billing_interval}`}
              </span>
            </div>
            <ul className="mt-5 space-y-1.5 text-sm">
              {p.features?.map((f) => (
                <li key={f.id} className="flex gap-2 items-start">
                  {f.is_included ? (
                    <Check className="size-3.5 mt-1 text-primary" />
                  ) : (
                    <X className="size-3.5 mt-1 text-muted-foreground" />
                  )}
                  <span>{f.feature_text}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(p)}>
                Edit
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit plan" : "Add plan"}</DialogTitle>
            <DialogDescription>
              {draft.id
                ? "Update the pack details. Changes apply to new purchases immediately."
                : "Create a new session pack — set its price and how many session-credits a purchase grants."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelWithHint
                  htmlFor="slug"
                  hint="Stable identifier used at checkout to resolve this pack's price. Don't change after launch."
                >
                  Slug
                </LabelWithHint>
                <Input
                  id="slug"
                  value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                  placeholder="unlimited"
                  className="mt-1.5"
                />
              </div>
              <div>
                <LabelWithHint
                  htmlFor="name"
                  hint="Customer-facing plan name shown on /pricing and on the dashboard."
                >
                  Display name
                </LabelWithHint>
                <Input
                  id="name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Unlimited"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <LabelWithHint
                htmlFor="description"
                hint="One-line pitch under the plan name on pricing cards."
              >
                Description
              </LabelWithHint>
              <Textarea
                id="description"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={2}
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <LabelWithHint
                  htmlFor="price_inr"
                  hint="One-time price for India customers, in ₹ (INR). Stored as integer paise."
                >
                  Price (INR ₹)
                </LabelWithHint>
                <Input
                  id="price_inr"
                  type="number"
                  min={0}
                  step={0.01}
                  value={(draft.price_inr_cents / 100).toFixed(2)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      price_inr_cents: Math.round((Number(e.target.value) || 0) * 100),
                    })
                  }
                  className="mt-1.5"
                />
              </div>
              <div>
                <LabelWithHint
                  htmlFor="price_aed"
                  hint="One-time price for UAE customers, in AED. Stored as integer fils."
                >
                  Price (AED)
                </LabelWithHint>
                <Input
                  id="price_aed"
                  type="number"
                  min={0}
                  step={0.01}
                  value={(draft.price_aed_cents / 100).toFixed(2)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      price_aed_cents: Math.round((Number(e.target.value) || 0) * 100),
                    })
                  }
                  className="mt-1.5"
                />
              </div>
              <div>
                <LabelWithHint hint="Session packs are a one-time purchase. The recurring options are legacy and only apply to old subscription plans.">
                  Billing interval
                </LabelWithHint>
                <Select
                  value={draft.billing_interval}
                  onValueChange={(v) =>
                    v && setDraft({ ...draft, billing_interval: v as BillingInterval })
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-time (pack)</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <LabelWithHint
                htmlFor="session_credits"
                hint="How many session-credits a customer receives when they buy this pack. Each paid booking spends one credit."
              >
                Session credits (per purchase)
              </LabelWithHint>
              <Input
                id="session_credits"
                type="number"
                min={0}
                value={draft.session_credits}
                onChange={(e) =>
                  setDraft({ ...draft, session_credits: Math.max(0, Number(e.target.value) || 0) })
                }
                className="mt-1.5"
              />
            </div>

            <div>
              <LabelWithHint
                htmlFor="sessions"
                hint="Cap on bookings the plan allows per month. Leave blank for unlimited (e.g. group-class plans)."
              >
                Included sessions / month
              </LabelWithHint>
              <Input
                id="sessions"
                type="number"
                min={0}
                value={draft.included_sessions_per_month ?? ""}
                placeholder="Leave blank for unlimited"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    included_sessions_per_month: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelWithHint
                  htmlFor="session_types"
                  hint="Comma-separated class-category slugs this plan covers. Leave blank to include all types."
                >
                  Included session types (slugs)
                </LabelWithHint>
                <Input
                  id="session_types"
                  value={draft.included_session_types}
                  onChange={(e) => setDraft({ ...draft, included_session_types: e.target.value })}
                  placeholder="hatha, yin, restorative"
                  className="mt-1.5"
                />
              </div>
              <div>
                <LabelWithHint
                  htmlFor="plan_sort"
                  hint="Lower numbers appear first on /pricing. Default 0."
                >
                  Sort order
                </LabelWithHint>
                <Input
                  id="plan_sort"
                  type="number"
                  value={draft.sort_order}
                  onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="flex gap-6">
              <Label className="flex items-center gap-2 text-sm font-normal">
                <Checkbox
                  checked={draft.is_featured}
                  onCheckedChange={(v) => setDraft({ ...draft, is_featured: v === true })}
                />
                Featured plan
                <FieldHint>
                  Pins this plan in the middle of /pricing with a &quot;Most popular&quot; badge and
                  primary-coloured CTA.
                </FieldHint>
              </Label>
              <Label className="flex items-center gap-2 text-sm font-normal">
                <Checkbox
                  checked={draft.is_active}
                  onCheckedChange={(v) => setDraft({ ...draft, is_active: v === true })}
                />
                Visible to customers
                <FieldHint>
                  Hide the plan from /pricing without deleting it. Existing subscribers keep
                  billing as normal.
                </FieldHint>
              </Label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <LabelWithHint hint="Bullet list shown on the pricing card. Uncheck a row to render it struck-through (e.g. excluded features).">
                  Features
                </LabelWithHint>
                <Button type="button" size="sm" variant="outline" onClick={addFeature}>
                  <Plus className="size-3.5 mr-1" />
                  Add row
                </Button>
              </div>
              <div className="space-y-2">
                {draft.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Checkbox
                      checked={f.is_included}
                      onCheckedChange={(v) => updateFeature(i, { is_included: v === true })}
                    />
                    <Input
                      value={f.feature_text}
                      onChange={(e) => updateFeature(i, { feature_text: e.target.value })}
                      placeholder="Feature text"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeFeature(i)}
                      aria-label="Remove feature"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Uncheck a row to render it as struck-through (e.g. &ldquo;1:1 private sessions&rdquo; on a basic plan).
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
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
