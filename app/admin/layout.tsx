import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { SignOutButton } from "@/components/shared/SignOutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="myc-app min-h-dvh flex flex-col lg:flex-row">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="hidden lg:flex border-b border-border bg-background h-14 items-center justify-between px-6">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to site
          </Link>
          <SignOutButton />
        </header>
        <main className="flex-1 bg-secondary/20">{children}</main>
      </div>
    </div>
  );
}
