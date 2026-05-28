import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/guards";
import { TeacherEditPanel } from "@/components/admin/TeacherEditPanel";

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

  return (
    <div className="p-8 max-w-4xl">
      <Link
        href="/admin/teachers"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="size-3.5" />
        Back to teachers
      </Link>
      <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
        {teacher.display_name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">ID: {teacher.id}</p>

      <div className="mt-6">
        <TeacherEditPanel teacher={teacher} />
      </div>

      <div className="mt-6">
        <Button asChild className="rounded-full">
          <Link href={`/admin/teachers/${teacher.id}/slots`}>
            <CalendarRange className="size-4 mr-1" />
            Edit availability
          </Link>
        </Button>
      </div>
    </div>
  );
}
