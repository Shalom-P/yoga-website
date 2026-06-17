import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { TeacherSlotPicker } from "@/components/dashboard/TeacherSlotPicker";
import { TeacherIntroVideo } from "@/components/shared/TeacherIntroVideo";

export default async function TeacherBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { user } = await requireUser("/dashboard");
  const { slug } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, slug, display_name, headline, bio, timezone, rating_avg, is_active, intro_video_url, avatar_url")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!teacher) notFound();

  const { data: availability } = await supabase
    .from("teacher_availability")
    .select("day_of_week, start_time, end_time, slot_duration_minutes")
    .eq("teacher_id", teacher.id);

  // One-off blocked dates (teacher TZ "yyyy-MM-dd") so the picker doesn't offer
  // slots the confirm route would reject. Only future dates are relevant.
  const todayIso = new Date().toISOString().slice(0, 10);
  const { data: overrides } = await supabase
    .from("teacher_slot_overrides")
    .select("date, is_blocked")
    .eq("teacher_id", teacher.id)
    .eq("is_blocked", true)
    .gte("date", todayIso);
  const blockedDates = (overrides ?? []).map((o) => o.date);

  // Explicit id filter + maybeSingle — RLS alone would also scope to the user,
  // but .single() throws PGRST116 on the transient zero-row case (e.g. profile
  // row hasn't been created by the auth trigger yet).
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();

  // The free 1:1 trial is available until the customer has used it; after that,
  // booking a paid session spends a session-credit. These drive the picker.
  const [{ data: trialBooking }, { data: credits }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id")
      .eq("customer_id", user.id)
      .eq("is_free_trial", true)
      .neq("status", "cancelled")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("customer_credits")
      .select("balance")
      .eq("customer_id", user.id)
      .maybeSingle(),
  ]);
  const freeTrialAvailable = !trialBooking;
  const creditBalance = credits?.balance ?? 0;

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

      {teacher.intro_video_url && (
        <div className="mt-6 max-w-lg">
          <TeacherIntroVideo
            src={teacher.intro_video_url}
            poster={teacher.avatar_url}
            name={teacher.display_name}
          />
        </div>
      )}

      <TeacherSlotPicker
        teacherId={teacher.id}
        teacherTimezone={teacher.timezone ?? "Asia/Kolkata"}
        customerTimezone={profile?.timezone ?? "Australia/Sydney"}
        availability={availability ?? []}
        freeTrialAvailable={freeTrialAvailable}
        creditBalance={creditBalance}
        blockedDates={blockedDates}
      />
    </div>
  );
}
