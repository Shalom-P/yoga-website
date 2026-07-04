"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldHint, LabelWithHint } from "@/components/ui/field-hint";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { MediaUploadField } from "./MediaUploadField";
import type { Teacher } from "@/lib/supabase/types";

const TEACHER_MEDIA_BUCKET = "teacher-media";

type Draft = {
  id?: string;
  slug: string;
  display_name: string;
  headline: string;
  bio: string;
  specialties: string;
  languages: string;
  years_experience: number;
  certifications: string;
  sort_order: number;
  timezone: string;
  google_calendar_id: string;
  avatar_url: string | null;
  cover_image_url: string | null;
  intro_video_url: string | null;
  is_active: boolean;
};

function toDraft(t: Teacher | null): Draft {
  const certs = t?.certifications;
  const certLines = Array.isArray(certs)
    ? (certs as string[]).join("\n")
    : typeof certs === "string"
    ? certs
    : "";
  return {
    id: t?.id,
    slug: t?.slug ?? "",
    display_name: t?.display_name ?? "",
    headline: t?.headline ?? "",
    bio: t?.bio ?? "",
    specialties: (t?.specialties ?? []).join(", "),
    languages: (t?.languages ?? []).join(", "),
    years_experience: t?.years_experience ?? 0,
    certifications: certLines,
    sort_order: t?.sort_order ?? 0,
    timezone: t?.timezone ?? "Asia/Kolkata",
    google_calendar_id: t?.google_calendar_id ?? "",
    avatar_url: t?.avatar_url ?? null,
    cover_image_url: t?.cover_image_url ?? null,
    intro_video_url: t?.intro_video_url ?? null,
    is_active: t?.is_active ?? true,
  };
}

/**
 * Bust the ISR cache on the marketing pages that render this teacher's media.
 * The save below is a client-side Supabase write, so it can't call
 * revalidatePath itself — this pings an admin-only route that does. Best-effort:
 * if it fails, the pages' own `revalidate = 300` window is the fallback.
 */
async function revalidateMarketing(slug: string) {
  try {
    await fetch("/api/admin/revalidate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug }),
    });
  } catch {
    // ignore — non-fatal
  }
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: Teacher | null;
  redirectAfterCreate?: boolean;
};

export function TeacherFormDialog({ open, onOpenChange, teacher, redirectAfterCreate }: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [draft, setDraft] = useState<Draft>(toDraft(teacher));
  const [saving, setSaving] = useState(false);

  function handleOpenChange(next: boolean) {
    // Reseed on close so the next open starts from the current teacher prop.
    if (!next) setDraft(toDraft(teacher));
    onOpenChange(next);
  }

  async function save() {
    if (!draft.display_name) {
      toast.error("Name is required.");
      return;
    }
    const slug = draft.slug || slugify(draft.display_name);
    if (!slug) {
      toast.error("Slug is required.");
      return;
    }

    setSaving(true);
    const certifications: string[] = draft.certifications
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      slug,
      display_name: draft.display_name,
      headline: draft.headline || null,
      bio: draft.bio || null,
      specialties: draft.specialties
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      languages: draft.languages
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      years_experience: draft.years_experience,
      certifications,
      sort_order: draft.sort_order,
      timezone: draft.timezone || "Asia/Kolkata",
      google_calendar_id: draft.google_calendar_id || null,
      avatar_url: draft.avatar_url,
      cover_image_url: draft.cover_image_url,
      intro_video_url: draft.intro_video_url,
      is_active: draft.is_active,
    };

    if (draft.id) {
      const { error } = await supabase.from("teachers").update(payload).eq("id", draft.id);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
      await revalidateMarketing(slug);
      setSaving(false);
      toast.success("Teacher updated.");
      onOpenChange(false);
      router.refresh();
    } else {
      const { data, error } = await supabase
        .from("teachers")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) {
        setSaving(false);
        return toast.error(error?.message ?? "Insert failed");
      }
      await revalidateMarketing(slug);
      setSaving(false);
      toast.success("Teacher added.");
      onOpenChange(false);
      if (redirectAfterCreate) router.push(`/admin/teachers/${data.id}`);
      else router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Edit teacher" : "Add teacher"}</DialogTitle>
          <DialogDescription>
            All fields except name are optional. Set the Google calendar ID once the teacher&apos;s individual calendar exists; until then sessions use the system calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <LabelWithHint
                htmlFor="display_name"
                hint="Public name shown on /teachers, the booking page, and session invites."
              >
                Display name
              </LabelWithHint>
              <Input
                id="display_name"
                value={draft.display_name}
                onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <LabelWithHint
                htmlFor="slug"
                hint="URL-safe handle (used in /teachers/<slug>). Leave blank to auto-generate from the name."
              >
                Slug
              </LabelWithHint>
              <Input
                id="slug"
                value={draft.slug}
                placeholder={slugify(draft.display_name) || "auto from name"}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <LabelWithHint
              htmlFor="headline"
              hint="One-line tagline shown under the teacher's name on cards (e.g. 'Hatha & Therapy · 14 years')."
            >
              Headline
            </LabelWithHint>
            <Input
              id="headline"
              value={draft.headline}
              onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
              placeholder="Hatha & Therapy Yoga · 14 years"
              className="mt-1.5"
            />
          </div>

          <div>
            <LabelWithHint
              htmlFor="bio"
              hint="2-4 sentences on training and teaching style. Shown on the teacher's profile page."
            >
              Bio
            </LabelWithHint>
            <Textarea
              id="bio"
              value={draft.bio}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              rows={3}
              className="mt-1.5"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <LabelWithHint
                htmlFor="specialties"
                hint="What this teacher is known for. Comma-separated tags shown as filter chips."
              >
                Specialties (comma-separated)
              </LabelWithHint>
              <Input
                id="specialties"
                value={draft.specialties}
                onChange={(e) => setDraft({ ...draft, specialties: e.target.value })}
                placeholder="Hatha, Pain Relief, Beginners"
                className="mt-1.5"
              />
            </div>
            <div>
              <LabelWithHint
                htmlFor="languages"
                hint="Languages the teacher can conduct a class in. Helps customers self-match."
              >
                Languages (comma-separated)
              </LabelWithHint>
              <Input
                id="languages"
                value={draft.languages}
                onChange={(e) => setDraft({ ...draft, languages: e.target.value })}
                placeholder="English, Hindi"
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <LabelWithHint
                htmlFor="years"
                hint="Years of teaching experience. Displayed as a trust signal next to the bio."
              >
                Years of experience
              </LabelWithHint>
              <Input
                id="years"
                type="number"
                min={0}
                value={draft.years_experience}
                onChange={(e) =>
                  setDraft({ ...draft, years_experience: Number(e.target.value) || 0 })
                }
                className="mt-1.5"
              />
            </div>
            <div>
              <LabelWithHint
                htmlFor="tz"
                hint="IANA TZ where the teacher lives. Drives availability conversion (e.g. 'Asia/Kolkata')."
              >
                Timezone
              </LabelWithHint>
              <Input
                id="tz"
                value={draft.timezone}
                onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                placeholder="Asia/Kolkata"
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <LabelWithHint
                htmlFor="certifications"
                hint="One certification per line. Stored as a JSON array; shown on the teacher's profile page."
              >
                Certifications (one per line)
              </LabelWithHint>
              <Textarea
                id="certifications"
                value={draft.certifications}
                onChange={(e) => setDraft({ ...draft, certifications: e.target.value })}
                rows={3}
                placeholder={"RYT-200 (Yoga Alliance)\nAyurvedic Yoga Specialist"}
                className="mt-1.5"
              />
            </div>
            <div>
              <LabelWithHint
                htmlFor="sort_order"
                hint="Lower numbers appear first on the /teachers listing. Default 0."
              >
                Sort order
              </LabelWithHint>
              <Input
                id="sort_order"
                type="number"
                value={draft.sort_order}
                onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })}
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <LabelWithHint hint="Square headshot shown on teacher cards and the booking page. JPG/PNG, ideally 600×600.">
                Avatar photo
              </LabelWithHint>
              <MediaUploadField
                bucket={TEACHER_MEDIA_BUCKET}
                folder={`avatars/${draft.slug || "new"}`}
                accept="image"
                maxSizeMb={25}
                value={draft.avatar_url}
                onChange={(url) => setDraft({ ...draft, avatar_url: url })}
                disabled={saving}
              />
            </div>
            <div>
              <LabelWithHint hint="Wide hero image at the top of the teacher's profile page. JPG/PNG, ideally 1600×900.">
                Cover image
              </LabelWithHint>
              <MediaUploadField
                bucket={TEACHER_MEDIA_BUCKET}
                folder={`covers/${draft.slug || "new"}`}
                accept="image"
                maxSizeMb={25}
                value={draft.cover_image_url}
                onChange={(url) => setDraft({ ...draft, cover_image_url: url })}
                disabled={saving}
              />
            </div>
          </div>

          <div>
            <LabelWithHint hint="Short (30-60s) intro video where the teacher introduces themselves. MP4 or WebM, up to 100 MB, served from Supabase Storage.">
              Intro video
            </LabelWithHint>
            <MediaUploadField
              bucket={TEACHER_MEDIA_BUCKET}
              folder={`intros/${draft.slug || "new"}`}
              accept="video"
              maxSizeMb={100}
              value={draft.intro_video_url}
              onChange={(url) => setDraft({ ...draft, intro_video_url: url })}
              disabled={saving}
            />
          </div>

          <div>
            <LabelWithHint
              htmlFor="gcal"
              hint="Optional teacher-owned Google calendar to host their session events on. Leave blank to use the system calendar."
            >
              Google Calendar ID
            </LabelWithHint>
            <Input
              id="gcal"
              value={draft.google_calendar_id}
              onChange={(e) => setDraft({ ...draft, google_calendar_id: e.target.value })}
              placeholder="optional"
              className="mt-1.5"
            />
          </div>

          <Label className="flex items-center gap-2 text-sm font-normal">
            <Checkbox
              checked={draft.is_active}
              onCheckedChange={(v) => setDraft({ ...draft, is_active: v === true })}
            />
            Active and visible on the marketing site
            <FieldHint>
              Uncheck to hide this teacher from the public site and the booking flow without
              deleting the record.
            </FieldHint>
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
