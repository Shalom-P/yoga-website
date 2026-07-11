"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Layout cap so tall portrait phone videos don't take over the page. */
const MAX_HEIGHT_PX = 560;

/**
 * Plays a teacher's self-intro clip (MP4 from Supabase Storage, `intro_video_url`).
 * Native <video controls>. Render only when a URL exists.
 *
 * The rounded corners + clipping live on the WRAPPER, not the <video>. A <video>
 * is a replaced element: WebKit/Safari paints its native control bar outside the
 * element's own `border-radius`, so on hover a square-cornered black control box
 * pokes past the rounded video. Putting `overflow-hidden` + the radius on an
 * ancestor clips the controls to the video's shape in every browser.
 *
 * Sizing must be resolution- and orientation-independent: teachers upload phone
 * videos in any orientation and any resolution (240p up to 4K), and a forced
 * 16:9 frame with `object-cover` crops portrait clips (heads cut off), while
 * intrinsic sizing renders low-res clips postage-stamp small. So the wrapper's
 * `aspect-ratio` is set from the video's real dimensions (loadedmetadata), and
 * the frame fills the column width up to a height cap — every source lands at
 * the same layout size with no crop, no letterbox, no distortion. Until
 * metadata arrives the frame holds a 16:9 placeholder.
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
  const [ratio, setRatio] = useState<number | null>(null);

  // Also called from the ref: with SSR + `preload="metadata"` the browser can
  // fire loadedmetadata before hydration attaches the React listener.
  const readRatio = (video: HTMLVideoElement | null) => {
    if (video && video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth > 0) {
      setRatio(video.videoWidth / video.videoHeight);
    }
  };

  return (
    <div
      className={cn(
        "relative mx-auto w-full overflow-hidden rounded-[var(--radius)] border border-border bg-black",
        !ratio && "aspect-video",
        className,
      )}
      style={
        ratio
          ? { aspectRatio: `${ratio}`, maxWidth: `${Math.round(MAX_HEIGHT_PX * ratio)}px` }
          : undefined
      }
    >
      <video
        ref={readRatio}
        controls
        playsInline
        preload="metadata"
        poster={poster ?? undefined}
        aria-label={`Intro video: ${name}`}
        onLoadedMetadata={(e) => readRatio(e.currentTarget)}
        className="size-full object-cover"
      >
        <source src={src} />
        Your browser doesn&apos;t support embedded video.
      </video>
    </div>
  );
}
