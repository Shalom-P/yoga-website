"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { MediaUploadField } from "./MediaUploadField";
import type { ClassCategory, IntensityLevel } from "@/lib/supabase/types";

const CLASS_MEDIA_BUCKET = "promotional-media";

type Draft = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  long_description: string;
  helps_with: string;
  what_to_expect: string;
  who_for: string;
  intensity: IntensityLevel;
  icon_name: string;
  cover_image_url: string | null;
  props_needed: string;
  sort_order: number;
  is_active: boolean;
};

const EMPTY: Draft = {
  slug: "",
  name: "",
  description: "",
  long_description: "",
  helps_with: "",
  what_to_expect: "",
  who_for: "",
  intensity: "moderate",
  icon_name: "",
  cover_image_url: null,
  props_needed: "",
  sort_order: 0,
  is_active: true,
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// helps_with / what_to_expect are stored as text[]. The textarea accepts one
// item per line, or a comma-separated list on a single line. We split on
// newlines when present so that what_to_expect bullets (which themselves
// contain commas, e.g. "A short check-in, including any signs of a low") stay
// intact; only a single-line entry is split on commas.
function parseList(input: string): string[] {
  const parts = input.includes("\n") ? input.split("\n") : input.split(",");
  return parts.map((s) => s.trim()).filter(Boolean);
}

export function ClassesAdmin({ categories }: { categories: ClassCategory[] }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setDraft(EMPTY);
    setOpen(true);
  }

  function openEdit(c: ClassCategory) {
    setDraft({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description ?? "",
      long_description: c.long_description ?? "",
      // One item per line — keeps commas inside what_to_expect bullets intact.
      helps_with: c.helps_with.join("\n"),
      what_to_expect: c.what_to_expect.join("\n"),
      who_for: c.who_for ?? "",
      intensity: c.intensity,
      icon_name: c.icon_name ?? "",
      cover_image_url: c.cover_image_url ?? null,
      props_needed: c.props_needed.join(", "),
      sort_order: c.sort_order ?? 0,
      is_active: c.is_active,
    });
    setOpen(true);
  }

  async function save() {
    if (!draft.name) {
      toast.error("Name is required.");
      return;
    }
    const slug = draft.slug || slugify(draft.name);
    if (!slug) {
      toast.error("Slug is required.");
      return;
    }
    setSaving(true);
    const payload = {
      slug,
      name: draft.name,
      description: draft.description || null,
      long_description: draft.long_description || null,
      helps_with: parseList(draft.helps_with),
      what_to_expect: parseList(draft.what_to_expect),
      who_for: draft.who_for || null,
      intensity: draft.intensity,
      icon_name: draft.icon_name || null,
      cover_image_url: draft.cover_image_url,
      props_needed: draft.props_needed
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      sort_order: draft.sort_order,
      is_active: draft.is_active,
    };
    const { error } = draft.id
      ? await supabase.from("class_categories").update(payload).eq("id", draft.id)
      : await supabase.from("class_categories").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(draft.id ? "Category updated." : "Category created.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
          Class categories
        </h1>
        <Button className="rounded-full" onClick={openAdd}>
          <Plus className="size-4 mr-1" />
          Add category
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center gap-4 px-5 py-4">
            <div className="flex-1">
              <div className="font-medium flex items-center gap-2">
                {c.name}
                {!c.is_active && (
                  <span className="text-xs text-muted-foreground">(hidden)</span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">{c.description}</div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">
              {c.intensity}
            </span>
            <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
              <Pencil className="size-3.5" />
            </Button>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="px-5 py-12 text-center text-muted-foreground text-sm">
            No class categories yet.
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit category" : "Add category"}</DialogTitle>
            <DialogDescription>
              Class categories drive the /classes page and the included_session_types on plans.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelWithHint
                  htmlFor="name"
                  hint="Display name on the /classes grid and on plan inclusion lists."
                >
                  Name
                </LabelWithHint>
                <Input
                  id="name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <LabelWithHint
                  htmlFor="slug"
                  hint="URL-safe identifier (used in /classes/<slug>) and as the value in plan included_session_types."
                >
                  Slug
                </LabelWithHint>
                <Input
                  id="slug"
                  value={draft.slug}
                  placeholder={slugify(draft.name) || "auto"}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <LabelWithHint
                htmlFor="description"
                hint="One-paragraph blurb shown on the class card and at the top of the detail page."
              >
                Description
              </LabelWithHint>
              <Textarea
                id="description"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={2}
                className="mt-1.5"
              />
            </div>

            <div>
              <LabelWithHint
                htmlFor="long_description"
                hint="Longer intro paragraph on the /classes/<slug> detail page. Keep claims safe: this practice supports/complements wellbeing alongside medical care — never say it cures, treats, or lowers a condition."
              >
                Long description (detail page)
              </LabelWithHint>
              <Textarea
                id="long_description"
                value={draft.long_description}
                onChange={(e) => setDraft({ ...draft, long_description: e.target.value })}
                rows={4}
                className="mt-1.5"
              />
            </div>

            <div>
              <LabelWithHint
                htmlFor="helps_with"
                hint="Shown as 'What it can help with' chips on the detail page. One per line (or comma-separated on a single line). Frame as what the practice supports (e.g. 'Stress management', 'Better sleep') — avoid disease-claim wording."
              >
                Helps with (one per line)
              </LabelWithHint>
              <Textarea
                id="helps_with"
                value={draft.helps_with}
                onChange={(e) => setDraft({ ...draft, helps_with: e.target.value })}
                rows={4}
                placeholder={"Relaxation\nBetter sleep\nStress management"}
                className="mt-1.5"
              />
            </div>

            <div>
              <LabelWithHint
                htmlFor="what_to_expect"
                hint="Bullets under 'What to expect in a session' on the detail page. One per line — bullets may contain commas. Use these to encode safety guardrails (e.g. no breath-holding, no deep twists in pregnancy)."
              >
                What to expect (one per line)
              </LabelWithHint>
              <Textarea
                id="what_to_expect"
                value={draft.what_to_expect}
                onChange={(e) => setDraft({ ...draft, what_to_expect: e.target.value })}
                rows={5}
                placeholder={"A short check-in on how you feel\nGentle, low-impact movement at your pace\nA calm wind-down to finish"}
                className="mt-1.5"
              />
            </div>

            <div>
              <LabelWithHint
                htmlFor="who_for"
                hint="Shown in the 'Who it's for' card on the detail page. Describe the audience and reinforce that this complements — and is not a substitute for — medical care."
              >
                Who it&apos;s for
              </LabelWithHint>
              <Textarea
                id="who_for"
                value={draft.who_for}
                onChange={(e) => setDraft({ ...draft, who_for: e.target.value })}
                rows={2}
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelWithHint
                  hint="How vigorous the class is — drives the colour-coded badge on the class card."
                >
                  Intensity
                </LabelWithHint>
                <Select
                  value={draft.intensity}
                  onValueChange={(v) => v && setDraft({ ...draft, intensity: v as IntensityLevel })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gentle">Gentle</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="intense">Intense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <LabelWithHint
                  htmlFor="icon"
                  hint="Name of a lucide-react icon shown next to the class title (e.g. leaf, wind, moon)."
                >
                  Lucide icon name
                </LabelWithHint>
                <Input
                  id="icon"
                  value={draft.icon_name}
                  onChange={(e) => setDraft({ ...draft, icon_name: e.target.value })}
                  placeholder="leaf, wind, moon…"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <LabelWithHint hint="Thumbnail/hero image shown on the /classes grid card. JPG/PNG up to 10 MB.">
                Cover image
              </LabelWithHint>
              <MediaUploadField
                bucket={CLASS_MEDIA_BUCKET}
                folder={`class-covers/${draft.slug || "new"}`}
                accept="image"
                maxSizeMb={10}
                value={draft.cover_image_url}
                onChange={(url) => setDraft({ ...draft, cover_image_url: url })}
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelWithHint
                  htmlFor="props"
                  hint="Equipment students should have ready. Shown as 'What you'll need' on the class page."
                >
                  Props needed (comma-separated)
                </LabelWithHint>
                <Input
                  id="props"
                  value={draft.props_needed}
                  onChange={(e) => setDraft({ ...draft, props_needed: e.target.value })}
                  placeholder="mat, bolster, blocks"
                  className="mt-1.5"
                />
              </div>
              <div>
                <LabelWithHint
                  htmlFor="class_sort"
                  hint="Lower numbers appear first on the /classes grid. Default 0."
                >
                  Sort order
                </LabelWithHint>
                <Input
                  id="class_sort"
                  type="number"
                  value={draft.sort_order}
                  onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox
                checked={draft.is_active}
                onCheckedChange={(v) => setDraft({ ...draft, is_active: v === true })}
              />
              Visible to customers
              <FieldHint>
                Uncheck to hide this class from the marketing site and booking dropdowns without
                deleting it.
              </FieldHint>
            </Label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
