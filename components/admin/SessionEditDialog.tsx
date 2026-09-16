"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LabelWithHint } from "@/components/ui/field-hint";
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
import { DEFAULT_CUSTOMER_TZ, formatInTz, teacherLocalToUtc } from "@/lib/timezone";
import { friendlyAdminError } from "@/lib/ui/errors";
import type { AdminErrorBody, AdminWarning, SessionPatchResponse } from "@/lib/admin/contracts";

/** The subset of a session row this dialog edits. */
export type EditableSession = {
  id: string;
  teacher_id: string;
  class_category_id: string | null;
  start_at: string;
  end_at: string;
  capacity: number;
  notes: string | null;
  /** Used to keep an inactive teacher selectable on a session that already has one. */
  teacher_name: string | null;
};

type TeacherOption = { id: string; display_name: string };
type CategoryOption = { id: string; name: string; is_active: boolean };

/**
 * Sentences for the non-blocking observations an admin route reports back.
 *
 * An admin override is allowed to sit outside a teacher's posted hours, on a
 * date they blocked, or on a teacher who is no longer listed: the operator is
 * told, never stopped. Both admin session surfaces render `AdminWarning[]`, and
 * this slice owns no shared module, so the copy lives here and the roster
 * imports it.
 */
const ADMIN_WARNING_COPY: Record<AdminWarning, string> = {
  outside_availability: "Saved, but this is outside the teacher's posted hours.",
  blocked_date: "Saved, but the teacher has blocked that date.",
  teacher_has_no_calendar:
    "Saved, but this teacher has no calendar set, so the join link may take a retry.",
  attendee_not_invited:
    "Saved, but the calendar invite could not be updated. Students can still join from their dashboard.",
  teacher_inactive: "Saved, but that teacher is marked as inactive.",
};

/**
 * Takes a raw string rather than an `AdminWarning` on purpose, the same way
 * friendlyAdminError does: a warning from a newer deploy than this bundle must
 * fall through to the generic line, not render as a snake_case token.
 */
export function adminWarningLine(warning: string): string {
  return ADMIN_WARNING_COPY[warning as AdminWarning] ?? "Saved, with a warning. Please check the class.";
}

type Draft = {
  teacherId: string;
  classCategoryId: string;
  /** IST wall clock, explicitly. See the comment on `startAtIso` below. */
  date: string;
  time: string;
  durationMinutes: number;
  capacity: number;
  notes: string;
};

function draftFor(s: EditableSession): Draft {
  return {
    teacherId: s.teacher_id,
    classCategoryId: s.class_category_id ?? "",
    date: formatInTz(s.start_at, DEFAULT_CUSTOMER_TZ, "yyyy-MM-dd"),
    time: formatInTz(s.start_at, DEFAULT_CUSTOMER_TZ, "HH:mm"),
    durationMinutes: Math.max(
      15,
      Math.round((Date.parse(s.end_at) - Date.parse(s.start_at)) / 60000),
    ),
    capacity: s.capacity,
    notes: s.notes ?? "",
  };
}

/**
 * Edit a scheduled class: teacher, class type, time, duration, capacity, notes.
 *
 * Two things this has that the create dialog does not, both of which are the
 * reason it is a separate component rather than a reused one:
 *
 *   1. The time fields are IST, stated on the label. The create dialog reads
 *      `new Date(datetimeLocalValue)`, i.e. the ADMIN's own browser zone, while
 *      every read-back in the app renders in Asia/Kolkata. An admin sitting in
 *      Dubai therefore types one time and reads another 90 minutes off. Here the
 *      inputs are seeded with `formatInTz(..., DEFAULT_CUSTOMER_TZ, ...)` and
 *      converted back with `teacherLocalToUtc`, so what is typed is what the
 *      teacher and the student see.
 *   2. Consequences are shown before they happen. Moving the time or swapping
 *      the teacher replaces the Google Meet event, which invalidates the link
 *      every student already has, and a teacher swap can orphan health documents
 *      that were shared with the person coming off the class.
 */
export function SessionEditDialog({
  session,
  teachers,
  categories,
  onClose,
}: {
  session: EditableSession | null;
  teachers: TeacherOption[];
  categories: CategoryOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  // Seeded once, lazily. SessionsAdmin keys this dialog on the session id, so
  // opening a different class remounts it and re-seeds from the new prop. That
  // replaces what used to be a reset effect, which cost an extra render on every
  // open and tripped react-hooks/set-state-in-effect.
  const [draft, setDraft] = useState<Draft | null>(() => (session ? draftFor(session) : null));
  const [initial] = useState<Draft | null>(() => (session ? draftFor(session) : null));
  const [saving, setSaving] = useState(false);
  const [phiAffected, setPhiAffected] = useState(0);
  const [revokePhi, setRevokePhi] = useState(false);

  const teacherDirty = !!draft && !!initial && draft.teacherId !== initial.teacherId;
  const timeDirty =
    !!draft &&
    !!initial &&
    (draft.date !== initial.date ||
      draft.time !== initial.time ||
      draft.durationMinutes !== initial.durationMinutes);

  // A teacher swap can orphan the health documents students shared with the
  // teacher coming off the class, so ask the server how many before offering
  // the admin a choice about them. dryRun writes nothing. Keyed on the picked
  // teacher rather than on `draft`, which would re-ask on every keystroke in
  // the notes box.
  const draftTeacherId = draft?.teacherId ?? null;
  const sessionId = session?.id ?? null;
  useEffect(() => {
    // No setState on this path: `phiAffected` is only ever READ behind
    // `teacherDirty` (and the submit sends `revokePhi && teacherDirty`), so a
    // stale count while the teacher matches the original is unreachable.
    if (!sessionId || !draftTeacherId || !teacherDirty) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/admin/sessions", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId,
            teacherId: draftTeacherId,
            dryRun: true,
          }),
          signal: controller.signal,
        });
        const body = (await res.json().catch(() => ({}))) as Partial<SessionPatchResponse>;
        if (res.ok) setPhiAffected(body.phiSharesAffected ?? 0);
      } catch {
        // An abort is the expected outcome of picking a different teacher. A
        // real failure just means the amber block stays hidden; the save itself
        // still defaults to leaving the shares in place.
      }
    })();
    return () => controller.abort();
  }, [sessionId, draftTeacherId, teacherDirty]);

  const oldTeacherName =
    teachers.find((t) => t.id === session?.teacher_id)?.display_name ??
    session?.teacher_name ??
    "the previous teacher";

  // A session can legitimately sit on a teacher who has since been deactivated,
  // and on one of the eight categories retired by 0023. Neither may silently
  // fall out of its Select and get rewritten to something else on save.
  const teacherOptions: TeacherOption[] =
    session && !teachers.some((t) => t.id === session.teacher_id)
      ? [
          ...teachers,
          { id: session.teacher_id, display_name: `${session.teacher_name ?? "Teacher"} (inactive)` },
        ]
      : teachers;

  async function save() {
    if (!session || !draft || !initial) return;
    if (!draft.date || !draft.time) {
      toast.error("Pick a date and a time.");
      return;
    }

    // Only the dirty keys travel, so an untouched field can never overwrite a
    // change somebody else made in the meantime.
    // Guarded by teacherDirty: reverting the teacher back to the original must
    // never carry a revoke that was ticked while a different one was selected.
    const payload: Record<string, unknown> = {
      dryRun: false,
      revokePhiShares: revokePhi && teacherDirty,
    };
    if (draft.teacherId !== initial.teacherId) payload.teacherId = draft.teacherId;
    if (draft.classCategoryId !== initial.classCategoryId) {
      payload.classCategoryId = draft.classCategoryId || null;
    }
    if (draft.capacity !== initial.capacity) payload.capacity = draft.capacity;
    if (draft.notes !== initial.notes) payload.notes = draft.notes.trim() || null;
    if (timeDirty) {
      // The route refuses a duration without a start, because it needs both to
      // derive end_at. Send the unchanged start when only the duration moved.
      payload.startAt = teacherLocalToUtc(draft.date, draft.time).toISOString();
      payload.durationMinutes = draft.durationMinutes;
    }

    if (Object.keys(payload).length <= 2) {
      toast.error("Nothing was changed.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/sessions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, ...payload }),
      });
      const body = (await res.json().catch(() => ({}))) as
        | SessionPatchResponse
        | AdminErrorBody;
      if (!res.ok) {
        toast.error(friendlyAdminError((body as AdminErrorBody).error));
        return;
      }
      const ok = body as SessionPatchResponse;
      toast.success(ok.meetReissued ? "Class updated. New join link on the way." : "Class updated.");
      for (const warning of ok.warnings ?? []) {
        toast.warning(adminWarningLine(warning));
      }
      onClose();
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={session !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit class</DialogTitle>
          <DialogDescription>
            Times here are Indian Standard Time, the same clock the teacher works to. Each student
            still sees the class in their own timezone.
          </DialogDescription>
        </DialogHeader>

        {draft && (
          <div className="space-y-4">
            <div>
              <LabelWithHint hint="Who runs the class. Checked against this teacher's other classes on save, so an overlap is refused.">
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
                  {teacherOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <LabelWithHint hint="Group classes carry a class type. Leave it as a 1:1 private session for one-on-one bookings.">
                Class type
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
                      {c.is_active ? c.name : `${c.name} (retired)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelWithHint
                  htmlFor="edit_date"
                  hint="The date in Indian Standard Time. A student west of India may see the class on the day before."
                >
                  Date (IST)
                </LabelWithHint>
                <Input
                  id="edit_date"
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <LabelWithHint
                  htmlFor="edit_time"
                  hint="Start time in Indian Standard Time, which is what the teacher works to."
                >
                  Start (IST)
                </LabelWithHint>
                <Input
                  id="edit_time"
                  type="time"
                  value={draft.time}
                  onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelWithHint
                  htmlFor="edit_dur"
                  hint="Class length in minutes. Sets the end time and feeds the teacher overlap check."
                >
                  Duration (minutes)
                </LabelWithHint>
                <Input
                  id="edit_dur"
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
                  htmlFor="edit_cap"
                  hint="Maximum students. It cannot go below the number already booked, so remove a student first if you need to shrink the class."
                >
                  Capacity
                </LabelWithHint>
                <Input
                  id="edit_cap"
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
                htmlFor="edit_notes"
                hint="Internal note attached to the class. Students never see it."
              >
                Internal notes
              </LabelWithHint>
              <Textarea
                id="edit_notes"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={2}
                className="mt-1.5"
                placeholder="e.g. Bring a bolster"
              />
            </div>

            {(timeDirty || teacherDirty) && (
              <div className="rounded-lg border border-border bg-foreground/4 p-3 text-xs leading-relaxed text-muted-foreground">
                Changing the time or the teacher replaces the Google Meet link. Students who have
                the old link will need the new one from their dashboard. Reminder emails will be
                sent again for the new time.
              </div>
            )}

            {teacherDirty && phiAffected > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <Label className="flex items-start gap-2 text-xs font-normal leading-relaxed">
                    <Checkbox
                      checked={revokePhi}
                      onCheckedChange={(v) => setRevokePhi(v === true)}
                      className="mt-0.5"
                    />
                    <span>
                      Revoke the health documents {phiAffected}{" "}
                      {phiAffected === 1 ? "student" : "students"} shared with {oldTeacherName}. Only
                      the student can share them again.
                    </span>
                  </Label>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !draft}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
