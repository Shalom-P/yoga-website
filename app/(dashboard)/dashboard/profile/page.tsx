import { requireUser } from "@/lib/auth/guards";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { DEFAULT_CUSTOMER_TZ } from "@/lib/timezone";

export default async function ProfilePage() {
  const { user, supabase } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, phone, timezone, experience_level, marketing_opt_in")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium">
        Your profile
      </div>
      <h1 className="text-3xl md:text-4xl font-[family-name:var(--font-heading)] tracking-tight mt-1">
        Edit details
      </h1>
      <ProfileForm
        initial={{
          full_name: profile?.full_name ?? "",
          email: profile?.email ?? user.email ?? "",
          phone: profile?.phone ?? "",
          timezone: profile?.timezone ?? DEFAULT_CUSTOMER_TZ,
          experience_level: profile?.experience_level ?? "beginner",
          marketing_opt_in: profile?.marketing_opt_in ?? false,
        }}
      />
    </div>
  );
}
