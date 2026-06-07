"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useBrowserTz } from "@/components/dashboard/local-time";
import { toast } from "sonner";
import { isValidPhoneNumber } from "libphonenumber-js";

type Availability = {
  day_of_week: number; // 0 = Sun..6 = Sat
  start_time: string; // "06:00:00"
  end_time: string; // "12:00:00"
  slot_duration_minutes: number;
};

// A bookable slot plus the duration of the window it came from, so the duration
// the customer saw is exactly what gets POSTed to the API (not a hardcoded 60).
type Slot = { at: Date; durationMinutes: number };

type Props = {
  teacherId: string;
  teacherTimezone: string;
  customerTimezone: string;
  customerPhone: string | null;
  availability: Availability[];
  /** True when the customer has an active subscription → books paid sessions. */
  isMember: boolean;
};

function padHms(hms: string): string {
  // Postgres `time` columns can serialize as "06:00", "06:00:00", or "06:00:00.000".
  // Normalize to "HH:mm:ss" so the date string we hand to fromZonedTime parses cleanly.
  const parts = hms.split(":");
  const hh = (parts[0] ?? "00").padStart(2, "0");
  const mm = (parts[1] ?? "00").padStart(2, "0");
  const ss = (parts[2] ?? "00").slice(0, 2).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// For the next 7 days in the teacher's local TZ, expand each weekly window
// into discrete slots. Anchor on noon in teacher TZ so day-arithmetic stays
// stable across DST jumps and never spills into a neighbouring date.
function generateSlots(
  availability: Availability[],
  teacherTz: string,
  now: Date,
): Slot[] {
  const out: Slot[] = [];
  const todayStr = formatInTimeZone(now, teacherTz, "yyyy-MM-dd");
  const noonAnchorUtc = fromZonedTime(`${todayStr}T12:00:00`, teacherTz);
  for (let i = 0; i < 7; i++) {
    const dayAnchorUtc = addDays(noonAnchorUtc, i);
    const dateStr = formatInTimeZone(dayAnchorUtc, teacherTz, "yyyy-MM-dd");
    // date-fns-tz formats "i" as 1=Mon..7=Sun; Postgres day_of_week is 0=Sun..6=Sat.
    const isoDow = Number(formatInTimeZone(dayAnchorUtc, teacherTz, "i"));
    const dow = isoDow === 7 ? 0 : isoDow;
    for (const window of availability.filter((a) => a.day_of_week === dow)) {
      const dur = window.slot_duration_minutes || 60;
      const windowStartUtc = fromZonedTime(`${dateStr}T${padHms(window.start_time)}`, teacherTz);
      const windowEndUtc = fromZonedTime(`${dateStr}T${padHms(window.end_time)}`, teacherTz);
      let cur = windowStartUtc;
      while (addMinutes(cur, dur).getTime() <= windowEndUtc.getTime()) {
        if (cur.getTime() > now.getTime() + 15 * 60_000) {
          out.push({ at: cur, durationMinutes: dur });
        }
        cur = addMinutes(cur, dur);
      }
    }
  }
  return out;
}

export function TeacherSlotPicker({
  teacherId,
  teacherTimezone,
  customerTimezone,
  customerPhone,
  availability,
  isMember,
}: Props) {
  const router = useRouter();
  // Show slot times in the timezone the customer is actually in right now.
  const customerTz = useBrowserTz(customerTimezone);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // A phone number is mandatory to confirm a free class. If none is on file, a
  // slot click opens a dialog to collect it before the booking goes through.
  const [phone, setPhone] = useState(customerPhone ?? "+61 ");
  const [pendingSlot, setPendingSlot] = useState<Slot | null>(null);
  const [savingPhone, setSavingPhone] = useState(false);
  const hasPhone = Boolean((customerPhone ?? "").trim());

  const grouped = useMemo(() => {
    const now = new Date();
    const slots = generateSlots(availability, teacherTimezone, now);
    const buckets = new Map<string, Slot[]>();
    for (const s of slots) {
      const dayKey = formatInTimeZone(s.at, customerTz, "yyyy-MM-dd");
      const arr = buckets.get(dayKey) ?? [];
      arr.push(s);
      buckets.set(dayKey, arr);
    }
    return Array.from(buckets.entries()).slice(0, 7);
  }, [availability, teacherTimezone, customerTz]);

  function onSlotClick(slot: Slot) {
    if (hasPhone) book(slot);
    else setPendingSlot(slot);
  }

  async function book(slot: Slot) {
    setBusy(slot.at.toISOString());
    setError(null);
    const res = await fetch("/api/bookings/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        teacherId,
        startAt: slot.at.toISOString(),
        durationMinutes: slot.durationMinutes,
        isFreeTrial: !isMember,
      }),
    });
    setBusy(null);
    if (res.ok) {
      // Members go to their bookings; trial users get the plan upsell.
      router.push(isMember ? "/dashboard/bookings?booked=1" : "/dashboard/plan?booked=1");
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    // Server fell back to requiring a phone — collect it and retry this slot.
    if (body.error === "phone_required") {
      setPendingSlot(slot);
      return;
    }
    setError(body.error ?? "booking_failed");
  }

  // Save the phone to the profile, then confirm the pending booking.
  async function savePhoneAndBook() {
    const cleaned = phone.trim();
    if (!isValidPhoneNumber(cleaned)) {
      toast.error("Enter a valid phone number with country code, e.g. +61 4XX XXX XXX.");
      return;
    }
    if (!pendingSlot) return;
    setSavingPhone(true);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSavingPhone(false);
      toast.error("Session expired — please log in again.");
      return;
    }
    const { error: saveErr } = await supabase
      .from("profiles")
      .update({ phone: cleaned })
      .eq("id", user.id);
    setSavingPhone(false);
    if (saveErr) {
      toast.error(saveErr.message);
      return;
    }
    const slot = pendingSlot;
    setPendingSlot(null);
    await book(slot);
  }

  if (grouped.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
        No times available in the next 7 days. Check back soon or pick another teacher.
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error === "trial_already_claimed" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                You&apos;ve already claimed your free 1:1. Choose a plan to keep booking sessions.
              </span>
              <Button asChild size="sm" className="shrink-0 rounded-full">
                <Link href="/dashboard/plan">View plans &amp; pricing</Link>
              </Button>
            </div>
          ) : error === "subscription_required" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>Your subscription isn&apos;t active. Choose a plan to book sessions.</span>
              <Button asChild size="sm" className="shrink-0 rounded-full">
                <Link href="/dashboard/plan">View plans &amp; pricing</Link>
              </Button>
            </div>
          ) : error === "slot_taken" ? (
            "That slot was just booked by someone else. Try another time."
          ) : error === "slot_in_past" ? (
            "That time has just passed — pick a slot at least 15 minutes from now."
          ) : error === "slot_unavailable" ? (
            "The teacher isn't available then anymore — pick another time."
          ) : (
            "Couldn't book that slot. Please try again."
          )}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Times shown in your local time ({customerTz}). Teacher is in {teacherTimezone}.
      </div>

      {grouped.map(([dayKey, slots]) => (
        <div key={dayKey}>
          <div className="text-sm font-medium mb-2">
            {formatInTimeZone(slots[0].at, customerTz, "EEE, d LLL")}
          </div>
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => {
              const label = formatInTimeZone(s.at, customerTz, "h:mm a");
              const teacherLabel = formatInTimeZone(s.at, teacherTimezone, "h:mm a");
              const id = s.at.toISOString();
              return (
                <Button
                  key={id}
                  variant="outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => onSlotClick(s)}
                  className="rounded-full text-xs"
                  title={`Teacher's time: ${teacherLabel} · ${s.durationMinutes} min`}
                >
                  {busy === id ? "Booking…" : label}
                </Button>
              );
            })}
          </div>
        </div>
      ))}

      <Dialog open={pendingSlot !== null} onOpenChange={(o) => !o && setPendingSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add your phone number</DialogTitle>
            <DialogDescription>
              {pendingSlot
                ? `We'll confirm your free 1:1 on ${formatInTimeZone(pendingSlot.at, customerTz, "EEE d MMM, h:mm a")} and text you the details. A phone number is required to book.`
                : "A phone number is required to confirm your free class."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="booking-phone">Phone number</Label>
            <Input
              id="booking-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+61 4xx xxx xxx"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingSlot(null)} disabled={savingPhone}>
              Cancel
            </Button>
            <Button onClick={savePhoneAndBook} disabled={savingPhone}>
              {savingPhone ? <Loader2 className="size-4 animate-spin" /> : "Confirm free booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
