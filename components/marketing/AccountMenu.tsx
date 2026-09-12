"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarCheck,
  CalendarRange,
  ChevronDown,
  FileHeart,
  FileText,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Ticket,
  UserRound,
} from "lucide-react";
import { YogaAvatar } from "@/components/shared/YogaAvatar";
import { performSignOut } from "@/components/shared/SignOutButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { viewerDestinations, type Viewer } from "@/lib/auth/useViewer";
import { cn } from "@/lib/utils";

/* shadcn's menu item highlights with `bg-accent`, whose token in this brand
   palette is the coral CTA colour, not the subtle neutral that class assumes.
   Same override the dashboard and admin sidebars carry. */
const MENU_ITEM = "px-2 py-1.5 focus:bg-foreground/10 focus:text-foreground";

/** Keyed by href so the destination list can stay JSX-free in lib/. */
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/admin": ShieldCheck,
  "/dashboard": LayoutDashboard,
  "/dashboard/bookings": CalendarCheck,
  "/dashboard/plan": Ticket,
  "/dashboard/documents": FileHeart,
  "/dashboard/profile": UserRound,
  "/teacher": LayoutDashboard,
  "/teacher/sessions": CalendarCheck,
  "/teacher/documents": FileText,
  "/teacher/availability": CalendarRange,
  "/teacher/profile": UserRound,
};

function useSignOut() {
  // performSignOut awaits a push-token DELETE and auth.signOut() before it
  // redirects, so without a pending flag the control looks inert throughout.
  const [signingOut, setSigningOut] = useState(false);
  return {
    signingOut,
    signOut: () => {
      setSigningOut(true);
      performSignOut().catch(() => setSigningOut(false));
    },
  };
}

/**
 * Desktop account control for the public site: an avatar that opens the member
 * destinations. Before this the nav offered a signed-in visitor one flat
 * "Dashboard" button, so reaching a booking or the profile from a marketing
 * page meant landing on the overview and navigating again.
 */
export function AccountMenu({ viewer }: { viewer: Viewer }) {
  const { signingOut, signOut } = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="inline-flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-[14.5px] font-medium text-foreground/85 outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:text-foreground"
      >
        <YogaAvatar seed={viewer.email || viewer.name} className="size-8" />
        {/* The name is the affordance that says "you are signed in"; below
            ~1100px the nav links need the room, so it drops to the avatar. */}
        <span className="hidden max-w-[9rem] truncate lg:inline">{viewer.name}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2 py-1.5">
          <div className="truncate text-sm font-semibold">{viewer.name}</div>
          <div className="truncate text-xs text-muted-foreground">{viewer.email}</div>
        </div>
        <DropdownMenuSeparator />
        {viewerDestinations(viewer.role).map(({ href, label }) => {
          const Icon = ICONS[href] ?? LayoutDashboard;
          return (
            <DropdownMenuItem key={href} className={MENU_ITEM} render={<Link href={href} />}>
              <Icon className="size-4" />
              {label}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem className={MENU_ITEM} disabled={signingOut} onClick={signOut}>
          <LogOut className="size-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The same destinations spelled out as rows, for the mobile sheet. A dropdown
 * inside an already-open menu is a second layer to dismiss on a phone, so the
 * links sit inline under a header identifying the account.
 */
export function AccountLinks({
  viewer,
  onNavigate,
}: {
  viewer: Viewer;
  onNavigate?: () => void;
}) {
  const { signingOut, signOut } = useSignOut();

  return (
    <div className="flex flex-col border-t border-border/60 pt-3">
      <div className="flex items-center gap-2.5 pb-1">
        <YogaAvatar seed={viewer.email || viewer.name} className="size-8 shrink-0" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{viewer.name}</div>
          <div className="truncate text-xs text-muted-foreground">{viewer.email}</div>
        </div>
      </div>
      {viewerDestinations(viewer.role).map(({ href, label }) => {
        const Icon = ICONS[href] ?? LayoutDashboard;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className="flex items-center gap-2.5 py-2 text-[15px] text-foreground/85 transition-colors hover:text-foreground"
          >
            <Icon className="size-4 opacity-70" />
            {label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        className={cn(
          "flex items-center gap-2.5 py-2 text-left text-[15px] text-muted-foreground transition-colors hover:text-foreground",
          signingOut && "opacity-60",
        )}
      >
        <LogOut className="size-4 opacity-70" />
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
