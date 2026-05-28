import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { TeacherSlotPicker } from "@/components/dashboard/TeacherSlotPicker";

export default async function TeacherBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireUser("/dashboard");
  const { slug } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, slug, display_name, headline, bio, timezone, rating_avg, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  if (!teacher) notFound();

  const { data: availability } = await supabase
    .from("teacher_availability")
    .select("day_of_week, start_time, end_time, slot_duration_minutes")
    .eq("teacher_id", teacher.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .single();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium">
        Book a class
      </div>
      <h1 className="text-3xl md:text-4xl font-[family-name:var(--font-heading)] tracking-tight mt-1">
        {teacher.display_name}
      </h1>
      <p className="mt-2 text-muted-foreground">{teacher.headline}</p>
      {teacher.bio && <p className="mt-3 text-sm text-muted-foreground">{teacher.bio}</p>}

      <TeacherSlotPicker
        teacherId={teacher.id}
        teacherTimezone={teacher.timezone ?? "Asia/Kolkata"}
        customerTimezone={profile?.timezone ?? "Australia/Sydney"}
        availability={availability ?? []}
      />
    </div>
  );
}
