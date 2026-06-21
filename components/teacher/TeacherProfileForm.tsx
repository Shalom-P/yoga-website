"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LabelWithHint } from "@/components/ui/field-hint";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { friendlyFormError } from "@/lib/ui/errors";
import { toast } from "sonner";

type Initial = {
  display_name: string;
  headline: string;
  bio: string;
  specialties: string[];
  languages: string[];
  years_experience: number;
};

function toList(csv: string): string[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function TeacherProfileForm({
  teacherId,
  initial,
}: {
  teacherId: string;
  initial: Initial;
}) {
  const supabase = createSupabaseBrowserClient();
  const [displayName, setDisplayName] = useState(initial.display_name);
  const [headline, setHeadline] = useState(initial.headline);
  const [bio, setBio] = useState(initial.bio);
  const [specialties, setSpecialties] = useState(initial.specialties.join(", "));
  const [languages, setLanguages] = useState(initial.languages.join(", "));
  const [years, setYears] = useState(String(initial.years_experience));
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Your display name can't be empty.");
      return;
    }
    const yearsNum = Number(years);
    if (!Number.isInteger(yearsNum) || yearsNum < 0 || yearsNum > 80) {
      toast.error("Years of experience must be a whole number between 0 and 80.");
      return;
    }
    setLoading(true);
    // Relies on the teachers_self_update RLS + tg_teachers_lock_admin_cols column
    // guard (0025): admin-only fields are pinned server-side, so this update only
    // touches the public profile fields below. `.select("id")` surfaces a no-op
    // (RLS mismatch) that supabase-js would otherwise report as success.
    const { data: updated, error } = await supabase
      .from("teachers")
      .update({
        display_name: displayName.trim(),
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        specialties: toList(specialties),
        languages: toList(languages),
        years_experience: yearsNum,
      })
      .eq("id", teacherId)
      .select("id");
    setLoading(false);
    if (error) return toast.error(friendlyFormError(error.message));
    if (!updated?.length) {
      return toast.error("We couldn't save your changes. Please try again or contact the studio.");
    }
    toast.success("Profile saved.");
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <div>
        <LabelWithHint htmlFor="display_name" hint="The name students see on your public page and on their bookings.">
          Display name
        </LabelWithHint>
        <Input
          id="display_name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <LabelWithHint htmlFor="headline" hint="A short one-liner under your name, e.g. “Prenatal & gentle Hatha specialist”.">
          Headline
        </LabelWithHint>
        <Input
          id="headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          className="mt-1.5"
          placeholder="Short tagline"
        />
      </div>
      <div>
        <LabelWithHint htmlFor="bio" hint="Tell students about your style and background. A few sentences is plenty.">
          Bio
        </LabelWithHint>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={6}
          className="mt-1.5"
        />
      </div>
      <div>
        <LabelWithHint htmlFor="specialties" hint="Comma-separated, e.g. “Hatha, Prenatal, Restorative”.">
          Specialties
        </LabelWithHint>
        <Input
          id="specialties"
          value={specialties}
          onChange={(e) => setSpecialties(e.target.value)}
          className="mt-1.5"
          placeholder="Hatha, Prenatal, Restorative"
        />
      </div>
      <div>
        <LabelWithHint htmlFor="languages" hint="Comma-separated, e.g. “English, Hindi, Tamil”.">
          Languages
        </LabelWithHint>
        <Input
          id="languages"
          value={languages}
          onChange={(e) => setLanguages(e.target.value)}
          className="mt-1.5"
          placeholder="English, Hindi"
        />
      </div>
      <div>
        <LabelWithHint htmlFor="years" hint="Whole number of years you've been teaching.">
          Years of experience
        </LabelWithHint>
        <Input
          id="years"
          type="number"
          min={0}
          max={80}
          step={1}
          value={years}
          onChange={(e) => setYears(e.target.value)}
          className="mt-1.5 w-32"
        />
      </div>
      <Button type="submit" disabled={loading} className="rounded-full">
        {loading ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
