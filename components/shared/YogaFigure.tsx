import { cn } from "@/lib/utils";

/**
 * Decorative line-art yoga figures — the My Yoga Classes motif.
 * Place them as accents (cards, section corners, CTAs). Inherit color via
 * `currentColor`; add `myc-float`/`myc-float2`/`myc-breathe` for gentle motion.
 *
 * <YogaFigure pose="tree" className="myc-float w-12 text-primary" />
 */
type Pose = "meditate" | "tree" | "warrior" | "reach";

const PATHS: Record<Pose, { vb: string; body: React.ReactNode }> = {
  meditate: {
    vb: "0 0 96 96",
    body: (
      <>
        <circle cx="48" cy="13.5" r="11.3" />
        <path d="M17.5 71 C 22 58 32 42 44.5 30 C 49 33 54 36.5 55 40.5 C 56 44.5 52.5 49.8 48 52.8 C 43.5 55.8 28 63.7 17.5 71 Z" />
        <path d="M78.5 71 C 74 58 64 42 51.5 30 C 47 33 42 36.5 41 40.5 C 40 44.5 43.5 49.8 48 52.8 C 52.5 55.8 68 63.7 78.5 71 Z" />
        <path d="M48 84 C 42 81.8 34 74.5 26 74.5 C 18 74.5 6 77.8 6 84 C 6 90.2 18 93.5 26 93.5 C 34 93.5 42 86.2 48 84 C 54 81.8 62 74.5 70 74.5 C 78 74.5 90 77.8 90 84 C 90 90.2 78 93.5 70 93.5 C 62 93.5 54 86.2 48 84 Z" />
      </>
    ),
  },
  tree: {
    vb: "0 0 64 104",
    body: (
      <>
        <circle cx="32" cy="16" r="8" />
        <line x1="32" y1="24" x2="32" y2="60" />
        <line x1="32" y1="60" x2="30" y2="98" />
        <path d="M32 60 C 19 60 15 47 23 44 C 28 42 31 52 32 55" />
        <path d="M32 30 L 21 9" />
        <path d="M32 30 L 43 9" />
        <path d="M21 9 L 32 3 L 43 9" />
      </>
    ),
  },
  warrior: {
    vb: "0 0 104 96",
    body: (
      <>
        <circle cx="52" cy="16" r="8" />
        <line x1="52" y1="24" x2="52" y2="52" />
        <path d="M52 52 L 26 86" />
        <path d="M52 52 L 82 86" />
        <line x1="20" y1="42" x2="84" y2="42" />
      </>
    ),
  },
  reach: {
    vb: "0 0 64 104",
    body: (
      <>
        <circle cx="32" cy="18" r="8" />
        <line x1="32" y1="26" x2="32" y2="64" />
        <line x1="32" y1="64" x2="25" y2="98" />
        <line x1="32" y1="64" x2="39" y2="98" />
        <line x1="32" y1="33" x2="17" y2="10" />
        <line x1="32" y1="33" x2="47" y2="10" />
      </>
    ),
  },
};

export function YogaFigure({
  pose = "meditate",
  className,
}: {
  pose?: Pose;
  className?: string;
}) {
  const { vb, body } = PATHS[pose];
  return (
    <svg
      viewBox={vb}
      className={cn("block", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {body}
    </svg>
  );
}
