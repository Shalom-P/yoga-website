"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CalendarPlus, CalendarCheck, FileText, Wallet, UserRound, Menu, ArrowLeft,
} from "lucide-react";
import { BrandMark } from "@/components/shared/BrandMark";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard",          label: "Overview",          icon: LayoutDashboard },
  { href: "/dashboard/book",     label: "Book a session",    icon: CalendarPlus },
  { href: "/dashboard/bookings", label: "My bookings",       icon: CalendarCheck },
  { href: "/dashboard/documents", label: "Health documents", icon: FileText },
  { href: "/dashboard/plan",     label: "My plan & credits", icon: Wallet },
  { href: "/dashboard/profile",  label: "Profile",           icon: UserRound },
];

function BrandHeader({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5">
      <BrandMark className="size-9 [&_svg]:size-5" />
      <span className="font-[family-name:var(--font-cormorant)] text-lg font-semibold leading-tight">
        <span className="block">My Yoga Classes</span>
        <span className="mt-1 block text-[11px] font-medium uppercase leading-none tracking-[0.14em] text-muted-foreground">
          Member
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
    <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === href || pathname.startsWith(`${href}/`);
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
    </nav>
  );
}

function UserCard({ userName, userEmail }: { userName: string; userEmail: string }) {
  return (
    <div className="flex items-center gap-2.5 border-t border-border p-4">
      <span className="size-9 shrink-0 rounded-full bg-gradient-to-br from-accent/40 to-accent" />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{userName}</div>
        <div className="truncate text-xs text-muted-foreground">{userEmail}</div>
      </div>
    </div>
  );
}

export function DashboardSidebar({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string;
}) {
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
        <UserCard userName={userName} userEmail={userEmail} />
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
            <SheetTitle className="sr-only">Member menu</SheetTitle>
            <SheetDescription className="sr-only">
              Navigate the member dashboard.
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
            <UserCard userName={userName} userEmail={userEmail} />
          </SheetContent>
        </Sheet>

        <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
          <BrandMark className="size-8 [&_svg]:size-4" />
          <span className="truncate font-[family-name:var(--font-cormorant)] text-base font-semibold leading-none">
            My Yoga Classes
          </span>
        </Link>
      </header>
    </>
  );
}
