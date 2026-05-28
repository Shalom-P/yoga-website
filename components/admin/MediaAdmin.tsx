"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  file: File | null;
};

const EMPTY: Draft = {
  kind: "banner",
  placement: "",
  alt_text: "",
  caption: "",
  starts_at: "",
  ends_at: "",
  is_active: true,
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
      toast.error(
        `Upload failed: ${uploadErr.message}. Make sure the "${BUCKET}" Storage bucket exists.`
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

  async function remove(item: PromotionalMedia) {
    setDeleting(item.id);
    const { error } = await supabase.from("promotional_media").delete().eq("id", item.id);
    setDeleting(null);
    if (error) return toast.error(error.message);
    toast.success("Removed.");
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
          Promotional media
        </h1>
        <Button className="rounded-full" onClick={() => setOpen(true)}>
          <Upload className="size-4 mr-1" />
          Upload
        </Button>
      </div>

      {media.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          No media yet. Uploads go to Supabase Storage bucket <code>{BUCKET}</code>.
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
              <Label htmlFor="file">File</Label>
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
                <Label>Kind</Label>
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
                <Label htmlFor="placement">Placement</Label>
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
              <Label htmlFor="alt">Alt text</Label>
              <Input
                id="alt"
                value={draft.alt_text}
                onChange={(e) => setDraft({ ...draft, alt_text: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="caption">Caption (optional)</Label>
              <Input
                id="caption"
                value={draft.caption}
                onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="starts">Starts (optional)</Label>
                <Input
                  id="starts"
                  type="datetime-local"
                  value={draft.starts_at}
                  onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="ends">Ends (optional)</Label>
                <Input
                  id="ends"
                  type="datetime-local"
                  value={draft.ends_at}
                  onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={draft.is_active}
                onCheckedChange={(v) => setDraft({ ...draft, is_active: v === true })}
              />
              Visible on the site
            </label>
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
    </>
  );
}
