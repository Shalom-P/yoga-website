"use client";

import "react-phone-number-input/style.css";
import * as React from "react";
import PhoneInput, { type Country } from "react-phone-number-input";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES } from "@/lib/validation/phone";

// react-phone-number-input drives focus/caret through a ref, so the custom input
// must forward it. shadcn's Input passes ref straight through to the base-ui
// primitive (React 19 ref-as-prop), so this stays a thin adapter. The wrapper
// owns the border + focus ring, so the inner input is stripped bare.
const PhoneTextInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function PhoneTextInput({ className, ...props }, ref) {
    return (
      <Input
        ref={ref}
        className={cn(
          "h-auto flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent",
          className,
        )}
        {...props}
      />
    );
  },
);

type PhoneFieldProps = {
  /** E.164 string (e.g. "+971501234567"), or "" when empty. */
  value: string;
  /** Receives E.164 while the number is parseable, "" otherwise. */
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** ISO codes offered in the flag dropdown. Defaults to AU + IN. */
  countries?: Country[];
  defaultCountry?: Country;
};

/**
 * Country-aware phone input shared by login, booking, and profile. Renders a flag
 * dropdown + format-as-you-type field and always reports its `value` as E.164, so
 * callers never normalize by hand — they just validate with isValidPhone() and
 * store the value. See lib/validation/phone.ts.
 */
export function PhoneField({
  value,
  onChange,
  className,
  countries = PHONE_COUNTRIES,
  defaultCountry = DEFAULT_PHONE_COUNTRY,
  ...rest
}: PhoneFieldProps) {
  return (
    <PhoneInput
      international
      countryCallingCodeEditable={false}
      countries={countries}
      defaultCountry={defaultCountry}
      value={value || undefined}
      onChange={(v) => onChange(v ?? "")}
      inputComponent={PhoneTextInput}
      className={cn(
        "flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-base transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:text-sm dark:bg-input/30",
        className,
      )}
      {...rest}
    />
  );
}
