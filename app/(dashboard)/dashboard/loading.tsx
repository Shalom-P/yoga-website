import { Skeleton } from "@/components/ui/skeleton";

// Shown while a dashboard route's server data resolves. These pages are dynamic
// (ƒ) and every one of them waits on two sequential Supabase round trips —
// auth.getUser(), then its own queries — so without a boundary a click sits
// there doing nothing until the new page resolves.
//
// This file MUST live at the `dashboard` segment, not one level up in the
// (dashboard) group. A loading.tsx only fires for navigations that replace a
// segment BELOW it: a group-level boundary covers the first entry into the
// group and then never fires again, so switching between /dashboard,
// /dashboard/bookings and /dashboard/plan showed no feedback at all. Verified
// both ways against a scratch route before moving it here.
//
// It also earns its keep in production: Next only prefetches the loading
// boundary for a dynamic route, so with no boundary at this level a hovered
// <Link> prefetches nothing. The layout owns the page container, so this only
// stands in for the content column.
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-7">
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-11 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-52 w-full" />
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    </div>
  );
}
