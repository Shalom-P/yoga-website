"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeacherFormDialog } from "./TeacherFormDialog";
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
import type { Teacher } from "@/lib/supabase/types";

export function TeacherEditPanel({ teacher }: { teacher: Teacher }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function softDelete() {
    setDeleting(true);
    const { error } = await supabase
      .from("teachers")
      .update({ is_active: false })
      .eq("id", teacher.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Teacher hidden. They can be reactivated from the edit form.");
    setDeleteOpen(false);
    router.push("/admin/teachers");
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Slug</div>
            <div className="font-mono text-sm">{teacher.slug}</div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5 mr-1" />
              Edit details
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
              disabled={!teacher.is_active}
            >
              <Trash2 className="size-3.5 mr-1" />
              {teacher.is_active ? "Hide" : "Hidden"}
            </Button>
          </div>
        </div>

        <dl className="mt-6 grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <Detail label="Headline" value={teacher.headline} />
          <Detail label="Timezone" value={teacher.timezone} />
          <Detail label="Years experience" value={String(teacher.years_experience)} />
          <Detail
            label="Specialties"
            value={teacher.specialties.length ? teacher.specialties.join(", ") : "—"}
          />
          <Detail
            label="Languages"
            value={teacher.languages.length ? teacher.languages.join(", ") : "—"}
          />
          <Detail label="Google Calendar ID" value={teacher.google_calendar_id ?? "(system calendar)"} />
        </dl>

        {teacher.bio && (
          <div className="mt-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Bio</div>
            <p className="text-sm whitespace-pre-wrap">{teacher.bio}</p>
          </div>
        )}
      </div>

      <TeacherFormDialog open={editOpen} onOpenChange={setEditOpen} teacher={teacher} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hide {teacher.display_name}?</DialogTitle>
            <DialogDescription>
              This sets the teacher to inactive so they no longer appear on the marketing site or in
              booking flows. Existing bookings and availability are preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={softDelete} disabled={deleting}>
              {deleting ? "Hiding…" : "Hide teacher"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value ?? "—"}</div>
    </div>
  );
}
