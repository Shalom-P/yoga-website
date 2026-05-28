import Link from "next/link";
import { ArrowRight, Video, Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";

export default async function DashboardHome() {
  const { user, supabase } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, timezone")
    .eq("id", user.id)
    .single();

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

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
          Times shown in {profile?.timezone ?? "your local time"}.
        </p>
      </header>

      <NextClassCard />

      <div className="grid sm:grid-cols-2 gap-5">
        <Link
          href="/dashboard/book"
          className="rounded-2xl border border-border bg-card p-6 hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          <Calendar className="size-6 text-primary mb-3" />
          <div className="font-medium">Book a class</div>
          <div className="text-sm text-muted-foreground mt-1">
            Find the next 1:1 or group class that fits your day.
          </div>
        </Link>
        <Link
          href="/dashboard/plan"
          className="rounded-2xl border border-border bg-card p-6 hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          <Sparkles className="size-6 text-primary mb-3" />
          <div className="font-medium">Upgrade your plan</div>
          <div className="text-sm text-muted-foreground mt-1">
            Move from free trial to unlimited classes.
          </div>
        </Link>
      </div>
    </div>
  );
}

async function NextClassCard() {
  // TODO: query next upcoming booking for the user. Placeholder for v1.
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
          <Link href="/teachers">Browse teachers</Link>
        </Button>
      </div>
      <div className="mt-6 text-xs text-muted-foreground flex items-center gap-2">
        <Video className="size-3.5" />
        Classes meet on Google Meet — we&apos;ll email you the link.
      </div>
    </div>
  );
}
