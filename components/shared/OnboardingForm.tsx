"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AU_TIMEZONES, detectBrowserTimezone } from "@/lib/timezone";
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

export function OnboardingForm() {
  const router = useRouter();
  const [tz, setTz] = useState(detectBrowserTimezone());
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
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Session expired — please log in again.");
      router.push("/login");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        timezone: tz,
        experience_level: level as "beginner" | "intermediate" | "advanced",
        goals,
        marketing_opt_in: marketing,
      })
      .eq("id", user.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    track("onboarding_completed", { experience_level: level, goals_count: goals.length, timezone: tz });
    toast.success("All set. Now pick a teacher.");
    router.push("/dashboard/book");
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-7">
      <div>
        <Label className="mb-2 block">What&apos;s your level?</Label>
        <Select value={level} onValueChange={(v) => v && setLevel(v)}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="beginner">Beginner — new or returning</SelectItem>
            <SelectItem value="intermediate">Intermediate — a few months of practice</SelectItem>
            <SelectItem value="advanced">Advanced — regular practice</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block">Your timezone</Label>
        <Select value={tz} onValueChange={(v) => v && setTz(v)}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {AU_TIMEZONES.map((z) => (
              <SelectItem key={z.id} value={z.id}>
                {z.label} ({z.id.split("/")[1]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-3 block">What are you hoping to get out of this?</Label>
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

      <label className="flex items-start gap-3 text-sm text-muted-foreground">
        <Checkbox
          checked={marketing}
          onCheckedChange={(v) => setMarketing(v === true)}
        />
        <span>Email me tips, class drops, and the occasional offer.</span>
      </label>

      <Button type="submit" disabled={loading} size="lg" className="w-full h-12 rounded-full">
        {loading ? "Saving…" : "Continue to pick a teacher →"}
      </Button>
    </form>
  );
}
