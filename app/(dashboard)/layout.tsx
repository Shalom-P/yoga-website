import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { WhatsAppButton } from "@/components/shared/WhatsAppButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, supabase } = await requireUser("/dashboard");
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();
  const name = profile?.full_name || user.email || "Member";
  // Drives the Admin link in the sidebar only. The real gate is the middleware
  // role routing plus requireAdmin() inside /admin, so a stale or spoofed value
  // here would surface a dead link, never actual access.
  const isAdmin = profile?.role === "admin";

  return (
    <div className="myc-app min-h-dvh flex flex-col lg:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <DashboardSidebar userName={name} userEmail={user.email ?? ""} isAdmin={isAdmin} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="hidden lg:flex border-b border-border bg-background h-14 items-center justify-between px-6">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to site
          </Link>
          <SignOutButton />
        </header>
        <main id="main-content" className="flex-1 bg-secondary/20">{children}</main>
      </div>
      <WhatsAppButton />
    </div>
  );
}
