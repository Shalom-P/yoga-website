"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { BrandMark } from "@/components/shared/BrandMark";
import { performSignOut } from "@/components/shared/SignOutButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/* shadcn's menu item highlights with `bg-accent`, whose token in this brand
   palette is the coral CTA colour, not the subtle neutral that class assumes. */
const MENU_ITEM = "px-2 py-1.5 focus:bg-foreground/10 focus:text-foreground";

// Grouped so the destinations stay scannable: a top Overview, then
// Catalog (things you publish), Operations (day-to-day) and Settings.
const NAV_GROUPS: {
  label: string | null;
  items: { href: string; label: string }[];
}[] = [
  {
    label: null,
    items: [{ href: "/admin", label: "Overview" }],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/teachers", label: "Teachers" },
      { href: "/admin/classes", label: "Classes" },
      { href: "/admin/plans", label: "Plans" },
      { href: "/admin/discounts", label: "Discounts" },
      { href: "/admin/media", label: "Media" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/sessions", label: "Sessions" },
      { href: "/admin/bookings", label: "Bookings" },
      { href: "/admin/payments", label: "Bank transfers" },
      { href: "/admin/customers", label: "Customers" },
      { href: "/admin/reviews", label: "Reviews" },
    ],
  },
  {
    label: "Settings",
    items: [{ href: "/admin/settings", label: "Settings" }],
  },
];

const FLAT_NAV = NAV_GROUPS.flatMap((g) => g.items);

function isActive(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === "/admin"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
      <BrandMark
        className={cn(
          "shrink-0",
          compact ? "size-6 [&_svg]:size-6" : "size-[30px] [&_svg]:size-[30px]",
        )}
      />
      <span className="flex min-w-0 flex-col gap-1">
        <span
          className={cn(
            "truncate font-[family-name:var(--font-cormorant)] font-semibold leading-none",
            compact ? "text-lg" : "text-[19px]",
          )}
        >
          My Yoga Classes
        </span>
        {!compact && (
          <span className="text-[10.5px] font-semibold uppercase leading-none tracking-[0.14em] text-accent">
            Admin
          </span>
        )}
      </span>
    </Link>
  );
}

/** Dot-and-label nav row. The canvas drops the icon set for a state dot plus an
 *  inset accent rule on the active item. */
function NavRow({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 text-[13.5px] font-medium transition-colors",
        active
          ? "bg-accent/12 text-foreground shadow-[inset_2px_0_0_var(--accent)]"
          : "text-muted-foreground hover:bg-foreground/7 hover:text-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", active ? "bg-accent" : "bg-foreground/25")}
      />
      {label}
    </Link>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  // performSignOut awaits a push-token DELETE and auth.signOut() before it
  // redirects, so without a pending flag the control looks inert throughout.
  const [signingOut, setSigningOut] = useState(false);
  const signOut = () => {
    setSigningOut(true);
    performSignOut().catch(() => setSigningOut(false));
  };

  return (
    <>
      {/* Desktop: persistent sidebar. Deliberately not .myc-glass-bar — the rail
          sits beside the content, so nothing scrolls under it and a
          backdrop-filter would be a full-height compositing layer for nothing. */}
      <aside className="sticky top-0 hidden h-dvh w-[244px] shrink-0 flex-col border-r border-border bg-foreground/4 lg:flex">
        <div className="border-b border-border px-5 pb-5 pt-[22px]">
          <Wordmark />
        </div>
        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
          {NAV_GROUPS.map((group, i) => (
            <div key={group.label ?? `g${i}`} className="flex flex-col gap-0.5">
              {group.label && (
                <div className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => (
                <NavRow key={item.href} {...item} active={isActive(pathname, item.href)} />
              ))}
            </div>
          ))}
        </nav>
        <div className="flex flex-col gap-0.5 border-t border-border p-3 text-[13px]">
          <Link
            href="/"
            className="px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to site
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="px-3 py-2 text-left text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Mobile: top bar + a scrolling nav strip, so every area is one tap away
          rather than behind a hamburger. */}
      <header
        style={{ borderWidth: "0 0 1px 0" }}
        className="myc-glass-bar sticky top-0 z-40 lg:hidden"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Wordmark compact />
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Admin menu"
              className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Admin
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem className={MENU_ITEM} render={<Link href="/" />}>
                <ArrowLeft className="size-4" />
                Back to site
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={MENU_ITEM} disabled={signingOut} onClick={signOut}>
                <LogOut className="size-4" />
                {signingOut ? "Signing out…" : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <nav className="flex gap-0.5 overflow-x-auto px-2.5 pb-2.5">
          {FLAT_NAV.map(({ href, label }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 whitespace-nowrap px-3 py-1.5 text-[13px] font-medium transition-colors",
                  active ? "bg-accent/12 text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
