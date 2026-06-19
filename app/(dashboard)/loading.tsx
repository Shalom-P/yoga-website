import { Skeleton } from "@/components/ui/skeleton";

// Shown while a dashboard route's server data resolves (these pages are dynamic,
// so a skeleton beats a blank screen during navigation).
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-40 w-full rounded-3xl" />
      <div className="grid sm:grid-cols-2 gap-5">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    </div>
  );
}
