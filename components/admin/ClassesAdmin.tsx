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
import type { ClassCategory, IntensityLevel } from "@/lib/supabase/types";

type Draft = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  intensity: IntensityLevel;
  icon_name: string;
  props_needed: string;
  is_active: boolean;
};

const EMPTY: Draft = {
  slug: "",
  name: "",
  description: "",
  intensity: "moderate",
  icon_name: "",
  props_needed: "",
  is_active: true,
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
      intensity: c.intensity,
      icon_name: c.icon_name ?? "",
      props_needed: c.props_needed.join(", "),
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
      intensity: draft.intensity,
      icon_name: draft.icon_name || null,
      props_needed: draft.props_needed
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
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
                hint="One-paragraph blurb shown on the class card and detail page."
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
