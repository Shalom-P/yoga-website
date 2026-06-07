"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Video, Ban, PlayCircle, CheckCircle2, Link2 } from "lucide-react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCustomerTime } from "@/lib/timezone";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SessionRow = {
  id: string;
  start_at: string;
  end_at: string;
  capacity: number;
  status: "scheduled" | "live" | "completed" | "cancelled";
  is_free_trial: boolean;
  meet_link: string | null;
  meet_status: "pending" | "created" | "failed" | null;
  recording_url: string | null;
  teacher: { id: string; display_name: string } | null;
  category: { id: string; name: string } | null;
};

type Teacher = { id: string; display_name: string };
type Category = { id: string; name: string };

type Draft = {
  teacherId: string;
  classCategoryId: string;
  startAtLocal: string;
  durationMinutes: number;
  capacity: number;
  isFreeTrial: boolean;
  notes: string;
};

const EMPTY: Draft = {
  teacherId: "",
  classCategoryId: "",
  startAtLocal: "",
  durationMinutes: 60,
  capacity: 1,
  isFreeTrial: false,
  notes: "",
};

export function SessionsAdmin({
  sessions,
  teachers,
  categories,
  showPast,
}: {
  sessions: SessionRow[];
  teachers: Teacher[];
  categories: Category[];
  showPast: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [recordingSession, setRecordingSession] = useState<SessionRow | null>(null);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingSaving, setRecordingSaving] = useState(false);
  const supabase = createSupabaseBrowserClient();

  function handleOpenChange(next: boolean) {
    if (!next) setDraft(EMPTY);
    setOpen(next);
  }

  async function save() {
    if (!draft.teacherId) {
      toast.error("Pick a teacher.");
      return;
    }
    if (!draft.startAtLocal) {
      toast.error("Pick a start time.");
      return;
    }
    const startIso = new Date(draft.startAtLocal).toISOString();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teacherId: draft.teacherId,
          classCategoryId: draft.classCategoryId || null,
          startAt: startIso,
          durationMinutes: draft.durationMinutes,
          capacity: draft.capacity,
          isFreeTrial: draft.isFreeTrial,
          notes: draft.notes || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(
          body.error === "slot_taken"
            ? "That teacher already has a session at this time."
            : `Couldn't schedule: ${body.error ?? "unknown"}`
        );
        return;
      }
      toast.success("Session scheduled. Meet link will appear shortly.");
      handleOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelSession(id: string) {
    setCancelling(id);
    try {
      // Goes through DELETE /api/admin/sessions so bookings are cancelled and
      // the Meet event is removed — a direct sessions.update would leave both
      // dangling.
      const res = await fetch("/api/admin/sessions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(`Couldn't cancel: ${body.error ?? "unknown"}`);
        return;
      }
      toast.success("Session cancelled. Customers' bookings updated.");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setCancelling(null);
    }
  }

  async function transitionStatus(id: string, status: "live" | "completed") {
    setTransitioning(id);
    const { error } = await supabase
      .from("sessions")
      .update({ status })
      .eq("id", id);
    setTransitioning(null);
    if (error) return toast.error(error.message);
    toast.success(`Session marked as ${status}.`);
    router.refresh();
  }

  function openRecordingDialog(s: SessionRow) {
    setRecordingSession(s);
    setRecordingUrl(s.recording_url ?? "");
  }

  async function saveRecordingUrl() {
    if (!recordingSession) return;
    setRecordingSaving(true);
    const { error } = await supabase
      .from("sessions")
      .update({ recording_url: recordingUrl || null })
      .eq("id", recordingSession.id);
    setRecordingSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Recording URL saved.");
    setRecordingSession(null);
    router.refresh();
  }

  function toggleShowPast() {
    router.push(showPast ? "/admin/sessions" : "/admin/sessions?past=1");
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
            Sessions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Schedule classes — Meet links are auto-created.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full" onClick={toggleShowPast}>
            {showPast ? "Show upcoming" : "Show past sessions"}
          </Button>
          <Button className="rounded-full" onClick={() => setOpen(true)}>
            <Plus className="size-4 mr-1" />
            Schedule session
          </Button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          No sessions yet. Click <b>Schedule session</b> to create one.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Start</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Teacher</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Class</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Capacity</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Meet</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatCustomerTime(s.start_at)}
                  </td>
                  <td className="px-4 py-3">{s.teacher?.display_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.category?.name ?? "1:1"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.capacity}</td>
                  <td className="px-4 py-3">
                    {s.meet_link ? (
                      <a
                        href={s.meet_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <Video className="size-3.5" />
                        Join
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {s.meet_status === "failed" ? "failed (retry)" : "pending"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        s.status === "scheduled"
                          ? "secondary"
                          : s.status === "live"
                          ? "default"
                          : "outline"
                      }
                    >
                      {s.status}
                      {s.is_free_trial && " · trial"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {s.status === "scheduled" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => transitionStatus(s.id, "live")}
                            disabled={transitioning === s.id}
                            title="Mark as live"
                          >
                            <PlayCircle className="size-3.5 mr-1" />
                            {transitioning === s.id ? "…" : "Go live"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancelSession(s.id)}
                            disabled={cancelling === s.id}
                          >
                            <Ban className="size-3.5 mr-1" />
                            {cancelling === s.id ? "…" : "Cancel"}
                          </Button>
                        </>
                      )}
                      {s.status === "live" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => transitionStatus(s.id, "completed")}
                          disabled={transitioning === s.id}
                          title="Mark as completed"
                        >
                          <CheckCircle2 className="size-3.5 mr-1" />
                          {transitioning === s.id ? "…" : "Complete"}
                        </Button>
                      )}
                      {(s.status === "completed" || new Date(s.end_at) < new Date()) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openRecordingDialog(s)}
                          title={s.recording_url ? "Edit recording URL" : "Add recording URL"}
                        >
                          <Link2 className="size-3.5 mr-1" />
                          {s.recording_url ? "Recording" : "Add recording"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recording URL dialog */}
      <Dialog open={recordingSession !== null} onOpenChange={(o) => !o && setRecordingSession(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recording URL</DialogTitle>
            <DialogDescription>
              Paste the recording link (Google Drive, Vimeo, etc.). Customers with a booking can see this from their dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rec_url">URL</Label>
            <Input
              id="rec_url"
              value={recordingUrl}
              onChange={(e) => setRecordingUrl(e.target.value)}
              placeholder="https://drive.google.com/…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordingSession(null)} disabled={recordingSaving}>
              Cancel
            </Button>
            <Button onClick={saveRecordingUrl} disabled={recordingSaving}>
              {recordingSaving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule session</DialogTitle>
            <DialogDescription>
              Time is interpreted in your browser timezone, stored as UTC, and shown to each customer in their own timezone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <LabelWithHint hint="Teacher who'll run the class. Overlap-checked against their existing sessions on save.">
                Teacher
              </LabelWithHint>
              <Select
                value={draft.teacherId}
                onValueChange={(v) => v && setDraft({ ...draft, teacherId: v })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Pick a teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <LabelWithHint hint="Pick a class category for group sessions, or leave as '1:1 private' for one-on-one bookings.">
                Class category (optional)
              </LabelWithHint>
              <Select
                value={draft.classCategoryId || "__none__"}
                onValueChange={(v) =>
                  setDraft({ ...draft, classCategoryId: v && v !== "__none__" ? v : "" })
                }
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="1:1 private session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">1:1 private session</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <LabelWithHint
                htmlFor="start"
                hint="Entered in your browser's timezone, stored as UTC, displayed to each customer in their own timezone."
              >
                Start (your local time)
              </LabelWithHint>
              <Input
                id="start"
                type="datetime-local"
                value={draft.startAtLocal}
                onChange={(e) => setDraft({ ...draft, startAtLocal: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelWithHint
                  htmlFor="dur"
                  hint="Class length in minutes. Used for the Meet event end time and the teacher-overlap check."
                >
                  Duration (minutes)
                </LabelWithHint>
                <Input
                  id="dur"
                  type="number"
                  min={15}
                  max={240}
                  step={15}
                  value={draft.durationMinutes}
                  onChange={(e) =>
                    setDraft({ ...draft, durationMinutes: Number(e.target.value) || 60 })
                  }
                  className="mt-1.5"
                />
              </div>
              <div>
                <LabelWithHint
                  htmlFor="cap"
                  hint="Max attendees. 1 = private 1:1. Anything above 1 turns it into a group class."
                >
                  Capacity
                </LabelWithHint>
                <Input
                  id="cap"
                  type="number"
                  min={1}
                  max={50}
                  value={draft.capacity}
                  onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) || 1 })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <LabelWithHint
                htmlFor="notes"
                hint="Internal note attached to the session. Not shown to customers."
              >
                Notes (optional)
              </LabelWithHint>
              <Textarea
                id="notes"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={2}
                className="mt-1.5"
                placeholder="e.g. Bring a bolster"
              />
            </div>

            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox
                checked={draft.isFreeTrial}
                onCheckedChange={(v) => setDraft({ ...draft, isFreeTrial: v === true })}
              />
              Mark as free-trial slot
              <FieldHint>
                Free-trial bookings are subject to the &quot;one free 1:1 per customer&quot; rule —
                a customer can only claim one across their lifetime.
              </FieldHint>
            </Label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
