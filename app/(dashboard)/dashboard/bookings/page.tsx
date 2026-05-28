import Link from "next/link";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BookingsPage() {
  // TODO: query bookings table for current user. Placeholder for v1.
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium">
        Your bookings
      </div>
      <h1 className="text-3xl md:text-4xl font-[family-name:var(--font-heading)] tracking-tight mt-1">
        Past & upcoming
      </h1>

      <div className="mt-10 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
        <Calendar className="size-10 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No bookings yet.</p>
        <Button asChild className="mt-5 rounded-full">
          <Link href="/dashboard/book">Book your first class</Link>
        </Button>
      </div>
    </div>
  );
}
