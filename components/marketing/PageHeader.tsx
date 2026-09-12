import type { ReactNode } from "react";

type PageHeaderProps = {
  /** Small uppercase kicker above the title (rendered with the coral dot). */
  eyebrow: string;
  /** Main heading. Wrap part of it in <em> for the coral-italic flourish. */
  title: ReactNode;
  /** Optional supporting paragraph under the title. */
  subhead?: ReactNode;
  /** Pastel section background to match the design's alternating blocks. */
  background?: "cream" | "mint" | "peach" | "none";
  /** Center the header (default) or left-align it. */
  align?: "center" | "left";
};

const BG_CLASS: Record<NonNullable<PageHeaderProps["background"]>, string> = {
  cream: "myc-sec-cream",
  mint: "myc-sec-mint",
  peach: "myc-sec-peach",
  none: "",
};

/**
 * Shared marketing page header — the design's eyebrow + serif title idiom.
 * Use across every (marketing) page so the look is consistent with the home
 * page hero/section headers. Wrap accent words in <em> to get the coral italic.
 */
export function PageHeader({
  eyebrow,
  title,
  subhead,
  background = "none",
  align = "center",
}: PageHeaderProps) {
  const centered = align === "center";
  return (
    <section
      className={`relative overflow-hidden px-6 pb-10 pt-[106px] ${BG_CLASS[background]}`}
    >
      {/* Soft teal bloom behind the title, matching the landing hero's atmosphere */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-[35%] h-[600px] w-[600px] rounded-full blur-[140px] ${
          centered ? "left-1/2 -translate-x-1/2" : "-right-[10%]"
        }`}
        style={{ background: "var(--myc-glow-1)" }}
      />
      <div
        className={`relative mx-auto max-w-3xl ${centered ? "text-center" : "text-left max-w-4xl"}`}
      >
        <div className="mb-[18px] text-[13px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {eyebrow}
        </div>
        <h1 className="text-[clamp(2.6rem,5.5vw,4.8rem)] font-medium leading-[1.04] tracking-[-0.015em] text-balance [&_em]:italic [&_em]:text-accent">
          {title}
        </h1>
        {subhead ? (
          <p
            className={`mt-[22px] text-lg text-muted-foreground text-pretty ${
              centered ? "mx-auto max-w-2xl" : "max-w-2xl"
            }`}
          >
            {subhead}
          </p>
        ) : null}
      </div>
    </section>
  );
}
