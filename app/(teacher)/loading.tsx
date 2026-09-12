import { Skeleton } from "@/components/ui/skeleton";

// Teacher routes are dynamic (ƒ) and read sessions/bookings through the
// service-role client on every navigation, so show the shape of the page rather
// than leaving the previous one on screen while that resolves.
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
