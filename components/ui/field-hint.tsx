"use client";

import * as React from "react";
import { Info } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type FieldHintProps = {
  /** One-sentence gist of what the adjacent form field is for. */
  children: React.ReactNode;
  /** Side the hint pops out. Defaults to "top". */
  side?: "top" | "right" | "bottom" | "left";
  /** Accessible label on the trigger button. Defaults to "More info". */
  label?: string;
};

/**
 * Small "i" button placed next to a form-field <Label>. Tapping or clicking it
 * opens a short explanation in a Popover — which, unlike a hover tooltip, works
 * on touch screens (the majority of our traffic) as well as for mouse and
 * keyboard users. It dismisses on outside-press or Escape.
 *
 * Rendered as `type="button"` so activating it inside a <label> never toggles
 * the associated input.
 */
export function FieldHint({
  children,
  side = "top",
  label = "More info",
}: FieldHintProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            <Info className="size-3.5" />
          </button>
        }
      />
      <PopoverContent
        side={side}
        className="w-auto max-w-xs text-xs leading-relaxed text-muted-foreground"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

type LabelWithHintProps = React.ComponentProps<typeof Label> & {
  /** Text shown when the user taps/clicks the info button. */
  hint: React.ReactNode;
  /** Side the hint pops out. Defaults to "top". */
  hintSide?: FieldHintProps["side"];
};

/**
 * Drop-in replacement for `<Label>` that appends an info icon with the given
 * hint. Use this anywhere a form field's label should be self-documenting.
 *
 * ```tsx
 * <LabelWithHint htmlFor="slug" hint="URL-safe identifier (e.g. 'aarti-deshmukh').">
 *   Slug
 * </LabelWithHint>
 * ```
 */
export function LabelWithHint({
  hint,
  hintSide,
  children,
  ...rest
}: LabelWithHintProps) {
  return (
    <Label {...rest}>
      {children}
      <FieldHint side={hintSide}>{hint}</FieldHint>
    </Label>
  );
}
