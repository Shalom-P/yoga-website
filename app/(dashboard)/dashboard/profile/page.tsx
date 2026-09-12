import { requireUser } from "@/lib/auth/guards";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { DeleteAccountSection } from "@/components/dashboard/DeleteAccountSection";
import { DEFAULT_CUSTOMER_TZ } from "@/lib/timezone";

export default async function ProfilePage() {
  const { user, supabase } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, phone, timezone, experience_level, marketing_opt_in")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-[640px]">
      <div className="myc-eyebrow">
        <span className="myc-dot" />
        Your profile
      </div>
      <h1 className="mt-2.5 font-[family-name:var(--font-cormorant)] text-[clamp(2.2rem,3.6vw,3rem)] font-medium leading-[1.05] tracking-[-0.015em]">
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
      <DeleteAccountSection />
    </div>
  );
}
