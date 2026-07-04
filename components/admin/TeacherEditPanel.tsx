"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Mail, UserCheck, UserX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function TeacherEditPanel({
  teacher,
  linkedAccount,
}: {
  teacher: Teacher;
  linkedAccount: { email: string | null } | null;
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);

  async function sendInvite() {
    const email = inviteEmail.trim();
    if (!email) {
      toast.error("Enter the teacher's email address.");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch(`/api/admin/teachers/${teacher.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        invited?: boolean;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Couldn't create the login.");
        return;
      }
      toast.success(
        body.invited
          ? `Invite sent to ${email}. They'll get a sign-in link.`
          : `${email} is now linked as a teacher login.`
      );
      setInviteOpen(false);
      setInviteEmail("");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setInviting(false);
    }
  }

  async function revokeAccess() {
    if (!teacher.profile_id) return;
    setRevoking(true);
    const { error } = await supabase.rpc("demote_from_teacher", {
      target_user_id: teacher.profile_id,
    });
    setRevoking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Login access revoked. The teacher profile is unchanged.");
    setRevokeOpen(false);
    router.refresh();
  }

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
            value={teacher.specialties.length ? teacher.specialties.join(", ") : "-"}
          />
          <Detail
            label="Languages"
            value={teacher.languages.length ? teacher.languages.join(", ") : "-"}
          />
          <Detail label="Google Calendar ID" value={teacher.google_calendar_id ?? "(system calendar)"} />
        </dl>

        {teacher.bio && (
          <div className="mt-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Bio</div>
            <p className="text-sm whitespace-pre-wrap">{teacher.bio}</p>
          </div>
        )}

        <div className="mt-6 border-t border-border pt-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
            Login account
          </div>
          {linkedAccount ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2.5 text-sm">
                <UserCheck className="size-4 text-primary" />
                <div>
                  <div className="font-medium">Login active</div>
                  <div className="text-muted-foreground">
                    {linkedAccount.email ?? "Linked account"}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setRevokeOpen(true)}
              >
                <UserX className="size-3.5 mr-1" />
                Revoke access
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border p-4">
              <p className="text-sm text-muted-foreground">
                No login yet. This teacher can&apos;t sign in or manage their own
                schedule.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => setInviteOpen(true)}
              >
                <Mail className="size-3.5 mr-1" />
                Invite / link login
              </Button>
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Media</div>
          <div className="grid gap-4 sm:grid-cols-3">
            <MediaPreview label="Avatar" url={teacher.avatar_url} kind="image" aspect="aspect-square" />
            <MediaPreview label="Cover image" url={teacher.cover_image_url} kind="image" aspect="aspect-video" />
            <MediaPreview label="Intro video" url={teacher.intro_video_url} kind="video" aspect="aspect-video" />
          </div>
        </div>
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

      <Dialog
        open={inviteOpen}
        onOpenChange={(o) => {
          if (!o) setInviteEmail("");
          setInviteOpen(o);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a login for {teacher.display_name}</DialogTitle>
            <DialogDescription>
              Enter the teacher&apos;s email. If they already have an account we&apos;ll
              link it and grant teacher access; otherwise we&apos;ll email them a
              passwordless sign-in invite. They&apos;ll be able to manage their own
              availability and see their schedule.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="teacher@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !inviting) sendInvite();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setInviteEmail("");
                setInviteOpen(false);
              }}
              disabled={inviting}
            >
              Cancel
            </Button>
            <Button onClick={sendInvite} disabled={inviting}>
              {inviting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1" />
                  Sending…
                </>
              ) : (
                "Send invite"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke login access?</DialogTitle>
            <DialogDescription>
              {linkedAccount?.email ?? "This account"} will lose teacher access and
              revert to a regular customer account. The teacher profile, availability
              and sessions are all preserved, and you can re-invite a login later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeOpen(false)} disabled={revoking}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={revokeAccess} disabled={revoking}>
              {revoking ? "Revoking…" : "Revoke access"}
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
      <div className="mt-0.5">{value ?? "-"}</div>
    </div>
  );
}

function MediaPreview({
  label,
  url,
  kind,
  aspect,
}: {
  label: string;
  url: string | null;
  kind: "image" | "video";
  aspect: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1.5">{label}</div>
      {url ? (
        kind === "video" ? (
          <video
            src={url}
            controls
            preload="metadata"
            className={`w-full ${aspect} rounded-lg border border-border bg-black object-cover`}
          />
        ) : (
          // Public Storage URL, plain <img> avoids next/image remotePatterns config.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={label}
            className={`w-full ${aspect} rounded-lg border border-border object-cover`}
          />
        )
      ) : (
        <div
          className={`w-full ${aspect} rounded-lg border border-dashed border-border bg-muted/40 flex items-center justify-center text-center text-xs text-muted-foreground`}
        >
          Not uploaded
        </div>
      )}
    </div>
  );
}
