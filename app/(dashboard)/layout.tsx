import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { SignOutButton } from "@/components/shared/SignOutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, supabase } = await requireUser("/dashboard");
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();
  const name = profile?.full_name || user.email || "Member";

  return (
    <div className="myc-app min-h-screen flex">
      <DashboardSidebar userName={name} userEmail={user.email ?? ""} />
      <div className="flex-1 flex flex-col">
        <header className="border-b border-border bg-background h-14 flex items-center justify-between px-6">
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
