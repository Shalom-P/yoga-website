"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, CalendarClock, BadgePercent,
  Image as ImageIcon, Wallet, Calendar, UserRound, Settings, Briefcase,
  Menu, ArrowLeft, Star, Banknote,
} from "lucide-react";
import { BrandMark } from "@/components/shared/BrandMark";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Grouped so the destinations stay scannable: a top Overview, then
// Catalog (things you publish), Operations (day-to-day) and Settings.
const NAV_GROUPS: {
  label: string | null;
  items: { href: string; label: string; icon: typeof LayoutDashboard }[];
}[] = [
  {
    label: null,
    items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/teachers",  label: "Teachers",  icon: Briefcase },
      { href: "/admin/classes",   label: "Classes",   icon: BookOpen },
      { href: "/admin/plans",     label: "Plans",     icon: Wallet },
      { href: "/admin/discounts", label: "Discounts", icon: BadgePercent },
      { href: "/admin/media",     label: "Media",     icon: ImageIcon },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/sessions",  label: "Sessions",  icon: CalendarClock },
      { href: "/admin/bookings",  label: "Bookings",  icon: Calendar },
      { href: "/admin/payments",  label: "Bank transfers", icon: Banknote },
      { href: "/admin/customers", label: "Customers", icon: UserRound },
      { href: "/admin/reviews",   label: "Reviews",   icon: Star },
    ],
  },
  {
    label: "Settings",
    items: [{ href: "/admin/settings", label: "Settings", icon: Settings }],
  },
];

function BrandHeader({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/admin" onClick={onNavigate} className="flex items-center gap-2.5">
      <BrandMark className="size-9 [&_svg]:size-5" />
      <span className="font-[family-name:var(--font-cormorant)] text-lg font-semibold leading-none">
        My Yoga Classes
        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Admin
        </span>
      </span>
    </Link>
  );
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="p-3 space-y-4 flex-1 overflow-y-auto">
      {NAV_GROUPS.map((group, gi) => (
        <div key={group.label ?? gi} className="space-y-1">
          {group.label && (
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
              {group.label}
            </div>
          )}
          {group.items.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      {/* Desktop: persistent sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="p-5 border-b border-border">
          <BrandHeader />
        </div>
        <NavLinks pathname={pathname} />
      </aside>

      {/* Mobile: top bar with hamburger → drawer */}
      <header className="lg:hidden sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-sidebar/95 px-3 backdrop-blur supports-backdrop-filter:bg-sidebar/80">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" aria-label="Open menu" />}
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col gap-0 bg-sidebar p-0">
            <SheetTitle className="sr-only">Admin menu</SheetTitle>
            <SheetDescription className="sr-only">
              Navigate the admin console.
            </SheetDescription>
            <div className="p-5 border-b border-border">
              <BrandHeader onNavigate={close} />
            </div>
            <NavLinks pathname={pathname} onNavigate={close} />
            <div className="border-t border-border p-3 space-y-1">
              <Link
                href="/"
                onClick={close}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                Back to site
              </Link>
              <SignOutButton className="w-full justify-start px-3" />
            </div>
          </SheetContent>
        </Sheet>

        <Link href="/admin" className="flex items-center gap-2 min-w-0">
          <BrandMark className="size-8 [&_svg]:size-4" />
          <span className="truncate font-[family-name:var(--font-cormorant)] text-base font-semibold leading-none">
            My Yoga Classes
          </span>
        </Link>
      </header>
    </>
  );
}
