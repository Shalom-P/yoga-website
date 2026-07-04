"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Ban, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

export type SlotOverrideRow = {
  id: string;
  teacher_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_blocked: boolean;
  reason: string | null;
  created_at: string;
};

type Props = {
  teacherId: string;
  teacherTimezone: string;
  initial: SlotOverrideRow[];
};

type FormState = {
  date: string;
  start_time: string;
  end_time: string;
  is_blocked: boolean;
  reason: string;
};

const EMPTY_FORM: FormState = {
  date: "",
  start_time: "",
  end_time: "",
  is_blocked: false,
  reason: "",
};

export function SlotOverrides({ teacherId, teacherTimezone, initial }: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [rows, setRows] = useState<SlotOverrideRow[]>(initial);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  async function handleAdd() {
    if (!form.date) {
      toast.error("Date is required.");
      return;
    }
    if (!form.is_blocked && (!form.start_time || !form.end_time)) {
      toast.error("Start and end time are required for extra windows.");
      return;
    }
    if (!form.is_blocked && form.start_time >= form.end_time) {
      toast.error("End time must be after start time.");
      return;
    }

    setSaving(true);
    const payload: {
      teacher_id: string;
      date: string;
      start_time: string | null;
      end_time: string | null;
      is_blocked: boolean;
      reason: string | null;
    } = {
      teacher_id: teacherId,
      date: form.date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      is_blocked: form.is_blocked,
      reason: form.reason || null,
    };

    const { data, error } = await supabase
      .from("teacher_slot_overrides")
      .insert(payload)
      .select("*")
      .single();

    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Insert failed.");
      return;
    }
    toast.success(form.is_blocked ? "Date blocked." : "Extra window added.");
    setRows((prev) => [data as SlotOverrideRow, ...prev]);
    resetForm();
    setAddOpen(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const { error } = await supabase
      .from("teacher_slot_overrides")
      .delete()
      .eq("id", id);
    setDeletingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Override removed.");
    setRows((prev) => prev.filter((r) => r.id !== id));
    router.refresh();
  }

  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-[family-name:var(--font-heading)] tracking-tight">
            Date overrides
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Block specific dates or add one-off availability windows. Times in {teacherTimezone}.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5 mr-1" />
          Add override
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          No overrides yet. Use &quot;Add override&quot; to block a date or add an extra window.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Window</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reason</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium tabular-nums">{r.date}</td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {r.start_time && r.end_time
                      ? `${r.start_time.slice(0, 5)} – ${r.end_time.slice(0, 5)}`
                      : <span className="italic text-xs">All day</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.is_blocked ? (
                      <Badge variant="destructive" className="text-xs gap-1">
                        <Ban className="size-3" />
                        Blocked
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <CalendarPlus className="size-3" />
                        Extra window
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.reason ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={deletingId === r.id}
                      onClick={() => handleDelete(r.id)}
                    >
                      {deletingId === r.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) resetForm(); setAddOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add date override</DialogTitle>
            <DialogDescription>
              Block a date entirely, or define an extra availability window on a specific date.
              Times are in the teacher&apos;s local timezone ({teacherTimezone}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="override-date">Date</Label>
              <Input
                id="override-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="override-blocked"
                type="checkbox"
                className="size-4 rounded border-border"
                checked={form.is_blocked}
                onChange={(e) => setForm((f) => ({ ...f, is_blocked: e.target.checked }))}
              />
              <Label htmlFor="override-blocked" className="cursor-pointer">
                Block this date (mark as unavailable)
              </Label>
            </div>

            {!form.is_blocked && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="override-start">Start time</Label>
                  <Input
                    id="override-start"
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="override-end">End time</Label>
                  <Input
                    id="override-end"
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="override-reason">Reason (optional)</Label>
              <Input
                id="override-reason"
                placeholder="e.g. Public holiday, workshop…"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { resetForm(); setAddOpen(false); }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1" />
                  Saving…
                </>
              ) : (
                "Save override"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
