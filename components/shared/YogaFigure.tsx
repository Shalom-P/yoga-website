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
    vb: "0 0 96 80",
    body: (
      <>
        <circle cx="48" cy="16" r="8" />
        <path d="M48 25 C 43 34 43 42 48 48" />
        <path d="M48 48 C 31 48 19 58 13 66 L 83 66 C 77 58 65 48 48 48 Z" />
        <path d="M48 33 C 35 35 25 47 21 62" />
        <path d="M48 33 C 61 35 71 47 75 62" />
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
