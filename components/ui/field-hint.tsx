"use client";

import * as React from "react";
import { Info } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type FieldHintProps = {
  /** One-sentence gist of what the adjacent form field is for. */
  children: React.ReactNode;
  /** Side the tooltip pops out. Defaults to "top". */
  side?: "top" | "right" | "bottom" | "left";
  /** Accessible label on the trigger button. Defaults to "More info". */
  label?: string;
};

/**
 * Small "i" button placed next to a form-field <Label>. Shows a short
 * explanation on hover, focus, and tap — base-ui's Tooltip handles all three,
 * which covers desktop pointer users, keyboard users, and mobile alike.
 *
 * Rendered as `type="button"` so clicking it inside a <label> never propagates
 * to focus the associated input.
 */
export function FieldHint({
  children,
  side = "top",
  label = "More info",
}: FieldHintProps) {
  return (
    <Tooltip>
      <TooltipTrigger
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
      <TooltipContent
        side={side}
        className="max-w-xs whitespace-normal text-xs leading-relaxed"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

type LabelWithHintProps = React.ComponentProps<typeof Label> & {
  /** Text shown when the user hovers/taps the info button. */
  hint: React.ReactNode;
  /** Side the tooltip pops out. Defaults to "top". */
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
