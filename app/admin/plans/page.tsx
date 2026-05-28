import { Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/guards";
import { getPlansWithFeatures } from "@/lib/data/landing";
import { formatAud } from "@/lib/i18n/money";

export default async function AdminPlansPage() {
  await requireAdmin();
  const plans = await getPlansWithFeatures();
  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
          Plans
        </h1>
        <Button className="rounded-full">
          <Plus className="size-4 mr-1" />
          Add plan
        </Button>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {plans.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between">
              <h2 className="font-medium text-lg">{p.name}</h2>
              {p.is_featured && <Badge variant="secondary">Featured</Badge>}
            </div>
            <div className="mt-3 text-2xl font-[family-name:var(--font-heading)]">
              {formatAud(p.price_aud_cents)}<span className="text-sm text-muted-foreground">/mo</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              PayPal plan ID: {p.paypal_plan_id ?? "— (not synced)"}
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
            <div className="mt-5 flex gap-2">
              <Button size="sm" variant="outline" className="rounded-full">Edit</Button>
              <Button size="sm" variant="outline" className="rounded-full">
                Sync to PayPal
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
