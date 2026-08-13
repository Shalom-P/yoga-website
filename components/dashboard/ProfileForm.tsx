"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { PhoneField } from "@/components/ui/phone-field";
import { Label } from "@/components/ui/label";
import { FieldHint, LabelWithHint } from "@/components/ui/field-hint";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toE164, PHONE_ERROR_MESSAGE } from "@/lib/validation/phone";
import { friendlyFormError } from "@/lib/ui/errors";
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
  const phoneRef = useRef<HTMLInputElement>(null);
  const supabase = createSupabaseBrowserClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Phone is mandatory (collected at sign-up), so it can't be cleared here
    // either. Legacy profiles created before that have to fill it in on the
    // first save.
    const e164 = toE164(state.phone);
    if (!e164) {
      phoneRef.current?.focus();
      toast.error(state.phone.trim() ? PHONE_ERROR_MESSAGE : "Please enter your mobile number.");
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      toast.error("Session expired. Please log in again.");
      window.location.href = "/login?next=/dashboard/profile";
      return;
    }
    // `.select("id")` surfaces a zero-row update (missing profile row / RLS
    // mismatch), which supabase-js otherwise reports as success.
    const { data: updated, error } = await supabase
      .from("profiles")
      .update({
        full_name: state.full_name,
        phone: e164,
        timezone: state.timezone,
        experience_level: state.experience_level,
        marketing_opt_in: state.marketing_opt_in,
      })
      .eq("id", user.id)
      .select("id");
    setLoading(false);
    if (error) return toast.error(friendlyFormError(error.message));
    if (!updated?.length) {
      return toast.error("We couldn't save your changes. Please try again or contact support.");
    }
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
          hint="Comes from your login provider (Google or email). To change, sign in with a different account."
        >
          Email
        </LabelWithHint>
        <Input id="email" type="email" value={state.email} disabled className="mt-1.5" />
        <p className="text-xs text-muted-foreground mt-1">Email is set by your login provider.</p>
      </div>
      <div>
        <LabelWithHint
          htmlFor="phone"
          hint="We use this only to reach you about your sessions, never for marketing."
        >
          Mobile number <span aria-hidden="true" className="text-destructive">*</span>
        </LabelWithHint>
        <PhoneField
          id="phone"
          required
          inputRef={phoneRef}
          value={state.phone ?? ""}
          onChange={(v) => set("phone", v)}
          className="mt-1.5"
        />
      </div>
      <div>
        <LabelWithHint hint="Your local timezone. Drives the times shown on bookings, reminders, and the slot picker.">
          Timezone
        </LabelWithHint>
        <div className="mt-1.5">
          <TimezoneSelect value={state.timezone} onValueChange={(v) => set("timezone", v)} />
        </div>
      </div>
      <div>
        <LabelWithHint hint="Helps teachers tailor cues. You can change this any time.">
          Experience level
        </LabelWithHint>
        <Select value={state.experience_level} onValueChange={(v) => v && set("experience_level", v as Initial["experience_level"])}>
          <SelectTrigger className="mt-1.5 h-11 w-full capitalize"><SelectValue /></SelectTrigger>
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
          Optional. Class reminders and receipts still go out regardless.
        </FieldHint>
      </Label>
      <Button type="submit" disabled={loading} className="rounded-full">
        {loading ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
