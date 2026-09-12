import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { AvailabilityGrid } from "@/components/admin/AvailabilityGrid";
import { SlotOverrides } from "@/components/admin/SlotOverrides";
import { AdminPageHeader } from "@/components/admin/AdminPage";

export default async function TeacherSlotsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { id } = await params;

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, display_name, timezone")
    .eq("id", id)
    .single();
  if (!teacher) notFound();

  const [{ data: availability }, { data: overrides }] = await Promise.all([
    supabase
      .from("teacher_availability")
      .select("*")
      .eq("teacher_id", id),
    supabase
      .from("teacher_slot_overrides")
      .select("*")
      .eq("teacher_id", id)
      .order("date", { ascending: true }),
  ]);

  return (
    <div>
      <Link
        href={`/admin/teachers/${id}`}
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="size-3.5" />
        Back to teacher
      </Link>
      <AdminPageHeader
        eyebrow="Availability"
        title={teacher.display_name}
        sub={`Times shown in the teacher's local timezone (${teacher.timezone}). Click cells to toggle availability.`}
      />

      <AvailabilityGrid teacherId={id} teacherTimezone={teacher.timezone} initial={availability ?? []} />

      <SlotOverrides
        teacherId={id}
        teacherTimezone={teacher.timezone}
        initial={overrides ?? []}
      />
    </div>
  );
}
