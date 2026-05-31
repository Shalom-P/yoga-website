import { cn } from "@/lib/utils";

/**
 * My Yoga Classes brand mark — a continuous-line seated meditation figure.
 * `breathe` adds a gentle scale loop (use in the live nav; omit for footer/print).
 * Inherits color via `currentColor`, so set text color on the wrapper.
 */
export function BrandMark({
  className,
  breathe = false,
}: {
  className?: string;
  breathe?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-[42px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground",
        className,
      )}
    >
      <svg
        viewBox="0 0 96 80"
        className={cn("size-7", breathe && "myc-breathe")}
        fill="none"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="48" cy="16" r="8" />
        <path d="M48 25 C 43 34 43 42 48 48" />
        <path d="M48 48 C 31 48 19 58 13 66 L 83 66 C 77 58 65 48 48 48 Z" />
        <path d="M48 33 C 35 35 25 47 21 62" />
        <path d="M48 33 C 61 35 71 47 75 62" />
      </svg>
    </span>
  );
}
