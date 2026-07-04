import { cn } from "@/lib/utils";

/**
 * Plays a teacher's self-intro clip (MP4 from Supabase Storage, `intro_video_url`).
 * Native <video controls>, no client JS needed. Render only when a URL exists.
 *
 * The rounded corners + clipping live on the WRAPPER, not the <video>. A <video>
 * is a replaced element: WebKit/Safari paints its native control bar outside the
 * element's own `border-radius`, so on hover a square-cornered black control box
 * pokes past the rounded video. Putting `overflow-hidden` + the radius on an
 * ancestor clips the controls to the video's shape in every browser.
 */
export function TeacherIntroVideo({
  src,
  poster,
  name,
  className,
}: {
  src: string;
  poster?: string | null;
  name: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-[var(--radius)] border border-border bg-black",
        className,
      )}
    >
      <video
        controls
        preload="metadata"
        poster={poster ?? undefined}
        aria-label={`Intro video: ${name}`}
        className="size-full object-cover"
      >
        <source src={src} />
        Your browser doesn&apos;t support embedded video.
      </video>
    </div>
  );
}
