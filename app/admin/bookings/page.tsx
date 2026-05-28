import { requireAdmin } from "@/lib/auth/guards";
import { BookingsAdmin } from "@/components/admin/BookingsAdmin";
import type { BookingStatus } from "@/lib/supabase/types";

type Row = {
  id: string;
  status: BookingStatus;
  is_free_trial: boolean;
  created_at: string;
  customer: { id: string; full_name: string | null; email: string | null } | null;
  session: {
    id: string;
    start_at: string;
    teacher: { display_name: string } | null;
  } | null;
};

export default async function AdminBookingsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("bookings")
    .select(
      `id, status, is_free_trial, created_at,
       customer:profiles(id, full_name, email),
       session:sessions(id, start_at, teacher:teachers(display_name))`
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="p-8 max-w-7xl">
      <BookingsAdmin rows={(data as unknown as Row[]) ?? []} />
    </div>
  );
}
