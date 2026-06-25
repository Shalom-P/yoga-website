import { cn } from "@/lib/utils";

/**
 * Deterministic yoga-pose avatar for a profile.
 *
 * Hashes a stable seed (email, falling back to name) to a fixed
 * (pose, tint) pair, so a given person always gets the same little
 * stick figure + brand-tinted circle. Purely decorative — render the
 * real name/email alongside it and keep this `aria-hidden`.
 *
 *   <YogaAvatar seed={userEmail} className="size-9 shrink-0" />
 *
 * Poses are compact line-art asanas drawn in a 48×48 box, kept within
 * ~x[7,41] y[6,42] so the round mask never clips them.
 */

type Pose = { readonly name: string; readonly inner: React.ReactNode };

export const YOGA_POSES: readonly Pose[] = [
  {
    name: "lotus",
    inner: (
      <>
        <circle cx="24" cy="13" r="4" />
        <path d="M24 17 L24 27" />
        <path d="M24 21 C20 23 16 26 14 30 C18 31 21 31 24 30" />
        <path d="M24 21 C28 23 32 26 34 30 C30 31 27 31 24 30" />
        <path d="M15 30 C19 33 29 33 33 30" />
        <path d="M24 27 C21 28 18.5 29.5 17 32" />
        <path d="M24 27 C27 28 29.5 29.5 31 32" />
      </>
    ),
  },
  {
    name: "tree",
    inner: (
      <>
        <circle cx="24" cy="11" r="3.2" />
        <path d="M24 14.2 L24 27" />
        <path d="M24 17 L18 9" />
        <path d="M24 17 L30 9" />
        <path d="M24 27 L24 40" />
        <path d="M24 27 L32 31 L23 33" />
      </>
    ),
  },
  {
    name: "warrior-2",
    inner: (
      <>
        <circle cx="24" cy="10" r="3" />
        <path d="M24 13 L24 24" />
        <path d="M9 19 L39 19" />
        <path d="M24 24 L13 32 L13 41" />
        <path d="M24 24 L35 41" />
      </>
    ),
  },
  {
    name: "boat",
    inner: (
      <>
        <circle cx="14" cy="17" r="3.2" />
        <path d="M16 19 L22 35" />
        <path d="M22 35 L35 15" />
        <path d="M17 21 L31 24" />
      </>
    ),
  },
  {
    name: "cobra",
    inner: (
      <>
        <circle cx="13.5" cy="14" r="3.4" />
        <path d="M16 16 Q22 30 32 34" />
        <path d="M32 34 L39 36" />
        <path d="M16.5 17 L15 37" />
        <path d="M9 37 L39 37" />
      </>
    ),
  },
  {
    name: "childs-pose",
    inner: (
      <>
        <circle cx="13" cy="30" r="3.4" />
        <path d="M16 30 C23 18 30 18 36 23" />
        <path d="M36 23 C39 27 38 33 33 34" />
        <path d="M33 34 L20 34" />
        <path d="M20 34 L16 30" />
        <path d="M16 31 L11 35" />
        <path d="M16 32 L13 35" />
      </>
    ),
  },
  {
    name: "bridge",
    inner: (
      <>
        <circle cx="11" cy="33" r="3.2" />
        <path d="M15 35 C22 16 30 16 33 24" />
        <path d="M33 24 L33 35" />
        <path d="M37 35 L33 24" />
        <path d="M9 35 L39 35" />
        <path d="M15 35 L11 28" />
      </>
    ),
  },
];

export const YOGA_TINTS: readonly { bg: string; stroke: string }[] = [
  { bg: "#dceae0", stroke: "#0f5c4e" }, // mint · teal
  { bg: "#f6eccb", stroke: "#0f5c4e" }, // butter · teal
  { bg: "#dee8ea", stroke: "#0f5c4e" }, // sky · teal
  { bg: "#fbe3d5", stroke: "#cf3a1f" }, // peach · coral
  { bg: "#f2ecdd", stroke: "#cf3a1f" }, // sand · coral
  { bg: "#f2ecdd", stroke: "#0f5c4e" }, // sand · teal
];

/** FNV-1a 32-bit — small, stable, well-spread across short seeds. */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function YogaAvatar({
  seed,
  className,
}: {
  seed: string;
  className?: string;
}) {
  const h = hashSeed((seed || "").trim().toLowerCase());
  const pose = YOGA_POSES[h % YOGA_POSES.length];
  // Divide out the pose bits so pose and tint are chosen independently.
  const tint = YOGA_TINTS[Math.floor(h / YOGA_POSES.length) % YOGA_TINTS.length];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "shadow-[inset_0_0_0_1px_rgba(22,53,46,0.07)]",
        className
      )}
      style={{ backgroundColor: tint.bg }}
    >
      <svg
        viewBox="0 0 48 48"
        className="size-full"
        fill="none"
        stroke={tint.stroke}
        strokeWidth={2.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {pose.inner}
      </svg>
    </span>
  );
}
