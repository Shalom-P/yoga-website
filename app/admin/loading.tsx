import { Skeleton } from "@/components/ui/skeleton";

// Admin routes are dynamic (ƒ): every navigation re-runs their Supabase queries
// server-side, so without this the shell sits on the previous page until the new
// one resolves and the click feels unacknowledged. Mirrors the dashboard
// skeleton, shaped for the wider table-and-KPI layouts.
export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-56" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
