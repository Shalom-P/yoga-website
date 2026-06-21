import Link from "next/link";
import { requireTeacher } from "@/lib/auth/guards";
import { TeacherSidebar } from "@/components/teacher/TeacherSidebar";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { WhatsAppButton } from "@/components/shared/WhatsAppButton";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, supabase } = await requireTeacher("/teacher");
  // The linked teacher record (self-read RLS, works even if the teacher is hidden).
  const { data: teacher } = await supabase
    .from("teachers")
    .select("display_name")
    .eq("profile_id", user.id)
    .maybeSingle();

  // Role is 'teacher' but no record is linked — shouldn't happen via the invite
  // flow, but fail soft with a clear message instead of a broken shell.
  if (!teacher) {
    return (
      <div className="myc-app min-h-dvh flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-[family-name:var(--font-heading)]">
            Your teacher profile isn&apos;t linked yet
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account has teacher access but isn&apos;t connected to a teacher
            profile. Please ask an admin to finish linking your account.
          </p>
          <div className="mt-6">
            <SignOutButton />
          </div>
        </div>
      </div>
    );
  }

  const name = teacher.display_name || user.email || "Teacher";

  return (
    <div className="myc-app min-h-dvh flex flex-col lg:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <TeacherSidebar userName={name} userEmail={user.email ?? ""} />
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
