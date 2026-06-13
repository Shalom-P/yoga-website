import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { AvailabilityGrid } from "@/components/admin/AvailabilityGrid";
import { SlotOverrides } from "@/components/admin/SlotOverrides";

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
    <div className="p-8 max-w-6xl">
      <Link
        href={`/admin/teachers/${id}`}
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="size-3.5" />
        Back to teacher
      </Link>
      <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
        Availability — {teacher.display_name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Times shown in the teacher&apos;s local timezone ({teacher.timezone}). Click cells to toggle availability.
      </p>

      <AvailabilityGrid teacherId={id} teacherTimezone={teacher.timezone} initial={availability ?? []} />

      <SlotOverrides
        teacherId={id}
        teacherTimezone={teacher.timezone}
        initial={overrides ?? []}
      />
    </div>
  );
}
