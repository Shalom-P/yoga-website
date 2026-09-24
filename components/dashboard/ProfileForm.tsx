"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { PhoneField } from "@/components/ui/phone-field";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toE164, phoneErrorMessage } from "@/lib/validation/phone";
import type { CountryCode } from "libphonenumber-js";
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

export function ProfileForm({
  initial,
  defaultPhoneCountry,
}: {
  initial: Initial;
  /** The visitor's GeoIP country, pre-selected while no number is saved yet. */
  defaultPhoneCountry?: CountryCode;
}) {
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
      toast.error(state.phone.trim() ? phoneErrorMessage(defaultPhoneCountry) : "Please enter your mobile number.");
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
    <form onSubmit={onSubmit} className="myc-glass mt-7 flex flex-col gap-[22px] p-7">
      <Field
        htmlFor="full_name"
        label="Full name"
        hint="How teachers will greet you in class. Visible only on your own bookings and to admins."
      >
        <Input
          id="full_name"
          value={state.full_name}
          onChange={(e) => set("full_name", e.target.value)}
        />
      </Field>

      <Field
        htmlFor="email"
        label="Email"
        hint="Email is set by your login provider. To change it, sign in with a different account."
      >
        <Input id="email" type="email" value={state.email} disabled />
      </Field>

      <Field
        htmlFor="phone"
        label={
          <>
            Mobile number{" "}
            <span aria-hidden="true" className="text-accent">
              *
            </span>
          </>
        }
        hint="We use this only to reach you about your sessions, never for marketing."
      >
        <PhoneField
          id="phone"
          required
          inputRef={phoneRef}
          value={state.phone ?? ""}
          onChange={(v) => set("phone", v)}
          defaultCountry={defaultPhoneCountry}
        />
      </Field>

      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <Field
          label="Timezone"
          hint="Drives the times shown on bookings, reminders and the slot picker."
        >
          <TimezoneSelect
            value={state.timezone}
            onValueChange={(v) => set("timezone", v)}
          />
        </Field>
        <Field label="Experience level" hint="Helps teachers tailor cues. Change it any time.">
          <Select
            value={state.experience_level}
            onValueChange={(v) => v && set("experience_level", v as Initial["experience_level"])}
          >
            <SelectTrigger className="h-11 w-full capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Label className="items-start gap-3 text-sm font-normal">
        <Checkbox
          className="mt-0.5"
          checked={state.marketing_opt_in}
          onCheckedChange={(v) => set("marketing_opt_in", v === true)}
        />
        <span>
          Email me tips, drops, and the occasional offer.
          <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
            Optional. Class reminders and receipts still go out regardless.
          </span>
        </span>
      </Label>

      <div>
        <Button
          type="submit"
          disabled={loading}
          className="h-11 bg-accent px-5 text-[14.5px] font-semibold text-accent-foreground hover:bg-[var(--myc-accent-hover)]"
        >
          {loading ? "Saving\u2026" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

/** Label, control and an always-visible hint, the way the canvas lays a field
 *  out. The popover <FieldHint> stays the pattern for dense admin forms; this
 *  one is short enough to spell every hint out. */
function Field({
  htmlFor,
  label,
  hint,
  children,
}: {
  htmlFor?: string;
  label: React.ReactNode;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      <Label htmlFor={htmlFor} className="text-[13px] font-semibold text-foreground/85">
        {label}
      </Label>
      {children}
      <p className="text-[12.5px] text-muted-foreground">{hint}</p>
    </div>
  );
}
