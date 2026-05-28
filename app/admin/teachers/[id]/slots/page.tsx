import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";

const HOURS = Array.from({ length: 12 }, (_, i) => `${(6 + i).toString().padStart(2, "0")}:00`);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function TeacherSlotsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  return (
    <div className="p-8 max-w-6xl">
      <Link
        href={`/admin/teachers/${id}`}
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="size-3.5" />
        Back to teacher
      </Link>
      <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight">
        Availability
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Times shown in teacher&apos;s local time (IST). Click cells to toggle availability.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left text-muted-foreground font-medium">Time (IST)</th>
              {DAYS.map((d) => (
                <th key={d} className="px-3 py-2 text-left text-muted-foreground font-medium">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((h) => (
              <tr key={h} className="border-t border-border">
                <td className="px-3 py-2 text-muted-foreground">{h}</td>
                {DAYS.map((d) => (
                  <td key={d} className="px-1 py-1">
                    <button className="w-full h-7 rounded-md border border-border bg-card hover:bg-primary hover:text-primary-foreground transition-colors" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Wire toggles to <code>teacher_availability</code> via Server Actions. One-off
        overrides go to <code>teacher_slot_overrides</code>.
      </p>
    </div>
  );
}
