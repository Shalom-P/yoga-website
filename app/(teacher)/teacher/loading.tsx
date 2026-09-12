import { Skeleton } from "@/components/ui/skeleton";

// Teacher routes are dynamic (ƒ) and read sessions/bookings through the
// service-role client on every navigation, so show the shape of the page rather
// than leaving the previous one on screen while that resolves.
//
// This file MUST live at the `teacher` segment, not one level up in the
// (teacher) group. A loading.tsx only fires for navigations that replace a
// segment BELOW it, so a group-level boundary covered the first entry into the
// group and then never fired again: switching between /teacher, /teacher/sessions
// and /teacher/availability showed no feedback at all. It also gates prefetch —
// Next only prefetches the loading boundary for a dynamic route, so with none at
// this level a hovered <Link> prefetched nothing. Same fix as
// app/(dashboard)/dashboard/loading.tsx; app/admin/loading.tsx is already at the
// right level because `admin` is a real segment rather than a group.
export default function TeacherLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
