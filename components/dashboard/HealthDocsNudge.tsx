import Link from "next/link";
import { HeartPulse, Upload, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/dashboard/local-time";

/**
 * In-app nudge shown on the dashboard home when the customer has an upcoming
 * class but hasn't uploaded any medical documents yet. Rendering is decided by
 * the page (upcoming session + no documents); this is presentation only, so it
 * disappears on its own once the customer uploads a file.
 *
 * The class time is rendered via <LocalTime> (viewer's browser timezone), the
 * same path the "Your next class" card uses, so both never disagree for a
 * customer whose stored profile timezone differs from where they open the site.
 */
export function HealthDocsNudge({
  startIso,
  fallbackTz,
}: {
  startIso: string;
  fallbackTz: string;
}) {
  return (
    <div className="rounded-3xl border border-accent/30 bg-accent/5 p-6 sm:p-7">
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <HeartPulse className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.2em] text-accent font-medium">
            Before your class
          </div>
          <h2 className="mt-1 text-xl font-[family-name:var(--font-heading)] tracking-tight">
            Help your teacher prepare
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Your next class is{" "}
            <LocalTime iso={startIso} pattern="EEEE d MMM, h:mm a" fallbackTz={fallbackTz} />. If
            you have any medical reports or notes about injuries or health conditions, upload them
            so your teacher can tailor your 1:1. It&apos;s optional and private: only a teacher you
            choose to share with can open it.
          </p>
          <div className="mt-4">
            <Button asChild className="h-10 rounded-full">
              <Link href="/dashboard/documents">
                <Upload className="size-4 mr-1.5" />
                Upload health documents
                <ArrowRight className="size-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
