import Link from "next/link";
import { ArrowRight, Video, Calendar, Sparkles } from "lucide-react";
import { DEFAULT_CUSTOMER_TZ } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { LocalTime, LocalTzName } from "@/components/dashboard/local-time";

type NextBooking = {
  id: string;
  is_free_trial: boolean;
  session: {
    id: string;
    start_at: string;
    meet_link: string | null;
    meet_status: "pending" | "created" | "failed" | null;
    teacher: { display_name: string } | null;
  } | null;
};

export default async function DashboardHome() {
  const { user, supabase } = await requireUser();
  const [{ data: profile }, { data: bookingRows }] = await Promise.all([
    supabase.from("profiles").select("full_name, timezone").eq("id", user.id).maybeSingle(),
    supabase
      .from("bookings")
      .select(
        `id, is_free_trial,
         session:sessions(id, start_at, meet_link, meet_status, teacher:teachers(display_name))`,
      )
      .eq("customer_id", user.id)
      .eq("status", "confirmed")
      .limit(50),
  ]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const timezone = profile?.timezone ?? DEFAULT_CUSTOMER_TZ;

  // Ordering by a joined column isn't reliable in PostgREST for to-one embeds,
  // so filter to future sessions and pick the earliest in JS. A customer never
  // has enough confirmed bookings for this to matter perf-wise.
  const nowMs = new Date().getTime();
  const rows: NextBooking[] = bookingRows ?? [];
  const nextBooking =
    rows
      .filter((b) => b.session && new Date(b.session.start_at).getTime() > nowMs)
      .sort(
        (a, b) =>
          new Date(a.session!.start_at).getTime() - new Date(b.session!.start_at).getTime(),
      )[0] ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium">
          Welcome back
        </div>
        <h1 className="text-3xl md:text-4xl font-[family-name:var(--font-heading)] tracking-tight mt-1">
          Hello, {firstName}.
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Times shown in <LocalTzName fallbackTz={timezone} />.
        </p>
      </header>

      <NextClassCard booking={nextBooking} timezone={timezone} />

      <div className="grid sm:grid-cols-2 gap-5">
        <Link
          href="/dashboard/book"
          className="rounded-2xl border border-border bg-card p-6 hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          <Calendar className="size-6 text-primary mb-3" />
          <div className="font-medium">Book a session</div>
          <div className="text-sm text-muted-foreground mt-1">
            Find a private 1:1 with the teacher and time that fit your day.
          </div>
        </Link>
        <Link
          href="/dashboard/plan"
          className="rounded-2xl border border-border bg-card p-6 hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          <Sparkles className="size-6 text-primary mb-3" />
          <div className="font-medium">Buy a session pack</div>
          <div className="text-sm text-muted-foreground mt-1">
            Top up with a 5- or 10-session pack when you&apos;re ready.
          </div>
        </Link>
      </div>
    </div>
  );
}

function NextClassCard({
  booking,
  timezone,
}: {
  booking: NextBooking | null;
  timezone: string;
}) {
  if (!booking || !booking.session) {
    return (
      <div className="rounded-3xl bg-card border border-border p-7">
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">
          Your next class
        </div>
        <h2 className="text-2xl font-[family-name:var(--font-heading)]">
          You don&apos;t have a class booked yet.
        </h2>
        <p className="mt-2 text-muted-foreground">
          Pick a teacher and a time — your first 1:1 is free.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-11 rounded-full">
            <Link href="/dashboard/book">
              Book my free 1:1
              <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11 rounded-full">
            <Link href="/dashboard/book">Browse teachers</Link>
          </Button>
        </div>
        <div className="mt-6 text-xs text-muted-foreground flex items-center gap-2">
          <Video className="size-3.5" />
          Classes meet on Google Meet — we&apos;ll email you the link.
        </div>
      </div>
    );
  }

  const { session } = booking;
  return (
    <div className="rounded-3xl bg-card border border-border p-7">
      <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">
        Your next class
      </div>
      <h2 className="text-2xl font-[family-name:var(--font-heading)]">
        {session.teacher?.display_name ?? "Your teacher"}
        {booking.is_free_trial ? " · Free 1:1" : ""}
      </h2>
      <p className="mt-2 text-muted-foreground">
        <LocalTime iso={session.start_at} pattern="EEEE d MMM, h:mm a" fallbackTz={timezone} />
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {session.meet_link ? (
          <Button asChild size="lg" className="h-11 rounded-full">
            <a href={session.meet_link} target="_blank" rel="noreferrer">
              <Video className="size-4 mr-1" />
              Join on Google Meet
            </a>
          </Button>
        ) : (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Video className="size-3.5" />
            {session.meet_status === "failed"
              ? "Meet link unavailable — we're retrying."
              : "Meet link will be ready shortly."}
          </span>
        )}
        <Button asChild variant="outline" size="lg" className="h-11 rounded-full">
          <Link href="/dashboard/bookings">All bookings</Link>
        </Button>
      </div>
    </div>
  );
}
