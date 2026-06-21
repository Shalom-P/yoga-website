"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldHint, LabelWithHint } from "@/components/ui/field-hint";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { detectBrowserTimezone } from "@/lib/timezone";
import { friendlyFormError } from "@/lib/ui/errors";
import { track } from "@/lib/analytics/events";

const GOALS = [
  "Reduce stress",
  "Improve flexibility",
  "Relieve back pain",
  "Build strength",
  "Sleep better",
  "Prenatal / postnatal care",
  "Meditation / focus",
] as const;

export function OnboardingForm({
  initialFullName = "",
  next = "/dashboard/book",
}: {
  initialFullName?: string;
  next?: string;
}) {
  const router = useRouter();
  // full name field state — prefilled from the profile (Google logins
  // already carry a name; email-OTP users start blank).
  const [fullName, setFullName] = useState(initialFullName);
  // default to the user's real detected timezone; they can change it below.
  const [tz, setTz] = useState(() => detectBrowserTimezone());
  const [level, setLevel] = useState("beginner");
  const [goals, setGoals] = useState<string[]>([]);
  const [marketing, setMarketing] = useState(true);
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  function toggleGoal(g: string) {
    setGoals((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // validate full name before proceeding
    if (!fullName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // reset loading before early return so button isn't stuck
      setLoading(false);
      toast.error("Session expired — please log in again.");
      router.push("/login");
      return;
    }
    // Upsert (not update): a plain UPDATE matching zero rows (profile row
    // missing because the signup trigger didn't fire) reports success, so
    // onboarding silently no-ops and re-appears on every login. The
    // `.select("id")` keeps any remaining zero-row case visible.
    const { data: updated, error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        // persist full name
        full_name: fullName.trim(),
        timezone: tz,
        experience_level: level as "beginner" | "intermediate" | "advanced",
        goals,
        marketing_opt_in: marketing,
      })
      .select("id");
    setLoading(false);
    if (error) return toast.error(friendlyFormError(error.message));
    if (!updated?.length) {
      return toast.error("We couldn't save your profile. Please try again or contact support.");
    }
    track("onboarding_completed", { experience_level: level, goals_count: goals.length, timezone: tz });
    toast.success("All set. Now pick a teacher.");
    router.push(next);
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-7">
      {/* Full name field — email-OTP sign-ups arrive with a blank name, so we
          collect it here during onboarding. */}
      <div>
        <Label htmlFor="full-name" className="mb-2 block">
          Full name <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
        <Input
          id="full-name"
          type="text"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your full name"
          className="h-11"
        />
      </div>

      <div>
        <LabelWithHint
          className="mb-2"
          hint="Helps teachers pitch the right level of cues — pick whichever feels honest, you can change it later."
        >
          What&apos;s your level?
        </LabelWithHint>
        <Select value={level} onValueChange={(v) => v && setLevel(v)}>
          <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="beginner">Beginner — new or returning</SelectItem>
            <SelectItem value="intermediate">Intermediate — a few months of practice</SelectItem>
            <SelectItem value="advanced">Advanced — regular practice</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <LabelWithHint
          className="mb-2"
          hint="Auto-detected from your device — used to show class times in hours that make sense to you (not the teacher's IST). Change it if it's wrong."
        >
          Your timezone
        </LabelWithHint>
        <TimezoneSelect value={tz} onValueChange={setTz} />
      </div>

      <div>
        <LabelWithHint
          className="mb-3"
          hint="Tick anything that feels relevant — we use this to recommend teachers and classes."
        >
          What are you hoping to get out of this?
        </LabelWithHint>
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <button
              type="button"
              key={g}
              onClick={() => toggleGoal(g)}
              className={[
                "rounded-full border px-3.5 py-1.5 text-sm transition",
                goals.includes(g)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:border-primary/50",
              ].join(" ")}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <Label className="items-start gap-3 text-sm font-normal text-muted-foreground">
        <Checkbox
          checked={marketing}
          onCheckedChange={(v) => setMarketing(v === true)}
        />
        <span>Email me tips, class drops, and the occasional offer.</span>
        <FieldHint>
          Optional — class reminders and booking confirmations still go out either way.
        </FieldHint>
      </Label>

      <Button type="submit" disabled={loading} size="lg" className="w-full h-12 rounded-full">
        {loading ? "Saving…" : "Continue to pick a teacher →"}
      </Button>
    </form>
  );
}
