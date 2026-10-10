import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { ReviewForm } from "@/components/dashboard/ReviewForm";
import { formatCustomerTime, DEFAULT_CUSTOMER_TZ } from "@/lib/timezone";

export const metadata = { title: "Review your session", robots: { index: false } };

/**
 * /dashboard/review?booking=<id>
 *
 * Landing for the post-session review email and the "Leave a review" link on
 * past bookings. Reads the booking on the cookie-bound client, so RLS is the
 * ownership check; the API route re-checks everything on submit.
 */
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string }>;
}) {
  const { booking: bookingId } = await searchParams;
  const { user, supabase } = await requireUser("/dashboard/review");

  const [{ data: booking }, { data: profile }] = await Promise.all([
    bookingId
      ? supabase
          .from("bookings")
          .select(
            "id, status, session:sessions!session_id(start_at, end_at, teacher:teachers(display_name))"
          )
          .eq("id", bookingId)
          .eq("customer_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("profiles").select("full_name, timezone").eq("id", user.id).single(),
  ]);

  const session = booking?.session ?? null;
  const now = new Date().getTime();
  const finished = session ? new Date(session.end_at).getTime() <= now : false;
  const teacherName = session?.teacher?.display_name ?? "your teacher";
  const tz = profile?.timezone ?? DEFAULT_CUSTOMER_TZ;
  const firstName = (profile?.full_name ?? "").trim().split(/\s+/)[0] ?? "";

  let blocker: string | null = null;
  if (!booking || !session) blocker = "We could not find that session on your account.";
  else if (booking.status === "cancelled") blocker = "This session was cancelled, so there is nothing to review.";
  else if (!finished) blocker = "You can review a session once it has finished.";

  return (
    <div className="max-w-[640px]">
      <div className="myc-eyebrow">
        <span className="myc-dot" />
        Your review
      </div>
      <h1 className="mt-2.5 font-[family-name:var(--font-cormorant)] text-[clamp(2.2rem,3.6vw,3rem)] font-medium leading-[1.05] tracking-[-0.015em]">
        How was your session{session ? ` with ${teacherName}` : ""}?
      </h1>
      {session && (
        <p className="mt-1.5 text-sm text-muted-foreground">
          {formatCustomerTime(session.start_at, tz)}
        </p>
      )}

      {blocker ? (
        <div className="myc-glass mt-7 p-8">
          <p className="text-foreground">{blocker}</p>
          <Link
            href="/dashboard/bookings"
            className="mt-5 inline-flex items-center bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:bg-[var(--myc-accent-hover)]"
          >
            Back to my sessions
          </Link>
        </div>
      ) : (
        <ReviewForm
          bookingId={booking!.id}
          teacherName={teacherName}
          defaultDisplayName={firstName}
        />
      )}
    </div>
  );
}
