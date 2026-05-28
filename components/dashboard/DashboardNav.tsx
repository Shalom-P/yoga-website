"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard",          label: "Home" },
  { href: "/dashboard/book",     label: "Book" },
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/plan",     label: "Plan" },
  { href: "/dashboard/profile",  label: "Profile" },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "px-3 py-1.5 text-sm rounded-full transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
