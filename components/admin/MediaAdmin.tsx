"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { PromotionalMedia, MediaKind } from "@/lib/supabase/types";

const BUCKET = "promotional-media";

type Draft = {
  kind: MediaKind;
  placement: string;
  alt_text: string;
  caption: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  sort_order: number;
  file: File | null;
};

type EditDraft = {
  id: string;
  kind: MediaKind;
  placement: string;
  alt_text: string;
  caption: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  sort_order: number;
};

const EMPTY: Draft = {
  kind: "banner",
  placement: "",
  alt_text: "",
  caption: "",
  starts_at: "",
  ends_at: "",
  is_active: true,
  sort_order: 0,
  file: null,
};

const KIND_LABELS: Record<MediaKind, string> = {
  hero_video: "Hero video",
  hero_image: "Hero image",
  banner: "Banner",
  testimonial_photo: "Testimonial photo",
  class_thumbnail: "Class thumbnail",
};

export function MediaAdmin({ media }: { media: PromotionalMedia[] }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editTarget, setEditTarget] = useState<EditDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) setDraft(EMPTY);
    setOpen(next);
  }

  async function save() {
    if (!draft.file) {
      toast.error("Pick a file to upload.");
      return;
    }
    setSaving(true);

    const ext = draft.file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${draft.kind}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, draft.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: draft.file.type || undefined,
    });
    if (uploadErr) {
      setSaving(false);
      // The most common cause of an upload failure on a fresh install is the
      // storage bucket + RLS policies not being applied yet (migration 0008).
      // Surface that hint instead of just dumping the raw error.
      const msg = uploadErr.message ?? "";
      const isRlsOrMissing =
        /row-level security|bucket not found|Bucket not found/i.test(msg);
      toast.error(
        isRlsOrMissing
          ? `Upload blocked: the "${BUCKET}" Storage bucket isn't set up yet. Apply supabase/migrations/0008_storage_buckets.sql in the Supabase SQL editor, then try again.`
          : `Upload failed: ${msg}`
      );
      return;
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const { error: insertErr } = await supabase.from("promotional_media").insert({
      kind: draft.kind,
      url: pub.publicUrl,
      placement: draft.placement || null,
      alt_text: draft.alt_text || null,
      caption: draft.caption || null,
      is_active: draft.is_active,
      sort_order: draft.sort_order,
      starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
      ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
    });
    setSaving(false);
    if (insertErr) {
      // Best effort: roll the upload back so we don't orphan the file.
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
      toast.error(insertErr.message);
      return;
    }
    toast.success("Uploaded.");
    handleOpenChange(false);
    router.refresh();
  }

  // Public URLs look like:
  //   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  // We need <path> to call storage.remove(). Returns null if the URL doesn't
  // belong to our bucket (e.g. someone hand-edited the row to point at a CDN).
  function bucketPathFromPublicUrl(url: string): string | null {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length));
  }

  async function remove(item: PromotionalMedia) {
    setDeleting(item.id);
    const { error } = await supabase.from("promotional_media").delete().eq("id", item.id);
    if (error) {
      setDeleting(null);
      return toast.error(error.message);
    }
    // Delete the file too — without this, every removal leaks Storage quota.
    // Storage delete is best-effort; the DB row is already gone so we just log.
    const path = bucketPathFromPublicUrl(item.url);
    if (path) {
      await supabase.storage
        .from(BUCKET)
        .remove([path])
        .catch(() => {});
    }
    setDeleting(null);
    toast.success("Removed.");
    router.refresh();
  }

  function openEditDialog(m: PromotionalMedia) {
    setEditTarget({
      id: m.id,
      kind: m.kind,
      placement: m.placement ?? "",
      alt_text: m.alt_text ?? "",
      caption: m.caption ?? "",
      starts_at: m.starts_at ? m.starts_at.slice(0, 16) : "",
      ends_at: m.ends_at ? m.ends_at.slice(0, 16) : "",
      is_active: m.is_active,
      sort_order: m.sort_order ?? 0,
    });
  }

  async function saveEdit() {
    if (!editTarget) return;
    setEditSaving(true);
    const { error } = await supabase
      .from("promotional_media")
      .update({
        kind: editTarget.kind,
        placement: editTarget.placement || null,
        alt_text: editTarget.alt_text || null,
        caption: editTarget.caption || null,
        is_active: editTarget.is_active,
        sort_order: editTarget.sort_order,
        starts_at: editTarget.starts_at ? new Date(editTarget.starts_at).toISOString() : null,
        ends_at: editTarget.ends_at ? new Date(editTarget.ends_at).toISOString() : null,
      })
      .eq("id", editTarget.id);
    setEditSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Media updated.");
    setEditTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
          Promotional media
        </h1>
        <Button className="rounded-full" onClick={() => setOpen(true)}>
          <Upload className="size-4 mr-1" />
          Upload
        </Button>
      </div>

      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Upload images and videos that the marketing pages pull in by{" "}
        <strong>placement</strong>. Hero videos, page banners, testimonial photos and
        class thumbnails all live here so you can swap them out without a code change.
        Files are stored in the <code className="rounded bg-muted px-1 py-0.5 text-xs">{BUCKET}</code>{" "}
        Supabase Storage bucket; the public URL is saved to the{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">promotional_media</code> table
        with metadata. Pick a{" "}
        <strong>Kind</strong> (hero_video, banner, testimonial_photo, etc.), set a{" "}
        <strong>Placement</strong> the page is querying (e.g.{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">landing.hero</code>), and tick{" "}
        <strong>Visible</strong>. Optional <strong>Starts</strong> and <strong>Ends</strong>{" "}
        windows let you schedule time-boxed banners.
      </p>

      {media.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          No media yet. Click <b>Upload</b> to add your first asset.
          <div className="mt-3 text-xs">
            First upload failing with an RLS error? Apply{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              supabase/migrations/0008_storage_buckets.sql
            </code>{" "}
            in the Supabase SQL editor to create the bucket.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map((m) => (
            <div key={m.id} className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="aspect-video bg-muted relative">
                {m.kind === "hero_video" ? (
                  <video src={m.url} className="size-full object-cover" muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.alt_text ?? ""} className="size-full object-cover" />
                )}
              </div>
              <div className="p-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  {KIND_LABELS[m.kind]}
                </div>
                <div className="font-medium text-sm truncate">{m.placement ?? "(no placement)"}</div>
                <div className="text-xs text-muted-foreground truncate">{m.alt_text ?? ""}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className={`text-xs ${m.is_active ? "text-primary" : "text-muted-foreground"}`}>
                    {m.is_active ? "Active" : "Hidden"}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditDialog(m)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(m)}
                      disabled={deleting === m.id}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload media</DialogTitle>
            <DialogDescription>
              Files go to the <code>{BUCKET}</code> Storage bucket. Public URLs are stored in the database for the marketing site.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <LabelWithHint
                htmlFor="file"
                hint="Image or video to upload. Lands in the `promotional-media` Storage bucket; the public URL is saved to the DB."
              >
                File
              </LabelWithHint>
              <Input
                id="file"
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={(e) => setDraft({ ...draft, file: e.target.files?.[0] ?? null })}
                className="mt-1.5"
              />
              {draft.file && (
                <p className="text-xs text-muted-foreground mt-1">
                  {draft.file.name} · {(draft.file.size / 1024).toFixed(0)} KB
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelWithHint hint="Where on the site this slot is rendered (hero, banner, testimonial photo, class card thumbnail).">
                  Kind
                </LabelWithHint>
                <Select
                  value={draft.kind}
                  onValueChange={(v) => v && setDraft({ ...draft, kind: v as MediaKind })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(KIND_LABELS) as MediaKind[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <LabelWithHint
                  htmlFor="placement"
                  hint="Free-text label that landing components query against (e.g. 'landing.hero', 'reviews.sidebar')."
                >
                  Placement
                </LabelWithHint>
                <Input
                  id="placement"
                  value={draft.placement}
                  onChange={(e) => setDraft({ ...draft, placement: e.target.value })}
                  placeholder="landing.hero"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <LabelWithHint
                htmlFor="alt"
                hint="Screen-reader description of the image. Required for accessibility on any visual media."
              >
                Alt text
              </LabelWithHint>
              <Input
                id="alt"
                value={draft.alt_text}
                onChange={(e) => setDraft({ ...draft, alt_text: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div>
              <LabelWithHint
                htmlFor="caption"
                hint="Short caption rendered under the media on the marketing page (e.g. 'Aarti, Pune')."
              >
                Caption (optional)
              </LabelWithHint>
              <Input
                id="caption"
                value={draft.caption}
                onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelWithHint
                  htmlFor="starts"
                  hint="If set, the asset only shows on the site from this date/time. Leave blank to publish immediately."
                >
                  Starts (optional)
                </LabelWithHint>
                <Input
                  id="starts"
                  type="datetime-local"
                  value={draft.starts_at}
                  onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <LabelWithHint
                  htmlFor="ends"
                  hint="If set, the asset stops showing after this date/time. Useful for time-boxed promo banners."
                >
                  Ends (optional)
                </LabelWithHint>
                <Input
                  id="ends"
                  type="datetime-local"
                  value={draft.ends_at}
                  onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <LabelWithHint
                htmlFor="upload_sort"
                hint="Lower numbers are served first when a placement has multiple assets. Default 0."
              >
                Sort order
              </LabelWithHint>
              <Input
                id="upload_sort"
                type="number"
                value={draft.sort_order}
                onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })}
                className="mt-1.5"
              />
            </div>

            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox
                checked={draft.is_active}
                onCheckedChange={(v) => setDraft({ ...draft, is_active: v === true })}
              />
              Visible on the site
              <FieldHint>
                Master switch. Uncheck to hide without deleting the file.
              </FieldHint>
            </Label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit metadata dialog — no file re-upload */}
      <Dialog open={editTarget !== null} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit media metadata</DialogTitle>
            <DialogDescription>
              Update placement, kind, visibility and scheduling. The file itself is not changed.
            </DialogDescription>
          </DialogHeader>

          {editTarget && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <LabelWithHint hint="Where on the site this slot is rendered.">
                    Kind
                  </LabelWithHint>
                  <Select
                    value={editTarget.kind}
                    onValueChange={(v) => v && setEditTarget({ ...editTarget, kind: v as MediaKind })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(KIND_LABELS) as MediaKind[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {KIND_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <LabelWithHint
                    htmlFor="edit_placement"
                    hint="Free-text label landing components query against (e.g. 'landing.hero')."
                  >
                    Placement
                  </LabelWithHint>
                  <Input
                    id="edit_placement"
                    value={editTarget.placement}
                    onChange={(e) => setEditTarget({ ...editTarget, placement: e.target.value })}
                    placeholder="landing.hero"
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <LabelWithHint htmlFor="edit_alt" hint="Screen-reader description of the image.">
                  Alt text
                </LabelWithHint>
                <Input
                  id="edit_alt"
                  value={editTarget.alt_text}
                  onChange={(e) => setEditTarget({ ...editTarget, alt_text: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div>
                <LabelWithHint htmlFor="edit_caption" hint="Short caption rendered under the media.">
                  Caption (optional)
                </LabelWithHint>
                <Input
                  id="edit_caption"
                  value={editTarget.caption}
                  onChange={(e) => setEditTarget({ ...editTarget, caption: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <LabelWithHint htmlFor="edit_starts" hint="Show from this date/time. Leave blank to publish immediately.">
                    Starts (optional)
                  </LabelWithHint>
                  <Input
                    id="edit_starts"
                    type="datetime-local"
                    value={editTarget.starts_at}
                    onChange={(e) => setEditTarget({ ...editTarget, starts_at: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <LabelWithHint htmlFor="edit_ends" hint="Stop showing after this date/time.">
                    Ends (optional)
                  </LabelWithHint>
                  <Input
                    id="edit_ends"
                    type="datetime-local"
                    value={editTarget.ends_at}
                    onChange={(e) => setEditTarget({ ...editTarget, ends_at: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <LabelWithHint
                  htmlFor="edit_sort"
                  hint="Lower numbers are served first when a placement has multiple assets."
                >
                  Sort order
                </LabelWithHint>
                <Input
                  id="edit_sort"
                  type="number"
                  value={editTarget.sort_order}
                  onChange={(e) => setEditTarget({ ...editTarget, sort_order: Number(e.target.value) || 0 })}
                  className="mt-1.5"
                />
              </div>

              <Label className="flex items-center gap-2 text-sm font-normal">
                <Checkbox
                  checked={editTarget.is_active}
                  onCheckedChange={(v) => setEditTarget({ ...editTarget, is_active: v === true })}
                />
                Visible on the site
                <FieldHint>Master switch. Uncheck to hide without deleting the file.</FieldHint>
              </Label>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
