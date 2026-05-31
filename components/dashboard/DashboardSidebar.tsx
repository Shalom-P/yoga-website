"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CalendarPlus, Receipt, Wallet, UserRound,
} from "lucide-react";
import { BrandMark } from "@/components/shared/BrandMark";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard",          label: "Overview",          icon: LayoutDashboard },
  { href: "/dashboard/book",     label: "Book a session",    icon: CalendarPlus },
  { href: "/dashboard/bookings", label: "My bookings",       icon: Receipt },
  { href: "/dashboard/plan",     label: "My plan & credits", icon: Wallet },
  { href: "/dashboard/profile",  label: "Profile",           icon: UserRound },
];

export function DashboardSidebar({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-sidebar flex flex-col">
      <div className="p-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <BrandMark className="size-9 [&_svg]:size-5" />
          <span className="font-[family-name:var(--font-cormorant)] text-lg font-semibold leading-none">
            My Yoga Classes
            <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Member
            </span>
          </span>
        </Link>
      </div>
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
      <div className="flex items-center gap-2.5 border-t border-border p-4">
        <span className="size-9 shrink-0 rounded-full bg-gradient-to-br from-accent/40 to-accent" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{userName}</div>
          <div className="truncate text-xs text-muted-foreground">{userEmail}</div>
        </div>
      </div>
    </aside>
  );
}
