"use client";

import "react-phone-number-input/style.css";
import * as React from "react";
import PhoneInput, { type Country } from "react-phone-number-input";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Flags as same-origin images. react-phone-number-input otherwise loads each
// flag from purecatamphetamine.github.io, which our CSP `img-src` blocks. Only
// the closed button ever shows a flag (the native menu lists names only), so
// the browser fetches one SVG of about 1 KB for the selected country and
// nothing ships in the JS bundle. public/flags/3x2 is country-flag-icons' 3x2
// set for every country the picker offers; phone-field.test.ts fails if one is
// missing.
//
// Emoji flags (a regional-indicator pair) are not an option: Windows has no
// flag glyphs and draws the two letters instead, so a Windows customer saw a
// boxed "IN" where a Mac shows the Indian flag.
const FLAG_URL = "/flags/3x2/{XX}.svg";

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
  /** Restrict the dropdown to these ISO codes. Defaults to every country. */
  countries?: Country[];
  /**
   * Pre-selected country. Pass the visitor's own (`toPhoneCountry` in
   * lib/validation/phone.ts): with none, whatever they type gets a "+" in front
   * and a local number is read as another country's.
   */
  defaultCountry?: Country;
};

/**
 * Country-aware phone input shared by onboarding and profile. Renders a flag
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
  countries,
  defaultCountry,
  ...rest
}: PhoneFieldProps) {
  return (
    <PhoneInput
      international
      countries={countries}
      defaultCountry={defaultCountry}
      flagUrl={FLAG_URL}
      // `defaultCountry` seeds the calling code ("+91"), so a customer only types
      // their local number. It stays editable: GeoIP can be wrong (a VPN, someone
      // travelling), and the flag menu offers every country. A seeded code also
      // satisfies a native `required` check, so aria-required is what reaches
      // assistive tech; the real enforcement stays in the submit handler, which
      // validates and focuses this input via inputRef.
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
        // The library outlines a focused flag in its own teal (#03b2cb). These are
        // the two variables it actually reads; its root --PhoneInput-color--focus
        // is already resolved on :root, so overriding that one here does nothing.
        "[--PhoneInputCountryFlag-borderColor--focus:var(--ring)] [--PhoneInputCountrySelectArrow-color--focus:var(--ring)]",
        className,
      )}
      {...rest}
    />
  );
}
