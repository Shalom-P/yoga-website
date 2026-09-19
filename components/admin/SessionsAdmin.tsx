"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  Video,
  Ban,
  PlayCircle,
  CheckCircle2,
  Link2,
  Pencil,
  Users,
  Archive,
} from "lucide-react";
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
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { SessionEditDialog, type EditableSession } from "@/components/admin/SessionEditDialog";
import {
  SessionRosterDrawer,
  type RosterEntry,
  type RosterSession,
} from "@/components/admin/SessionRosterDrawer";
import type { MoveTarget } from "@/components/admin/MoveBookingDialog";
import { friendlyAdminError } from "@/lib/ui/errors";
import type { AdminErrorBody, SessionCancelResponse } from "@/lib/admin/contracts";
import type { MeetStatus } from "@/lib/supabase/types";

export type AdminSessionRow = {
  id: string;
  start_at: string;
  end_at: string;
  capacity: number;
  status: "scheduled" | "live" | "completed" | "cancelled";
  is_free_trial: boolean;
  meet_link: string | null;
  meet_status: MeetStatus | null;
  recording_url: string | null;
  notes: string | null;
  teacher_id: string;
  class_category_id: string | null;
  teacher: { id: string; display_name: string } | null;
  category: { id: string; name: string } | null;
  /** Non-cancelled bookings, counted server-side. */
  live_count: number;
};

/**
 * Which slice of the schedule the table is showing. "archived" is every session
 * whose end time has already passed - there is no archived flag on the row, the
 * clock alone decides, so a class drops out of "upcoming" the moment it ends.
 */
export type SessionView = "upcoming" | "archived" | "all";

export type SessionFilters = {
  view: SessionView;
  /** Teacher id, or "" for every teacher. */
  teacher: string;
  /** Session status, or "" for every status. */
  status: string;
};

type Teacher = { id: string; display_name: string };
type Category = { id: string; name: string; is_active: boolean };

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

const TH =
  "bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap";

export function SessionsAdmin({
  sessions,
  nowMs,
  teachers,
  categories,
  filters,
  rosterSession,
  roster,
  moveTargets,
}: {
  sessions: AdminSessionRow[];
  /**
   * Request time, resolved on the server. Passed in rather than read from a
   * fresh Date() during render so the archived/live split is identical either
   * side of hydration.
   */
  nowMs: number;
  teachers: Teacher[];
  categories: Category[];
  filters: SessionFilters;
  rosterSession: RosterSession | null;
  roster: RosterEntry[];
  moveTargets: MoveTarget[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [recordingSession, setRecordingSession] = useState<AdminSessionRow | null>(null);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingSaving, setRecordingSaving] = useState(false);
  const [editSession, setEditSession] = useState<EditableSession | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminSessionRow | null>(null);
  const [cancelRefund, setCancelRefund] = useState(true);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const supabase = createSupabaseBrowserClient();

  // Every filter lives in the URL so the roster drawer, the Prev/Next of a
  // future page and a browser refresh all land on the same view.
  function hrefWith(next: Partial<SessionFilters & { session: string }>): string {
    const merged = { ...filters, session: "", ...next };
    const params = new URLSearchParams();
    if (merged.view !== "upcoming") params.set("view", merged.view);
    if (merged.teacher) params.set("teacher", merged.teacher);
    if (merged.status) params.set("status", merged.status);
    if (merged.session) params.set("session", merged.session);
    const qs = params.toString();
    return qs ? `/admin/sessions?${qs}` : "/admin/sessions";
  }

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
      const body = (await res.json().catch(() => ({}))) as AdminErrorBody;
      if (!res.ok) {
        toast.error(friendlyAdminError(body.error));
        return;
      }
      toast.success("Session scheduled. Join link will appear shortly.");
      handleOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function openCancelDialog(s: AdminSessionRow) {
    setCancelTarget(s);
    setCancelRefund(true);
    setCancelReason("");
  }

  async function confirmCancelSession() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      // Goes through DELETE /api/admin/sessions so every booking is cancelled,
      // prepaid sessions are returned according to the choice below, and the
      // Meet event is torn down. A direct sessions.update would leave all three
      // dangling.
      const res = await fetch("/api/admin/sessions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: cancelTarget.id,
          refundCredits: cancelRefund,
          reason: cancelReason.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as
        | SessionCancelResponse
        | AdminErrorBody;
      if (!res.ok) {
        toast.error(friendlyAdminError((body as AdminErrorBody).error));
        return;
      }
      const ok = body as SessionCancelResponse;
      toast.success(
        `Class cancelled. ${ok.cancelledBookings} ${
          ok.cancelledBookings === 1 ? "student" : "students"
        } removed, ${ok.refundedBookings} prepaid ${
          ok.refundedBookings === 1 ? "session" : "sessions"
        } returned.`,
      );
      setCancelTarget(null);
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  // Status transitions and the recording URL stay direct browser writes: both
  // are single-column updates with no credit, booking or calendar side effects,
  // which is exactly where the line sits. Cancellation is on the other side of
  // it and goes through the route above.
  async function transitionStatus(id: string, status: "live" | "completed") {
    setTransitioning(id);
    const { error } = await supabase.from("sessions").update({ status }).eq("id", id);
    setTransitioning(null);
    if (error) return toast.error(friendlyAdminError("update_failed"));
    toast.success(`Session marked as ${status}.`);
    router.refresh();
  }

  function openRecordingDialog(s: AdminSessionRow) {
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
    if (error) return toast.error(friendlyAdminError("update_failed"));
    toast.success("Recording URL saved.");
    setRecordingSession(null);
    router.refresh();
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Operations"
        title="Sessions"
        sub="Schedule classes, manage who is in them, and mark attendance."
        className="mb-7"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4 mr-1" />
            Schedule session
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Select
          value={filters.view}
          onValueChange={(v) => v && router.push(hrefWith({ view: v as SessionView }))}
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="archived">
              <Archive className="size-3.5" />
              Archive (past sessions)
            </SelectItem>
            <SelectItem value="all">All sessions</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.teacher || "__all__"}
          onValueChange={(v) => v && router.push(hrefWith({ teacher: v === "__all__" ? "" : v }))}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All teachers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All teachers</SelectItem>
            {teachers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status || "__all__"}
          onValueChange={(v) => v && router.push(hrefWith({ status: v === "__all__" ? "" : v }))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sessions.length === 0 ? (
        <div className="border border-dashed border-border bg-foreground/3 p-12 text-center text-muted-foreground">
          {filters.teacher || filters.status
            ? "No sessions match the current filters."
            : filters.view === "archived"
              ? "Nothing archived yet. Sessions land here once their end time passes."
              : filters.view === "upcoming"
                ? "No upcoming sessions. Click Schedule session to create one, or switch to Archive to see past ones."
                : "No sessions yet. Click Schedule session to create one."}
        </div>
      ) : (
        <div className="myc-glass overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={TH}>Start</th>
                <th className={TH}>Teacher</th>
                <th className={TH}>Class</th>
                <th className={TH}>Students</th>
                <th className={TH}>Link</th>
                <th className={TH}>Status</th>
                <th className={TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const archived = Date.parse(s.end_at) < nowMs;
                return (
                  <tr
                    key={s.id}
                    className="border-t border-border transition-colors hover:bg-foreground/4"
                  >
                    <td
                      className={`px-4 py-3 whitespace-nowrap${
                        archived ? " text-muted-foreground" : ""
                      }`}
                    >
                      {formatCustomerTime(s.start_at)}
                    </td>
                    <td className="px-4 py-3">{s.teacher?.display_name ?? "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.category?.name ?? "1:1"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {s.live_count} / {s.capacity}
                    </td>
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
                      {/* Redundant in the Archive view, where every row is one, so
                          it only shows where the two are mixed together. */}
                      {archived && filters.view === "all" && (
                        <Badge variant="outline" className="ml-1.5">
                          archived
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(hrefWith({ session: s.id }), { scroll: false })}
                          title="Open the roster"
                        >
                          <Users className="size-3.5 mr-1" />
                          Roster ({s.live_count}/{s.capacity})
                        </Button>
                        {s.status !== "cancelled" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setEditSession({
                                id: s.id,
                                teacher_id: s.teacher_id,
                                class_category_id: s.class_category_id,
                                start_at: s.start_at,
                                end_at: s.end_at,
                                capacity: s.capacity,
                                notes: s.notes,
                                teacher_name: s.teacher?.display_name ?? null,
                              })
                            }
                          >
                            <Pencil className="size-3.5 mr-1" />
                            Edit
                          </Button>
                        )}
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
                              className="text-destructive hover:text-destructive"
                              onClick={() => openCancelDialog(s)}
                            >
                              <Ban className="size-3.5 mr-1" />
                              Cancel
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
                        {(s.status === "completed" || archived) && (
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Keyed on the session id so opening a different class REMOUNTS the
          drawer. That is what resets its add-student form, rather than an
          effect inside it that would re-render every open a second time. */}
      <SessionRosterDrawer
        key={rosterSession?.id ?? "no-session"}
        session={rosterSession}
        roster={roster}
        moveTargets={moveTargets}
        onClose={() => router.push(hrefWith({}), { scroll: false })}
      />

      {/* Keyed on the session id: remounting is what re-seeds the draft when a
          different class is opened, instead of a reset effect inside. */}
      <SessionEditDialog
        key={editSession?.id ?? "no-session"}
        session={editSession}
        teachers={teachers}
        categories={categories}
        onClose={() => setEditSession(null)}
      />

      {/* Cancel a whole class. The refund choice is explicit, defaulted on: a
          studio-side cancellation is not the student's fault, so the seat goes
          back unless somebody decides otherwise. */}
      <Dialog open={cancelTarget !== null} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cancel this class?</DialogTitle>
            <DialogDescription>
              Cancelling returns every student&apos;s prepaid session and removes the join link.
              Nobody is emailed automatically, so let them know yourself.
            </DialogDescription>
          </DialogHeader>

          <Label className="flex items-start gap-2 text-sm font-normal">
            <Checkbox
              checked={cancelRefund}
              onCheckedChange={(v) => setCancelRefund(v === true)}
              className="mt-0.5"
            />
            <span>
              Return every student&apos;s prepaid session
              <FieldHint>
                Leave this unchecked only when the sessions have already been returned another way.
                Introductory 1:1 and comped bookings never spent one, so they are unaffected.
              </FieldHint>
            </span>
          </Label>

          <div className="space-y-2">
            <Label htmlFor="cancel_session_reason">Reason (optional)</Label>
            <Textarea
              id="cancel_session_reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
              placeholder="e.g. Teacher unwell"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              Back
            </Button>
            <Button variant="destructive" onClick={confirmCancelSession} disabled={cancelling}>
              {cancelling ? <Loader2 className="size-4 animate-spin" /> : "Cancel class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recording URL dialog */}
      <Dialog
        open={recordingSession !== null}
        onOpenChange={(o) => !o && setRecordingSession(null)}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recording URL</DialogTitle>
            <DialogDescription>
              Paste the recording link (Google Drive, Vimeo, etc.). Customers with a booking can see
              this from their dashboard.
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
            <Button
              variant="outline"
              onClick={() => setRecordingSession(null)}
              disabled={recordingSaving}
            >
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
              Time is interpreted in your browser timezone, stored as UTC, and shown to each
              customer in their own timezone.
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
                  {/* A new class never goes onto one of the categories retired by
                      0023; the edit dialog still offers them so an existing
                      session can keep the one it is on. */}
                  {categories
                    .filter((c) => c.is_active)
                    .map((c) => (
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
                  hint="Class length in minutes. Used for the session end time and the teacher-overlap check."
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
                Free-trial bookings are subject to the &quot;one free 1:1 per customer&quot; rule,
                so a customer can only claim one across their lifetime.
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
