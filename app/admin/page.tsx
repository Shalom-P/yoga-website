import { Users, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { formatAud } from "@/lib/i18n/money";

export default async function AdminDashboard() {
  const { supabase } = await requireAdmin();
  const { data: kpis } = await supabase.rpc("admin_kpis");
  const k = kpis ?? {
    signups_today: 0, trials_today: 0, paid_active_subs: 0, mrr_aud_cents: 0,
  };

  const tiles = [
    { icon: Users,      label: "Signups today",   value: k.signups_today.toLocaleString() },
    { icon: Sparkles,   label: "Trials booked today", value: k.trials_today.toLocaleString() },
    { icon: TrendingUp, label: "Active subs",     value: k.paid_active_subs.toLocaleString() },
    { icon: Wallet,     label: "MRR",             value: formatAud(k.mrr_aud_cents) },
  ];

  return (
    <div className="p-8 max-w-7xl">
      <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight mb-6">
        Overview
      </h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <Icon className="size-5 text-primary mb-3" />
            <div className="text-3xl font-[family-name:var(--font-heading)]">{value}</div>
            <div className="text-sm text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-medium mb-3">Today&apos;s sessions</h2>
          <p className="text-sm text-muted-foreground">
            Hook this up to the <code>sessions</code> table to list today&apos;s
            scheduled classes and join links.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-medium mb-3">Recent activity</h2>
          <p className="text-sm text-muted-foreground">
            Reads from <code>audit_log</code>. Admin actions, signups, subscriptions, and payments.
          </p>
        </div>
      </div>
    </div>
  );
}
