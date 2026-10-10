"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ERROR_COPY: Record<string, string> = {
  already_reviewed: "You have already reviewed this session. Thank you.",
  not_finished: "You can review a session once it has finished.",
  cancelled: "This session was cancelled, so there is nothing to review.",
  not_found: "We could not find that session on your account.",
  unauthenticated: "Your session expired. Please log in again.",
};

export function ReviewForm({
  bookingId,
  teacherName,
  defaultDisplayName,
}: {
  bookingId: string;
  teacherName: string;
  defaultDisplayName: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [displayLocation, setDisplayLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      toast.error("Pick a star rating first.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingId,
          rating,
          body: body.trim() || undefined,
          displayName: displayName.trim() || undefined,
          displayLocation: displayLocation.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(ERROR_COPY[data.error ?? ""] ?? "Could not save your review. Please try again.");
        return;
      }
      toast.success("Thank you. We read every review before it goes live.");
      router.push("/dashboard/bookings");
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const shown = hover || rating;

  return (
    <form onSubmit={onSubmit} className="myc-glass mt-7 space-y-6 p-6 md:p-8">
      <fieldset>
        <legend className="text-sm font-medium">Your rating for {teacherName}</legend>
        <div className="mt-2 flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              aria-pressed={rating === n}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(0)}
              onClick={() => setRating(n)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={cn(
                  "size-8",
                  n <= shown ? "fill-accent text-accent" : "text-muted-foreground/50"
                )}
              />
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="review-body">What was the session like? (optional)</Label>
        <Textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 1000))}
          rows={5}
          placeholder="What you worked on, how the teacher adapted to you, and what you would tell someone deciding whether to book."
        />
        <p className="text-xs text-muted-foreground">{body.length} / 1000</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="review-name">Name to show</Label>
          <Input
            id="review-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
            placeholder="First name is fine"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="review-location">City or country (optional)</Label>
          <Input
            id="review-location"
            value={displayLocation}
            onChange={(e) => setDisplayLocation(e.target.value.slice(0, 60))}
            placeholder="Dubai, UAE"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-pretty">
        We read every review before it is published and never edit the words. Your email
        address is never shown.
      </p>

      <Button
        type="submit"
        disabled={submitting}
        className="bg-accent text-accent-foreground hover:bg-[var(--myc-accent-hover)]"
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : "Submit review"}
      </Button>
    </form>
  );
}
