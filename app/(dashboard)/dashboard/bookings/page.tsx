import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { DEFAULT_CUSTOMER_TZ } from "@/lib/timezone";
import { hasMedicalDocuments } from "@/lib/medical/documents";
import { BookingsList } from "@/components/dashboard/BookingsList";
import { HealthDocsNudge } from "@/components/dashboard/HealthDocsNudge";
import { LocalTzLabel } from "@/components/dashboard/local-time";
import { cn } from "@/lib/utils";
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
  const [{ data: bookings }, { data: profile }, hasDocs] = await Promise.all([
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
    // Fails "quiet" (returns true on error), so a transient query failure never
    // nags a customer who has already uploaded.
    hasMedicalDocuments(supabase, user.id),
  ]);

  const rows: Row[] = bookings ?? [];
  const timezone = profile?.timezone ?? DEFAULT_CUSTOMER_TZ;
  const now = new Date().getTime();
  const upcoming = rows
    .filter(
      (r) => r.session && new Date(r.session.start_at).getTime() > now && r.status !== "cancelled"
    )
    .sort(
      (a, b) => new Date(a.session!.start_at).getTime() - new Date(b.session!.start_at).getTime()
    );
  const upcomingCount = upcoming.length;
  // Anchor the nudge to the soonest class when there is one, so the ask lands
  // with a deadline attached rather than as a generic chore.
  const nextStartIso = upcoming[0]?.session?.start_at ?? null;

  return (
    <div>
      <div className="myc-eyebrow">
        <span className="myc-dot" />
        My bookings
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-cormorant)] text-[clamp(2.2rem,3.6vw,3rem)] font-medium leading-[1.05] tracking-[-0.015em]">
            Your <span className="italic text-accent">sessions.</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {upcomingCount} upcoming · times in <LocalTzLabel fallbackTz={timezone} />
          </p>
        </div>
        {/* Always reachable from this page, whether or not anything is uploaded:
            a customer who meant to add a report should never have to hunt for it. */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/documents"
            className={cn(
              "inline-flex items-center gap-2 border px-4 py-2.5 text-sm font-medium transition-colors",
              // Draw more attention to it when there is nothing uploaded yet.
              hasDocs
                ? "border-border bg-foreground/6 hover:bg-foreground/12"
                : "border-accent/50 bg-accent/12 hover:bg-accent/20"
            )}
          >
            <HeartPulse className="size-4" />
            {hasDocs ? "Health documents" : "Upload health documents"}
          </Link>
          <Link
            href="/dashboard/book"
            className="inline-flex items-center bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-[var(--myc-accent-hover)]"
          >
            Book a session
          </Link>
        </div>
      </div>

      {booked === "1" && (
        <div
          role="status"
          className="mt-5 border border-accent/40 bg-accent/10 px-[18px] py-3.5 text-[14.5px] text-foreground"
        >
          <strong className="font-medium">Session booked.</strong> Your join link will
          appear on the booking below shortly. We&apos;ll also email it to you.
        </div>
      )}

      {!hasDocs && (
        <HealthDocsNudge startIso={nextStartIso} fallbackTz={timezone} className="mt-6" />
      )}

      <BookingsList rows={rows} customerTimezone={timezone} />
    </div>
  );
}
