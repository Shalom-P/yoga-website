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
        viewBox="0 0 96 96"
        className={cn("size-7", breathe && "myc-breathe")}
        fill="none"
        stroke="currentColor"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="48" cy="13.5" r="11.3" />
        <path d="M17.5 71 C 22 58 32 42 44.5 30 C 49 33 54 36.5 55 40.5 C 56 44.5 52.5 49.8 48 52.8 C 43.5 55.8 28 63.7 17.5 71 Z" />
        <path d="M78.5 71 C 74 58 64 42 51.5 30 C 47 33 42 36.5 41 40.5 C 40 44.5 43.5 49.8 48 52.8 C 52.5 55.8 68 63.7 78.5 71 Z" />
        <path d="M48 84 C 42 81.8 34 74.5 26 74.5 C 18 74.5 6 77.8 6 84 C 6 90.2 18 93.5 26 93.5 C 34 93.5 42 86.2 48 84 C 54 81.8 62 74.5 70 74.5 C 78 74.5 90 77.8 90 84 C 90 90.2 78 93.5 70 93.5 C 62 93.5 54 86.2 48 84 Z" />
      </svg>
    </span>
  );
}
