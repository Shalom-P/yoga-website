import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { DEFAULT_CUSTOMER_TZ } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { BookingsList } from "@/components/dashboard/BookingsList";
import { LocalTzLabel } from "@/components/dashboard/local-time";
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
    class_category: { name: string } | null;
  } | null;
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ booked?: string }>;
}) {
  const { booked } = await searchParams;
  const { user, supabase } = await requireUser("/dashboard/bookings");
  const [{ data: bookings }, { data: profile }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        `id, status, is_free_trial,
         session:sessions(id, start_at, end_at, meet_link, meet_status,
           teacher:teachers(display_name),
           class_category:class_categories(name))`
      )
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("profiles").select("timezone").eq("id", user.id).single(),
  ]);

  const rows: Row[] = bookings ?? [];
  const timezone = profile?.timezone ?? DEFAULT_CUSTOMER_TZ;
  const now = new Date().getTime();
  const upcomingCount = rows.filter(
    (r) => r.session && new Date(r.session.start_at).getTime() > now && r.status !== "cancelled"
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="myc-eyebrow">
        <span className="myc-dot" />
        My bookings
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-cormorant)] text-4xl md:text-[2.7rem] leading-[1.05] tracking-tight">
            Your <span className="italic text-accent">sessions.</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {upcomingCount} upcoming · times in <LocalTzLabel fallbackTz={timezone} />
          </p>
        </div>
        <Button asChild className="rounded-full bg-accent text-white hover:bg-accent/90">
          <Link href="/dashboard/book">Book a session</Link>
        </Button>
      </div>

      {booked === "1" && (
        <div
          role="status"
          className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4 text-sm text-foreground"
        >
          <strong className="font-medium">Session booked.</strong> Your join link will
          appear on the booking below shortly. We&apos;ll also email it to you.
        </div>
      )}

      <BookingsList rows={rows} customerTimezone={timezone} />
    </div>
  );
}
