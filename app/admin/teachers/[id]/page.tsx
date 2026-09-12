import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/guards";
import { TeacherEditPanel } from "@/components/admin/TeacherEditPanel";
import { AdminPageHeader } from "@/components/admin/AdminPage";

export default async function AdminTeacherDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const { data: teacher } = await supabase
    .from("teachers")
    .select("*")
    .eq("id", id)
    .single();
  if (!teacher) notFound();

  // If a login is linked, surface its email so the panel can show account status.
  let linkedAccount: { email: string | null } | null = null;
  if (teacher.profile_id) {
    const { data: linked } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", teacher.profile_id)
      .maybeSingle();
    linkedAccount = { email: linked?.email ?? null };
  }

  return (
    <div className="max-w-4xl">
      <Link
        href="/admin/teachers"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="size-3.5" />
        Back to teachers
      </Link>
      <AdminPageHeader
        eyebrow="Teacher"
        title={teacher.display_name}
        sub={`ID: ${teacher.id}`}
      />

      <div className="mt-6">
        <TeacherEditPanel teacher={teacher} linkedAccount={linkedAccount} />
      </div>

      <div className="mt-6">
        <Button asChild>
          <Link href={`/admin/teachers/${teacher.id}/slots`}>
            <CalendarRange className="size-4 mr-1" />
            Edit availability
          </Link>
        </Button>
      </div>
    </div>
  );
}
