import { requireUser } from "@/lib/auth/guards";
import { BookingsList } from "@/components/dashboard/BookingsList";
import type { BookingStatus } from "@/lib/supabase/types";

type Row = {
  id: string;
  status: BookingStatus;
  is_free_trial: boolean;
  session: {
    id: string;
    start_at: string;
    end_at: string;
    meet_link: string | null;
    meet_status: "pending" | "created" | "failed" | null;
    teacher: { display_name: string } | null;
  } | null;
};

export default async function BookingsPage() {
  const { user, supabase } = await requireUser("/dashboard/bookings");
  const [{ data: bookings }, { data: profile }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        `id, status, is_free_trial,
         session:sessions(id, start_at, end_at, meet_link, meet_status, teacher:teachers(display_name))`
      )
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("profiles").select("timezone").eq("id", user.id).single(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium">
        Your bookings
      </div>
      <h1 className="text-3xl md:text-4xl font-[family-name:var(--font-heading)] tracking-tight mt-1">
        Past & upcoming
      </h1>
      <BookingsList
        rows={(bookings as unknown as Row[]) ?? []}
        customerTimezone={profile?.timezone ?? "Australia/Sydney"}
      />
    </div>
  );
}
