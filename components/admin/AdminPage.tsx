import { cn } from "@/lib/utils";

/**
 * The shared page furniture of the admin console, from the Admin design canvas.
 *
 * Every admin screen there is the same shape: an eyebrow, a display-serif
 * title, an optional one-line explanation, and actions pushed to the right;
 * then a glass panel wrapping a dense table. Before this the sixteen pages each
 * hand-rolled a `text-2xl` header and the eight table components each rolled
 * their own <table>, so a change to the idiom meant editing all of them.
 */

export function AdminPageHeader({
  eyebrow,
  title,
  sub,
  actions,
  /** Overview pulses its dot to read as "live"; the table pages keep it still. */
  pulse = false,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-wrap items-end justify-between gap-4", className)}
    >
      <div>
        <div className="myc-eyebrow">
          <span className={cn("myc-dot", pulse && "myc-pulse-dot")} />
          {eyebrow}
        </div>
        <h1 className="mt-2.5 font-[family-name:var(--font-cormorant)] text-[clamp(2.2rem,3.6vw,3rem)] font-medium leading-[1.05] tracking-[-0.015em]">
          {title}
        </h1>
        {sub && <p className="mt-2 max-w-[46rem] text-sm text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Solid accent button, the canvas' primary action. */
export function AdminAction({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 border border-accent bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-[var(--myc-accent-hover)] disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

/** Glass panel that wraps a dense table and scrolls it horizontally. */
export function AdminPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("myc-glass overflow-hidden", className)}>{children}</div>;
}

/**
 * `minWidth` keeps a dense table from collapsing its columns on a narrow
 * viewport; the panel scrolls it instead. Pass the px figure the canvas gives
 * for that screen.
 */
export function AdminTable({
  minWidth = 720,
  children,
}: {
  minWidth?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table
        style={{ minWidth: `${minWidth}px` }}
        className="w-full border-collapse text-[13.5px]"
      >
        {children}
      </table>
    </div>
  );
}

export function ATh({
  children,
  className,
  ...props
}: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "whitespace-nowrap bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function ATd({
  children,
  className,
  ...props
}: React.ComponentProps<"td">) {
  return (
    <td
      className={cn("border-t border-border px-4 py-3 align-middle", className)}
      {...props}
    >
      {children}
    </td>
  );
}

/** Body row with the canvas' hover wash. */
export function ATr({
  children,
  className,
  ...props
}: React.ComponentProps<"tr">) {
  return (
    <tr className={cn("transition-colors hover:bg-foreground/4", className)} {...props}>
      {children}
    </tr>
  );
}

export function AdminEmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="border-t border-border px-4 py-10 text-center text-sm text-muted-foreground"
      >
        {children}
      </td>
    </tr>
  );
}

/** Segmented tab group used above the bookings/sessions/payments tables. */
export function AdminTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  className,
}: {
  tabs: { key: T; label: string; count?: number }[];
  value: T;
  onValueChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex gap-1 border border-border bg-foreground/6 p-1 text-[13.5px] font-semibold",
        className,
      )}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          aria-pressed={value === t.key}
          onClick={() => onValueChange(t.key)}
          className={cn(
            "px-3.5 py-2 transition-colors",
            value === t.key
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 opacity-60">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
