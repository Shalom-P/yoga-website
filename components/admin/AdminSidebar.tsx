"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, BookOpen, CalendarClock, BadgePercent,
  Image as ImageIcon, Wallet, Calendar, UserRound, Settings, Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin",            label: "Overview",  icon: LayoutDashboard },
  { href: "/admin/teachers",   label: "Teachers",  icon: Briefcase },
  { href: "/admin/sessions",   label: "Sessions",  icon: CalendarClock },
  { href: "/admin/classes",    label: "Classes",   icon: BookOpen },
  { href: "/admin/plans",      label: "Plans",     icon: Wallet },
  { href: "/admin/discounts",  label: "Discounts", icon: BadgePercent },
  { href: "/admin/media",      label: "Media",     icon: ImageIcon },
  { href: "/admin/bookings",   label: "Bookings",  icon: Calendar },
  { href: "/admin/customers",  label: "Customers", icon: UserRound },
  { href: "/admin/settings",   label: "Settings",  icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-background flex flex-col">
      <div className="p-5 border-b border-border">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="size-7 rounded-full bg-primary inline-flex items-center justify-center">
            <span className="size-2.5 rounded-full bg-background" />
          </span>
          <span className="font-[family-name:var(--font-heading)]">Admin</span>
        </Link>
      </div>
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
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
    </aside>
  );
}
