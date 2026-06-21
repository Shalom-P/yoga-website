import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth/guards";
import { AvailabilityGrid } from "@/components/admin/AvailabilityGrid";
import { SlotOverrides } from "@/components/admin/SlotOverrides";

export default async function TeacherAvailabilityPage() {
  const { user, supabase } = await requireTeacher();
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, timezone")
    .eq("profile_id", user.id)
    .single();
  if (!teacher) notFound();

  const [{ data: availability }, { data: overrides }] = await Promise.all([
    supabase.from("teacher_availability").select("*").eq("teacher_id", teacher.id),
    supabase
      .from("teacher_slot_overrides")
      .select("*")
      .eq("teacher_id", teacher.id)
      .order("date", { ascending: true }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-[family-name:var(--font-heading)] tracking-tight">
        My availability
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Times are in your local timezone ({teacher.timezone}). Click cells to toggle
        a 1-hour bookable window — changes save instantly.
      </p>

      <AvailabilityGrid
        teacherId={teacher.id}
        teacherTimezone={teacher.timezone}
        initial={availability ?? []}
      />

      <SlotOverrides
        teacherId={teacher.id}
        teacherTimezone={teacher.timezone}
        initial={overrides ?? []}
      />
    </div>
  );
}
