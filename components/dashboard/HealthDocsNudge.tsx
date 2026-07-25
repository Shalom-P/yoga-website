import Link from "next/link";
import { HeartPulse, Upload, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/dashboard/local-time";
import { cn } from "@/lib/utils";

/**
 * In-app nudge shown when a customer hasn't uploaded any medical documents yet.
 * Rendering is decided by the page (dashboard home: an upcoming class and no
 * documents; My bookings: no documents at all), so this is presentation only and
 * it disappears on its own once the customer uploads a file.
 *
 * `startIso` is optional: pass the next class's start when there is one and the
 * copy anchors the ask to that class, omit it and the copy stays timeless for a
 * customer with nothing on the calendar yet. The class time is rendered via
 * <LocalTime> (viewer's browser timezone), the same path the "Your next class"
 * card uses, so both never disagree for a customer whose stored profile timezone
 * differs from where they open the site.
 */
export function HealthDocsNudge({
  startIso,
  fallbackTz,
  className,
}: {
  startIso?: string | null;
  fallbackTz: string;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-3xl border border-accent/30 bg-accent/5 p-6 sm:p-7", className)}
    >
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <HeartPulse className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.2em] text-accent font-medium">
            {startIso ? "Before your class" : "Health documents"}
          </div>
          <h2 className="mt-1 text-xl font-[family-name:var(--font-heading)] tracking-tight">
            Help your teacher prepare
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {startIso ? (
              <>
                Your next class is{" "}
                <LocalTime iso={startIso} pattern="EEEE d MMM, h:mm a" fallbackTz={fallbackTz} />.{" "}
              </>
            ) : (
              <>You haven&apos;t added any health documents yet. </>
            )}
            If you have any medical reports or notes about injuries or health conditions, upload
            them so your teacher can tailor your 1:1. It&apos;s optional and private: only a
            teacher you choose to share with can open it.
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
