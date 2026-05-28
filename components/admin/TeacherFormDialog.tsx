"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import type { Teacher } from "@/lib/supabase/types";

type Draft = {
  id?: string;
  slug: string;
  display_name: string;
  headline: string;
  bio: string;
  specialties: string;
  languages: string;
  years_experience: number;
  timezone: string;
  google_calendar_id: string;
  is_active: boolean;
};

function toDraft(t: Teacher | null): Draft {
  return {
    id: t?.id,
    slug: t?.slug ?? "",
    display_name: t?.display_name ?? "",
    headline: t?.headline ?? "",
    bio: t?.bio ?? "",
    specialties: (t?.specialties ?? []).join(", "),
    languages: (t?.languages ?? []).join(", "),
    years_experience: t?.years_experience ?? 0,
    timezone: t?.timezone ?? "Asia/Kolkata",
    google_calendar_id: t?.google_calendar_id ?? "",
    is_active: t?.is_active ?? true,
  };
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
      timezone: draft.timezone || "Asia/Kolkata",
      google_calendar_id: draft.google_calendar_id || null,
      is_active: draft.is_active,
    };

    if (draft.id) {
      const { error } = await supabase.from("teachers").update(payload).eq("id", draft.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Teacher updated.");
      onOpenChange(false);
      router.refresh();
    } else {
      const { data, error } = await supabase
        .from("teachers")
        .insert(payload)
        .select("id")
        .single();
      setSaving(false);
      if (error || !data) return toast.error(error?.message ?? "Insert failed");
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                value={draft.display_name}
                onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="slug">Slug</Label>
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
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              value={draft.headline}
              onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
              placeholder="Hatha & Therapy Yoga · 14 years"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={draft.bio}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              rows={3}
              className="mt-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="specialties">Specialties (comma-separated)</Label>
              <Input
                id="specialties"
                value={draft.specialties}
                onChange={(e) => setDraft({ ...draft, specialties: e.target.value })}
                placeholder="Hatha, Pain Relief, Beginners"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="languages">Languages (comma-separated)</Label>
              <Input
                id="languages"
                value={draft.languages}
                onChange={(e) => setDraft({ ...draft, languages: e.target.value })}
                placeholder="English, Hindi"
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="years">Years of experience</Label>
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
              <Label htmlFor="tz">Timezone</Label>
              <Input
                id="tz"
                value={draft.timezone}
                onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                placeholder="Asia/Kolkata"
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="gcal">Google Calendar ID</Label>
            <Input
              id="gcal"
              value={draft.google_calendar_id}
              onChange={(e) => setDraft({ ...draft, google_calendar_id: e.target.value })}
              placeholder="optional"
              className="mt-1.5"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={draft.is_active}
              onCheckedChange={(v) => setDraft({ ...draft, is_active: v === true })}
            />
            Active and visible on the marketing site
          </label>
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
