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
import { formatAud } from "@/lib/i18n/money";
import { toast } from "sonner";
import type { Plan, PlanFeature, BillingInterval } from "@/lib/supabase/types";

type PlanWithFeatures = Plan & { features: PlanFeature[] };

type FeatureDraft = { id?: string; feature_text: string; is_included: boolean };

type Draft = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  price_aud_cents: number;
  billing_interval: BillingInterval;
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
  price_aud_cents: 4900,
  billing_interval: "monthly",
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
  const [syncing, setSyncing] = useState<string | null>(null);
  const [resyncing, setResyncing] = useState<string | null>(null);

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
      price_aud_cents: p.price_aud_cents,
      billing_interval: p.billing_interval,
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
    if (draft.price_aud_cents < 0) {
      toast.error("Price can't be negative.");
      return;
    }
    setSaving(true);

    const planPayload = {
      slug: draft.slug,
      name: draft.name,
      description: draft.description || null,
      price_aud_cents: draft.price_aud_cents,
      billing_interval: draft.billing_interval,
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

  async function syncToPaypal(planId: string) {
    setSyncing(planId);
    try {
      const res = await fetch("/api/paypal/sync-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        paypalPlanId?: string;
        error?: string;
      };
      if (!res.ok || !body.paypalPlanId) {
        toast.error(
          body.error === "paypal_product_failed" || body.error === "paypal_plan_failed"
            ? "PayPal rejected the sync. Check the price and try again."
            : `Sync failed: ${body.error ?? "unknown"}`
        );
        return;
      }
      toast.success(`Synced. PayPal plan ID: ${body.paypalPlanId}`);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setSyncing(null);
    }
  }

  async function resyncToPaypal(planId: string) {
    setResyncing(planId);
    try {
      // Clear the existing paypal_plan_id so the sync endpoint creates a fresh one.
      const { error: clearErr } = await supabase
        .from("plans")
        .update({ paypal_plan_id: null })
        .eq("id", planId);
      if (clearErr) {
        toast.error(`Couldn't clear PayPal plan ID: ${clearErr.message}`);
        return;
      }
      await syncToPaypal(planId);
    } finally {
      setResyncing(null);
    }
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
              {formatAud(p.price_aud_cents)}
              <span className="text-sm text-muted-foreground">/{p.billing_interval}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground break-all">
              PayPal: {p.paypal_plan_id ?? "— (not synced)"}
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
              {p.paypal_plan_id ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => resyncToPaypal(p.id)}
                  disabled={resyncing === p.id || syncing === p.id}
                  title="Clear the stored PayPal plan ID and create a new one (needed after price changes)"
                >
                  {resyncing === p.id || syncing === p.id ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1" />
                      Re-syncing…
                    </>
                  ) : (
                    "Re-sync PayPal"
                  )}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => syncToPaypal(p.id)}
                  disabled={syncing === p.id}
                >
                  {syncing === p.id ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1" />
                      Syncing…
                    </>
                  ) : (
                    "Sync to PayPal"
                  )}
                </Button>
              )}
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
                ? "Update the plan details. Run 'Sync to PayPal' after price changes — PayPal plans are immutable, so you'll need to create a new PayPal plan to apply new pricing to new subscribers."
                : "Create a new subscription plan. After saving, click 'Sync to PayPal' to register it for billing."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelWithHint
                  htmlFor="slug"
                  hint="Stable identifier passed to /api/paypal/create-subscription. Don't change after launch."
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelWithHint
                  htmlFor="price"
                  hint="Recurring price in AUD per billing cycle. Stored as integer cents. PayPal plans are immutable — bumping the price creates a new PayPal plan on Sync."
                >
                  Price (AUD)
                </LabelWithHint>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={(draft.price_aud_cents / 100).toFixed(2)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      price_aud_cents: Math.round((Number(e.target.value) || 0) * 100),
                    })
                  }
                  className="mt-1.5"
                />
              </div>
              <div>
                <LabelWithHint hint="How often customers are billed. Quarterly = every 3 months. Yearly = once a year.">
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
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
