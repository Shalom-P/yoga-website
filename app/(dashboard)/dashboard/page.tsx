import Link from "next/link";
import { Play } from "lucide-react";
import { DEFAULT_CUSTOMER_TZ } from "@/lib/timezone";
import { requireUser } from "@/lib/auth/guards";
import { hasMedicalDocuments } from "@/lib/medical/documents";
import { LocalTime, LocalTzLabel, LocalTzName } from "@/components/dashboard/local-time";

type NextBooking = {
  id: string;
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

export default async function DashboardHome() {
  const { user, supabase } = await requireUser();
  const [{ data: profile }, { data: bookingRows }, { data: credits }, hasDocs] =
    await Promise.all([
      supabase.from("profiles").select("full_name, timezone").eq("id", user.id).maybeSingle(),
      supabase
        .from("bookings")
        .select(
          `id, is_free_trial,
         session:sessions(id, start_at, end_at, meet_link, meet_status,
           teacher:teachers(display_name),
           class_category:class_categories(name))`,
        )
        .eq("customer_id", user.id)
        .eq("status", "confirmed")
        // Without an ORDER BY, PostgREST's 50 rows are an arbitrary subset, so
        // the Upcoming count and "your next class" would both vary run to run.
        // Newest-first keeps future sessions inside the window in practice.
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("customer_credits")
        .select("balance")
        .eq("customer_id", user.id)
        .maybeSingle(),
      hasMedicalDocuments(supabase, user.id),
    ]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const timezone = profile?.timezone ?? DEFAULT_CUSTOMER_TZ;
  const balance = credits?.balance ?? 0;

  // Ordering by a joined column isn't reliable in PostgREST for to-one embeds,
  // so filter to future sessions and sort in JS. A customer never has enough
  // confirmed bookings for this to matter perf-wise.
  const nowMs = new Date().getTime();
  const rows: NextBooking[] = bookingRows ?? [];
  const upcoming = rows
    .filter((b) => b.session && new Date(b.session.start_at).getTime() > nowMs)
    .sort(
      (a, b) => new Date(a.session!.start_at).getTime() - new Date(b.session!.start_at).getTime(),
    );
  const nextBooking = upcoming[0] ?? null;

  return (
    <div className="flex flex-col gap-7">
      <header>
        <div className="myc-eyebrow">
          <span className="myc-dot" />
          Welcome back
        </div>
        <h1 className="mt-2.5 font-[family-name:var(--font-cormorant)] text-[clamp(2.2rem,3.6vw,3rem)] font-medium leading-[1.05] tracking-[-0.015em]">
          Hello, {firstName}.
        </h1>
        <p className="mt-2 text-[14.5px] text-muted-foreground">
          Times shown in <LocalTzLabel fallbackTz={timezone} /> (
          <LocalTzName fallbackTz={timezone} />
          ).
        </p>
      </header>

      <NextClassCard
        booking={nextBooking}
        timezone={timezone}
        balance={balance}
        upcomingCount={upcoming.length}
      />

      {nextBooking?.session && !hasDocs && (
        <HealthDocsBanner startIso={nextBooking.session.start_at} timezone={timezone} />
      )}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        <QuickAction
          index="01"
          href="/dashboard/book"
          title="Book a session"
          body="Find a personalised 1:1 with the teacher and time that fit your day."
        />
        <QuickAction
          index="02"
          href="/dashboard/plan"
          title="Buy a session pack"
          body="Top up with a 5- or 10-session pack when you're ready."
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="myc-glass px-[18px] py-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1.5 font-[family-name:var(--font-cormorant)] text-[40px] italic leading-none text-accent">
        {value}
      </div>
    </div>
  );
}

function NextClassCard({
  booking,
  timezone,
  balance,
  upcomingCount,
}: {
  booking: NextBooking | null;
  timezone: string;
  balance: number;
  upcomingCount: number;
}) {
  const session = booking?.session ?? null;
  const durationMin = session
    ? Math.max(
        0,
        Math.round(
          (new Date(session.end_at).getTime() - new Date(session.start_at).getTime()) / 60000,
        ),
      )
    : 60;

  return (
    <section className="myc-glass relative overflow-hidden p-7 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 size-[300px]"
        style={{
          background:
            "radial-gradient(closest-side, var(--myc-glow-2), transparent 70%)",
        }}
      />
      <div className="relative grid items-end gap-7 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Your next class
          </div>
          {session ? (
            <>
              <h2 className="mt-3 font-[family-name:var(--font-cormorant)] text-[clamp(1.8rem,3vw,2.4rem)] font-semibold leading-[1.1]">
                {session.class_category?.name ?? "Yoga session"} with{" "}
                {session.teacher?.display_name ?? "your teacher"}
              </h2>
              <p className="mt-2 text-[17px] text-foreground/75">
                <LocalTime
                  iso={session.start_at}
                  pattern="EEEE d MMMM"
                  fallbackTz={timezone}
                />{" "}
                ·{" "}
                <LocalTime iso={session.start_at} pattern="h:mm a" fallbackTz={timezone} /> ·{" "}
                {durationMin} min
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-3 font-[family-name:var(--font-cormorant)] text-[clamp(1.8rem,3vw,2.4rem)] font-semibold leading-[1.1]">
                Nothing booked yet.
              </h2>
              <p className="mt-2 text-[17px] text-foreground/75">
                Pick a teacher and a time that suit you.
              </p>
            </>
          )}

          <div className="mt-5 flex flex-wrap gap-2.5">
            {session?.meet_link ? (
              <a
                href={session.meet_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-accent px-5 py-3 text-[14.5px] font-semibold text-accent-foreground shadow-[0_14px_40px_-16px_color-mix(in_srgb,var(--accent)_45%,transparent)] transition-colors hover:bg-[var(--myc-accent-hover)]"
              >
                <Play className="size-4 fill-current" />
                Join session
              </a>
            ) : session ? (
              <span className="inline-flex items-center gap-2 border border-border bg-foreground/6 px-[18px] py-[11px] text-[14.5px] text-muted-foreground">
                {session.meet_status === "failed"
                  ? "Join link unavailable: we're retrying."
                  : "Join link will be ready shortly."}
              </span>
            ) : (
              <Link
                href="/dashboard/book"
                className="inline-flex items-center gap-2 bg-accent px-5 py-3 text-[14.5px] font-semibold text-accent-foreground shadow-[0_14px_40px_-16px_color-mix(in_srgb,var(--accent)_45%,transparent)] transition-colors hover:bg-[var(--myc-accent-hover)]"
              >
                Book my 1:1 session
              </Link>
            )}
            <Link
              href="/dashboard/bookings"
              className="inline-flex items-center border border-border bg-foreground/6 px-[18px] py-[11px] text-[14.5px] font-medium transition-colors hover:bg-foreground/12"
            >
              All bookings
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Sessions left" value={balance} />
          <Stat label="Upcoming" value={upcomingCount} />
        </div>
      </div>

      <div className="relative mt-5 flex items-center gap-2 border-t border-border pt-4 text-[13px] text-muted-foreground">
        <span className="myc-pulse-dot shrink-0" />
        Classes are live online. We&apos;ll email you the link too.
      </div>
    </section>
  );
}

/**
 * Slim in-context prompt shown on the overview when a class is booked and no
 * health document has been uploaded. The fuller pitch lives in
 * <HealthDocsNudge> on My bookings; here the ask is anchored to the class date
 * and stays one line tall so it never pushes the quick actions below the fold.
 */
function HealthDocsBanner({ startIso, timezone }: { startIso: string; timezone: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border border-accent/35 bg-accent/10 px-6 py-5">
      <div>
        <div className="font-semibold">
          Share a health report before{" "}
          <LocalTime iso={startIso} pattern="EEEE d MMMM" fallbackTz={timezone} />
        </div>
        <div className="mt-0.5 text-sm text-foreground/70">
          A recent scan or letter helps your teacher adapt the session to you.
        </div>
      </div>
      <Link
        href="/dashboard/documents"
        className="bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-[var(--myc-accent-hover)]"
      >
        Upload health documents
      </Link>
    </div>
  );
}

function QuickAction({
  index,
  href,
  title,
  body,
}: {
  index: string;
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="myc-glass flex flex-col gap-2.5 p-[26px] transition-transform duration-[400ms] ease-[cubic-bezier(.2,.7,.2,1)] hover:-translate-y-1"
    >
      <span className="font-[family-name:var(--font-cormorant)] text-[34px] italic leading-none text-accent">
        {index}
      </span>
      <span className="font-[family-name:var(--font-cormorant)] text-2xl font-semibold leading-[1.1]">
        {title}
      </span>
      <span className="text-sm text-muted-foreground">{body}</span>
    </Link>
  );
}
