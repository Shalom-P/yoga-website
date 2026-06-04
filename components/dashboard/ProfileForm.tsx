"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldHint, LabelWithHint } from "@/components/ui/field-hint";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AU_TIMEZONES } from "@/lib/timezone";
import { toast } from "sonner";

type Initial = {
  full_name: string;
  email: string;
  phone: string;
  timezone: string;
  experience_level: "beginner" | "intermediate" | "advanced";
  marketing_opt_in: boolean;
};

export function ProfileForm({ initial }: { initial: Initial }) {
  const [state, setState] = useState(initial);
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!state.phone.trim()) {
      toast.error("Phone number is required.");
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: state.full_name,
        phone: state.phone.trim(),
        timezone: state.timezone,
        experience_level: state.experience_level,
        marketing_opt_in: state.marketing_opt_in,
      })
      .eq("id", user.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Saved.");
  }

  function set<K extends keyof Initial>(k: K, v: Initial[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <div>
        <LabelWithHint
          htmlFor="full_name"
          hint="How teachers will greet you in class. Visible only on your own bookings and to admins."
        >
          Full name
        </LabelWithHint>
        <Input id="full_name" value={state.full_name} onChange={(e) => set("full_name", e.target.value)} className="mt-1.5" />
      </div>
      <div>
        <LabelWithHint
          htmlFor="email"
          hint="Comes from your login provider (Google or phone). To change, sign in with a different account."
        >
          Email
        </LabelWithHint>
        <Input id="email" type="email" value={state.email} disabled className="mt-1.5" />
        <p className="text-xs text-muted-foreground mt-1">Email is set by your login provider.</p>
      </div>
      <div>
        <LabelWithHint
          htmlFor="phone"
          hint="Required. Used to confirm your booking and send SMS reminders 24h before class."
        >
          Phone
        </LabelWithHint>
        <Input id="phone" type="tel" required value={state.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className="mt-1.5" placeholder="+61 …" />
      </div>
      <div>
        <LabelWithHint hint="Your local timezone. Drives the times shown on bookings, reminders, and the slot picker.">
          Timezone
        </LabelWithHint>
        <Select value={state.timezone} onValueChange={(v) => v && set("timezone", v)}>
          <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {AU_TIMEZONES.map((z) => (
              <SelectItem key={z.id} value={z.id}>{z.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <LabelWithHint hint="Helps teachers tailor cues. You can change this any time.">
          Experience level
        </LabelWithHint>
        <Select value={state.experience_level} onValueChange={(v) => v && set("experience_level", v as Initial["experience_level"])}>
          <SelectTrigger className="mt-1.5 h-11 capitalize"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="beginner">Beginner</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Label className="items-center gap-3 text-sm font-normal">
        <Checkbox checked={state.marketing_opt_in} onCheckedChange={(v) => set("marketing_opt_in", v === true)} />
        <span>Email me tips, drops, and the occasional offer.</span>
        <FieldHint>
          Optional — class reminders and receipts still go out regardless.
        </FieldHint>
      </Label>
      <Button type="submit" disabled={loading} className="rounded-full">
        {loading ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
