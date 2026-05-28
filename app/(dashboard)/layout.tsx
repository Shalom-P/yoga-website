import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { SignOutButton } from "@/components/shared/SignOutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser("/dashboard");
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="size-7 rounded-full bg-primary inline-flex items-center justify-center">
              <span className="size-2.5 rounded-full bg-background" />
            </span>
            <span className="font-[family-name:var(--font-heading)] text-lg">
              MYYOGACLASSES
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <DashboardNav />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="flex-1 bg-secondary/30">{children}</main>
    </div>
  );
}
