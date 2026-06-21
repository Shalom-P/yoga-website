import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth/guards";
import { TeacherProfileForm } from "@/components/teacher/TeacherProfileForm";

export default async function TeacherProfilePage() {
  const { user, supabase } = await requireTeacher();
  const { data: teacher } = await supabase
    .from("teachers")
    .select(
      "id, slug, display_name, headline, bio, specialties, languages, years_experience"
    )
    .eq("profile_id", user.id)
    .single();
  if (!teacher) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-[family-name:var(--font-heading)] tracking-tight">
        My profile
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        This is what students see on your public teacher page. Photos, video, your
        URL handle and calendar are managed by the studio admin — ask them to update
        those. Public changes can take a few minutes to appear on the site.
      </p>

      <TeacherProfileForm
        teacherId={teacher.id}
        initial={{
          display_name: teacher.display_name,
          headline: teacher.headline ?? "",
          bio: teacher.bio ?? "",
          specialties: teacher.specialties ?? [],
          languages: teacher.languages ?? [],
          years_experience: teacher.years_experience ?? 0,
        }}
      />
    </div>
  );
}
