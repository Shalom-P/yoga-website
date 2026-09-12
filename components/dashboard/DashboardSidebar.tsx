"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { BrandMark } from "@/components/shared/BrandMark";
import { YogaAvatar } from "@/components/shared/YogaAvatar";
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
   palette is the coral CTA colour, not the subtle neutral that class assumes —
   an unstyled menu row reads as "selected". Tone it to a plain ink wash. */
const MENU_ITEM = "px-2 py-1.5 focus:bg-foreground/10 focus:text-foreground";

const ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/book", label: "Book a session" },
  { href: "/dashboard/bookings", label: "My bookings" },
  { href: "/dashboard/documents", label: "Health documents" },
  { href: "/dashboard/plan", label: "My sessions" },
  { href: "/dashboard/profile", label: "Profile" },
];

function isActive(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
      <BrandMark
        className={cn("shrink-0", compact ? "size-6 [&_svg]:size-6" : "size-[30px] [&_svg]:size-[30px]")}
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
          <span className="text-[10.5px] font-semibold uppercase leading-none tracking-[0.14em] text-muted-foreground">
            Member
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
        "flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-accent/12 text-foreground shadow-[inset_2px_0_0_var(--accent)]"
          : "text-muted-foreground hover:bg-foreground/7 hover:text-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          active ? "bg-accent" : "bg-foreground/25",
        )}
      />
      {label}
    </Link>
  );
}

function UserChip({ userName, userEmail }: { userName: string; userEmail: string }) {
  return (
    <div className="flex items-center gap-2.5 border-t border-border p-4">
      <YogaAvatar seed={userEmail || userName} className="size-9 shrink-0" />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{userName}</div>
        <div className="truncate text-xs text-muted-foreground">{userEmail}</div>
      </div>
    </div>
  );
}

export function DashboardSidebar({
  userName,
  userEmail,
  isAdmin = false,
}: {
  userName: string;
  userEmail: string;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  // performSignOut awaits a push-token DELETE and auth.signOut() before it
  // redirects, which is two network round trips. Without a pending flag the
  // control looks inert for the whole of it and re-fires on a second click.
  const [signingOut, setSigningOut] = useState(false);
  const signOut = () => {
    setSigningOut(true);
    performSignOut().catch(() => setSigningOut(false));
  };

  return (
    <>
      {/* Desktop: persistent sidebar */}
      {/* Deliberately NOT .myc-glass-bar: this rail sits beside the content, so
          nothing ever scrolls under it and its backdrop-filter would be a
          full-height compositing layer paid on every frame. The tinted wash and
          hairline carry the look on their own, same call as .myc-glass. */}
      <aside className="sticky top-0 hidden h-dvh w-[252px] shrink-0 flex-col border-r border-border bg-foreground/4 lg:flex">
        <div className="border-b border-border px-5 pb-5 pt-[22px]">
          <Wordmark />
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
          {ITEMS.map((item) => (
            <NavRow key={item.href} {...item} active={isActive(pathname, item.href)} />
          ))}
          {/* Admins get an explicit way into /admin from the member area. In a
              browser you can just type the URL; inside the Capacitor shell there is
              no address bar, so without this link an admin who signs in on the phone
              is stranded on the customer dashboard with no route to the console.
              Purely navigational: /admin is still gated by the middleware role check
              and by requireAdmin() in every page under it. */}
          {isAdmin && (
            <Link
              href="/admin"
              className="mt-2 flex items-center gap-3 border-t border-border px-3 pb-2 pt-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ShieldCheck className="size-4" />
              Admin
            </Link>
          )}
        </nav>
        <div className="flex flex-col gap-0.5 border-t border-border p-3 text-[13.5px]">
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
        <UserChip userName={userName} userEmail={userEmail} />
      </aside>

      {/* Mobile: top bar + a scrolling nav strip, so every area is one tap away
          rather than behind a hamburger. The avatar carries what the desktop
          sidebar keeps in its footer (profile, back to site, sign out), which
          the strip has no room for. */}
      <header
        style={{ borderWidth: "0 0 1px 0" }}
        className="myc-glass-bar sticky top-0 z-40 lg:hidden"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Wordmark compact />
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account menu"
              className="shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <YogaAvatar seed={userEmail || userName} className="size-8" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <div className="truncate text-sm font-semibold">{userName}</div>
                <div className="truncate text-xs text-muted-foreground">{userEmail}</div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={MENU_ITEM} render={<Link href="/dashboard/profile" />}>
                <UserRound className="size-4" />
                Profile
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem className={MENU_ITEM} render={<Link href="/admin" />}>
                  <ShieldCheck className="size-4" />
                  Admin
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className={MENU_ITEM} render={<Link href="/" />}>
                <ArrowLeft className="size-4" />
                Back to site
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={MENU_ITEM}
                disabled={signingOut}
                onClick={signOut}
              >
                <LogOut className="size-4" />
                {signingOut ? "Signing out…" : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <nav className="flex gap-0.5 overflow-x-auto px-2.5 pb-2.5">
          {ITEMS.map(({ href, label }) => {
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
