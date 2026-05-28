import Link from "next/link";
import { ArrowLeft, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminTeacherDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

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
        Edit teacher
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">ID: {id}</p>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <p className="text-muted-foreground">
          Teacher profile form (name, bio, specialties, languages, photo uploads, Google
          calendar ID) goes here. Wire to <code>teachers</code> table via Server Action.
        </p>
        <Button asChild className="mt-5 rounded-full">
          <Link href={`/admin/teachers/${id}/slots`}>
            <CalendarRange className="size-4 mr-1" />
            Edit availability
          </Link>
        </Button>
      </div>
    </div>
  );
}
