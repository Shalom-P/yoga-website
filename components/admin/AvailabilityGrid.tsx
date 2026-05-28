"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TeacherAvailability } from "@/lib/supabase/types";

type Props = {
  teacherId: string;
  initial: TeacherAvailability[];
};

const HOURS = Array.from({ length: 12 }, (_, i) => 6 + i); // 06..17
const DAYS = [
  { dow: 0, label: "Sun" },
  { dow: 1, label: "Mon" },
  { dow: 2, label: "Tue" },
  { dow: 3, label: "Wed" },
  { dow: 4, label: "Thu" },
  { dow: 5, label: "Fri" },
  { dow: 6, label: "Sat" },
];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function timeKey(dow: number, hour: number) {
  return `${dow}:${pad(hour)}`;
}

export function AvailabilityGrid({ teacherId, initial }: Props) {
  const supabase = createSupabaseBrowserClient();

  // Map cellKey -> rowId for one-hour windows we can edit in the grid.
  // Custom-duration / cross-hour rows are left untouched and surfaced below.
  const [cells, setCells] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const r of initial) {
      const startH = Number(r.start_time.slice(0, 2));
      const startM = Number(r.start_time.slice(3, 5));
      const endH = Number(r.end_time.slice(0, 2));
      const endM = Number(r.end_time.slice(3, 5));
      if (
        startM === 0 &&
        endM === 0 &&
        r.slot_duration_minutes === 60 &&
        endH - startH === 1 &&
        startH >= 6 &&
        startH <= 17
      ) {
        m.set(timeKey(r.day_of_week, startH), r.id);
      }
    }
    return m;
  });

  const customRows = useMemo(
    () =>
      initial.filter((r) => {
        const startH = Number(r.start_time.slice(0, 2));
        const startM = Number(r.start_time.slice(3, 5));
        const endH = Number(r.end_time.slice(0, 2));
        const endM = Number(r.end_time.slice(3, 5));
        return !(
          startM === 0 &&
          endM === 0 &&
          r.slot_duration_minutes === 60 &&
          endH - startH === 1 &&
          startH >= 6 &&
          startH <= 17
        );
      }),
    [initial]
  );

  const [pending, setPending] = useState<Set<string>>(new Set());

  async function toggle(dow: number, hour: number) {
    const key = timeKey(dow, hour);
    if (pending.has(key)) return;
    setPending((p) => new Set(p).add(key));

    const existingId = cells.get(key);

    if (existingId) {
      const { error } = await supabase
        .from("teacher_availability")
        .delete()
        .eq("id", existingId);
      if (error) {
        toast.error(error.message);
      } else {
        setCells((m) => {
          const n = new Map(m);
          n.delete(key);
          return n;
        });
      }
    } else {
      const { data, error } = await supabase
        .from("teacher_availability")
        .insert({
          teacher_id: teacherId,
          day_of_week: dow,
          start_time: `${pad(hour)}:00:00`,
          end_time: `${pad(hour + 1)}:00:00`,
          slot_duration_minutes: 60,
        })
        .select("id")
        .single();
      if (error || !data) {
        toast.error(error?.message ?? "Insert failed");
      } else {
        setCells((m) => {
          const n = new Map(m);
          n.set(key, data.id);
          return n;
        });
      }
    }

    setPending((p) => {
      const n = new Set(p);
      n.delete(key);
      return n;
    });
  }

  return (
    <>
      <div className="mt-8 rounded-2xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left text-muted-foreground font-medium">Time (IST)</th>
              {DAYS.map((d) => (
                <th key={d.dow} className="px-3 py-2 text-left text-muted-foreground font-medium">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((h) => (
              <tr key={h} className="border-t border-border">
                <td className="px-3 py-2 text-muted-foreground">
                  {pad(h)}:00 – {pad(h + 1)}:00
                </td>
                {DAYS.map((d) => {
                  const key = timeKey(d.dow, h);
                  const active = cells.has(key);
                  const isPending = pending.has(key);
                  return (
                    <td key={d.dow} className="px-1 py-1">
                      <button
                        type="button"
                        onClick={() => toggle(d.dow, h)}
                        disabled={isPending}
                        aria-pressed={active}
                        aria-label={`${d.label} ${pad(h)}:00`}
                        className={cn(
                          "w-full h-8 rounded-md border transition-colors flex items-center justify-center",
                          active
                            ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                            : "border-border bg-card hover:bg-muted",
                          isPending && "opacity-60"
                        )}
                      >
                        {isPending && <Loader2 className="size-3 animate-spin" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Click a cell to toggle a 1-hour availability window in the teacher&apos;s timezone. Changes save instantly.
      </p>

      {customRows.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 text-xs">
          <div className="font-medium mb-1">Custom windows (not editable in the grid)</div>
          <ul className="text-muted-foreground space-y-1">
            {customRows.map((r) => (
              <li key={r.id}>
                {DAYS.find((d) => d.dow === r.day_of_week)?.label} ·{" "}
                {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)} ({r.slot_duration_minutes} min slots)
              </li>
            ))}
          </ul>
          <p className="mt-2">
            These were created outside the grid (e.g., a 90-minute Sunday workshop). Edit them
            directly in the database for now.
          </p>
        </div>
      )}
    </>
  );
}
