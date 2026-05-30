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
    <section className={`px-7 pt-32 pb-12 ${BG_CLASS[background]}`}>
      <div
        className={`mx-auto max-w-3xl ${centered ? "text-center" : "text-left max-w-4xl"}`}
      >
        <div className={`myc-eyebrow mb-4 ${centered ? "justify-center" : ""}`}>
          <span className="myc-dot" aria-hidden="true" />
          {eyebrow}
        </div>
        <h1 className="text-[clamp(2.75rem,6vw,4.5rem)] leading-[1.08] tracking-tight text-balance [&_em]:text-accent [&_em]:italic">
          {title}
        </h1>
        {subhead ? (
          <p
            className={`mt-5 text-lg text-muted-foreground text-pretty ${
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
