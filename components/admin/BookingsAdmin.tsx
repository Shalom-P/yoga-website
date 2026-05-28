"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCustomerTime } from "@/lib/timezone";
import { toast } from "sonner";
import type { BookingStatus } from "@/lib/supabase/types";

type Row = {
  id: string;
  status: BookingStatus;
  is_free_trial: boolean;
  created_at: string;
  customer: { id: string; full_name: string | null; email: string | null } | null;
  session: {
    id: string;
    start_at: string;
    teacher: { display_name: string } | null;
  } | null;
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  attended: "Attended",
  no_show: "No-show",
};

export function BookingsAdmin({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | BookingStatus>("all");
  const [search, setSearch] = useState("");

  const filtered = rows.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.customer?.full_name?.toLowerCase().includes(q) ||
        r.customer?.email?.toLowerCase().includes(q) ||
        r.session?.teacher?.display_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function updateStatus(id: string, status: BookingStatus) {
    setBusy(id);
    const patch: { status: BookingStatus; cancelled_at?: string } = { status };
    if (status === "cancelled") patch.cancelled_at = new Date().toISOString();
    const { error } = await supabase.from("bookings").update(patch).eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Marked as ${STATUS_LABEL[status]}.`);
    router.refresh();
  }

  return (
    <>
      <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
        Bookings
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        All upcoming and past bookings across customers.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer name / email / teacher…"
          className="max-w-sm"
        />
        <Select value={filter} onValueChange={(v) => v && setFilter(v as typeof filter)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="attended">Attended</SelectItem>
            <SelectItem value="no_show">No-show</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          {rows.length === 0 ? "No bookings yet." : "No bookings match the current filter."}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Session</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Teacher</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div>{r.customer?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.customer?.email ?? ""}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.session ? formatCustomerTime(r.session.start_at) : "—"}
                  </td>
                  <td className="px-4 py-3">{r.session?.teacher?.display_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={
                          r.status === "confirmed"
                            ? "secondary"
                            : r.status === "attended"
                            ? "default"
                            : "outline"
                        }
                      >
                        {STATUS_LABEL[r.status]}
                      </Badge>
                      {r.is_free_trial && <Badge variant="outline">trial</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "confirmed" && (
                      <div className="inline-flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateStatus(r.id, "attended")}
                          disabled={busy === r.id}
                        >
                          Mark attended
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateStatus(r.id, "no_show")}
                          disabled={busy === r.id}
                        >
                          No-show
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => updateStatus(r.id, "cancelled")}
                          disabled={busy === r.id}
                        >
                          {busy === r.id ? <Loader2 className="size-3.5 animate-spin" /> : "Cancel"}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
