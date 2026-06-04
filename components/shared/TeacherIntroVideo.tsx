import { cn } from "@/lib/utils";

/**
 * Plays a teacher's self-intro clip (MP4 from Supabase Storage, `intro_video_url`).
 * Native <video controls> — no client JS needed. Render only when a URL exists.
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
    <video
      controls
      preload="metadata"
      poster={poster ?? undefined}
      aria-label={`Intro video — ${name}`}
      className={cn(
        "aspect-video w-full rounded-[var(--radius)] border border-border bg-black object-cover",
        className,
      )}
    >
      <source src={src} />
      Your browser doesn&apos;t support embedded video.
    </video>
  );
}
