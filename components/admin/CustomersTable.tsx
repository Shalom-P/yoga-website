"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
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

type Row = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  timezone: string;
  role: "customer" | "admin";
  created_at: string;
  experience_level: "beginner" | "intermediate" | "advanced" | null;
  goals: string[] | null;
  referral_source: string | null;
  marketing_opt_in: boolean;
};

export function CustomersTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [target, setTarget] = useState<Row | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [demoteTarget, setDemoteTarget] = useState<Row | null>(null);
  const [demoting, setDemoting] = useState(false);

  async function promote() {
    if (!target) return;
    setPromoting(true);
    const { error } = await supabase.rpc("promote_to_admin", { target_user_id: target.id });
    setPromoting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${target.full_name ?? target.email} is now an admin.`);
    setTarget(null);
    router.refresh();
  }

  async function demote() {
    if (!demoteTarget) return;
    setDemoting(true);
    const { error } = await supabase.rpc("demote_from_admin", {
      target_user_id: demoteTarget.id,
    });
    setDemoting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${demoteTarget.full_name ?? demoteTarget.email} demoted to customer.`);
    setDemoteTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Timezone</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Level</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Goals</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Referral</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mktg</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-3">{c.full_name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.timezone}</td>
                <td className="px-4 py-3 text-muted-foreground capitalize">
                  {c.experience_level ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate" title={(c.goals ?? []).join(", ") || undefined}>
                  {(c.goals ?? []).join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.referral_source ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.marketing_opt_in ? "Yes" : "No"}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      c.role === "admin"
                        ? "text-primary font-medium inline-flex items-center gap-1"
                        : "text-muted-foreground"
                    }
                  >
                    {c.role === "admin" && <ShieldCheck className="size-3.5" />}
                    {c.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("en-AU")}
                </td>
                <td className="px-4 py-3 text-right">
                  {c.role !== "admin" ? (
                    <Button size="sm" variant="ghost" onClick={() => setTarget(c)}>
                      Promote to admin
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDemoteTarget(c)}
                    >
                      <ShieldOff className="size-3.5 mr-1" />
                      Demote
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center px-4 py-12 text-muted-foreground">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote to admin?</DialogTitle>
            <DialogDescription>
              {target?.full_name ?? target?.email} will get full access to the admin shell. You can
              demote them later from this same table.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={promoting}>
              Cancel
            </Button>
            <Button onClick={promote} disabled={promoting}>
              {promoting ? "Promoting…" : "Promote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={demoteTarget !== null} onOpenChange={(o) => !o && setDemoteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demote from admin?</DialogTitle>
            <DialogDescription>
              {demoteTarget?.full_name ?? demoteTarget?.email} will lose admin access and revert to
              the customer role. Their bookings and data are unaffected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDemoteTarget(null)} disabled={demoting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={demote}
              disabled={demoting}
            >
              {demoting ? "Demoting…" : "Demote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
