"use client";

import "react-phone-number-input/style.css";
import * as React from "react";
import PhoneInput, { type Country, type Flags } from "react-phone-number-input";
import AE from "country-flag-icons/react/3x2/AE";
import IN from "country-flag-icons/react/3x2/IN";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES } from "@/lib/validation/phone";

// Flags as inline SVG components. Without this, react-phone-number-input loads
// each flag from purecatamphetamine.github.io, which our CSP `img-src` blocks,
// so the selector renders a broken image. Allow-listing that origin would put a
// third-party asset on the sign-up path; bundling the two flags we actually
// offer is smaller and offline-safe. Imported per country (not the whole
// `react-phone-number-input/flags` map) to keep ~250 unused flags out of the
// bundle. A caller passing extra `countries` falls back to the remote image for
// those, so add its flag here too.
const FLAGS: Flags = { AE, IN };

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
  /**
   * Marks the number as mandatory. Sets `aria-required` on the inner input so
   * screen readers announce the requirement — a visual "*" next to the label is
   * usually `aria-hidden`, so it carries nothing to assistive tech on its own.
   */
  required?: boolean;
  /**
   * Ref to the inner <input>, so a caller that rejects a submit can move focus
   * back to the field rather than relying on a transient toast.
   */
  inputRef?: React.Ref<HTMLInputElement>;
  /** ISO codes offered in the flag dropdown. Defaults to AE + IN. */
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
  required,
  inputRef,
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
      flags={FLAGS}
      // `international` seeds the input with the country calling code ("+971"),
      // so the native `required` check is already satisfied before any digits
      // are typed and cannot be the guard here. aria-required is what actually
      // reaches assistive tech; the real enforcement stays in the submit
      // handler, which validates and focuses this input via inputRef.
      aria-required={required || undefined}
      // Must go through `ref`, not the library's `inputRef` prop: PhoneInput's
      // forwardRef wrapper spreads `{inputRef: ref}` last, so a caller-supplied
      // `inputRef` is silently overwritten with the (absent) forwarded ref and
      // never populates. The cast is because the library types this ref as its
      // internal class component while at runtime it hands over the <input>
      // (setInputRef -> setRefsValue); verified by focusing it from a caller.
      ref={inputRef as React.ComponentProps<typeof PhoneInput>["ref"]}
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
