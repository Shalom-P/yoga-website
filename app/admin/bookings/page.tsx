import { requireAdmin } from "@/lib/auth/guards";
import { BookingsAdmin } from "@/components/admin/BookingsAdmin";
import type { BookingStatus } from "@/lib/supabase/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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

const PAGE_SIZE = 50;

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await supabase
    .from("bookings")
    .select(
      `id, status, is_free_trial, created_at,
       customer:profiles(id, full_name, email),
       session:sessions(id, start_at, teacher:teachers(display_name))`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const rows: Row[] = data ?? [];

  return (
    <div className="p-8 max-w-7xl">
      <BookingsAdmin rows={rows} />
      {totalPages > 1 && (
        <div className="mt-6 flex items-center gap-3">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/bookings?page=${page - 1}`}>← Previous</Link>
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
            {count != null && ` · ${count} total`}
          </span>
          {page < totalPages && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/bookings?page=${page + 1}`}>Next →</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
