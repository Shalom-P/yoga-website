import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { LocalTime } from "@/components/dashboard/local-time";

export type BookedSession = {
  startAt: string;
  endAt: string;
  teacherName: string | null;
};

/**
 * Heading for /dashboard/plan straight after the 1:1 is booked. The booking is
 * the news, so it owns the page heading. The empty balance the 1:1 leaves behind
 * is only a cue for the pack section further down, never the headline: it used
 * to read "You're out of sessions." here, which buried the confirmation.
 */
export function BookedConfirmation({
  session,
  timezone,
}: {
  /** Null when the booking can't be read back; the heading still confirms it. */
  session: BookedSession | null;
  timezone: string;
}) {
  const durationMin = session
    ? Math.max(
        0,
        Math.round((new Date(session.endAt).getTime() - new Date(session.startAt).getTime()) / 60000),
      )
    : 0;

  const viewBooking = (
    <Link
      href="/dashboard/bookings"
      className="inline-flex items-center border border-border bg-foreground/6 px-[18px] py-[11px] text-sm font-medium transition-colors hover:bg-foreground/12"
    >
      View booking
    </Link>
  );

  return (
    <header>
      <div className="myc-eyebrow">
        <span className="myc-dot" />
        Booking confirmed
      </div>
      <h1 className="mt-2.5 font-[family-name:var(--font-cormorant)] text-[clamp(2.2rem,3.6vw,3rem)] font-medium leading-[1.05] tracking-[-0.015em]">
        Your 1:1 is <span className="italic text-accent">booked.</span>
      </h1>
      <p className="mt-2 max-w-[40rem] text-[15px] text-muted-foreground">
        We&apos;ll email your join link. It will also appear in My bookings.
      </p>

      {session ? (
        <div className="myc-glass mt-6 flex flex-wrap items-center justify-between gap-5 px-6 py-5 sm:px-7">
          <div className="flex items-start gap-4">
            <CalendarCheck aria-hidden className="mt-1 size-6 shrink-0 text-accent" />
            <div>
              <div className="font-[family-name:var(--font-cormorant)] text-[26px] font-semibold leading-[1.1]">
                <LocalTime iso={session.startAt} pattern="EEEE d MMMM" fallbackTz={timezone} />,{" "}
                <LocalTime iso={session.startAt} pattern="h:mm a" fallbackTz={timezone} />
              </div>
              {/* "Your local time" rather than <LocalTzLabel>: Node and browsers
                  name some zones differently (Asia/Dubai is "GMT+4" server-side,
                  "GST" in Chrome), which breaks hydration. */}
              <div className="mt-1 text-sm text-muted-foreground">
                {durationMin} min
                {session.teacherName ? ` with ${session.teacherName}` : ""} · Your local time
              </div>
            </div>
          </div>
          {viewBooking}
        </div>
      ) : (
        <div className="mt-5">{viewBooking}</div>
      )}
    </header>
  );
}
