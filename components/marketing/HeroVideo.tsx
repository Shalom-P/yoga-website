"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Decorative hero backdrop.
 *
 * Bandwidth is the constraint here, not fidelity: the clip sits behind a heavy
 * scrim and is never the thing a visitor reads, so it is only ever worth its
 * bytes on a wide screen over a connection that isn't asking us to go easy.
 * Everyone else keeps the ~30 KB poster, which is what the video renders over
 * anyway, so there is no visible swap.
 *
 * The <video> is mounted without a `src` and only given one once we've decided
 * to play, because a `src` (or <source>) in the markup makes the browser fetch
 * the file whatever `preload` says. Withholding it is what actually keeps the
 * ~330 KB off the wire for the majority of visits.
 */
const VIDEO_SRC = "/hero.mp4";
const POSTER_SRC = "/hero-poster.jpg";

/** Narrower than this and the video is almost entirely behind the copy scrim. */
const MIN_WIDTH_PX = 768;

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
};

function shouldLoadVideo(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.matchMedia(`(min-width: ${MIN_WIDTH_PX}px)`).matches) return false;

  // Non-standard but widely supported on the Chromium/Android side, which is
  // where metered connections actually show up for this audience.
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (conn?.saveData) return false;
  if (conn?.effectiveType && /(^|-)2g$|^3g$/.test(conn.effectiveType)) return false;

  return true;
}

/** Re-checks when the viewport crosses the breakpoint or the connection changes. */
function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(`(min-width: ${MIN_WIDTH_PX}px)`);
  mql.addEventListener("change", onChange);
  const conn = (navigator as Navigator & { connection?: EventTarget }).connection;
  conn?.addEventListener?.("change", onChange);
  return () => {
    mql.removeEventListener("change", onChange);
    conn?.removeEventListener?.("change", onChange);
  };
}

export function HeroVideo({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Client-only decision: the server has no viewport or connection to read.
  // useSyncExternalStore gives us the post-hydration value without a
  // set-state-in-effect round trip, so the server snapshot is simply `false`.
  const canLoad = useSyncExternalStore(
    subscribe,
    shouldLoadVideo,
    () => false,
  );
  const enabled = !reduceMotion && canLoad;

  useEffect(() => {
    const v = videoRef.current;
    if (!enabled || !v) return;

    // React does not reliably reflect `muted` onto the element, and an unmuted
    // video is refused autoplay everywhere, so it would load and sit paused.
    v.muted = true;

    const play = () => {
      v.play().catch(() => {
        // Refused anyway (battery saver, data saver): the poster stands in.
      });
    };

    // Don't decode frames nobody is looking at — this is most of the battery
    // and CPU cost once the visitor has scrolled past the hero.
    let inView = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) play();
        else v.pause();
      },
      { threshold: 0.1 },
    );
    io.observe(v);

    const onVisibility = () => {
      // Guarded on inView: without it, returning to the tab resumed the video
      // even when it had been scrolled far off screen, undoing the pause above.
      if (document.visibilityState === "visible" && inView) play();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  return (
    <>
      {/* Always painted: the video's own backdrop, and the only visual for
          mobile, reduced-motion and save-data visitors. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative backdrop behind a scrim; next/image adds a transform hop for no benefit */}
      <img
        src={POSTER_SRC}
        alt=""
        aria-hidden="true"
        className={className}
        style={{ filter: "var(--myc-vid-filter)" }}
      />
      {enabled && (
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={POSTER_SRC}
          aria-hidden="true"
          tabIndex={-1}
          className={className}
          style={{ filter: "var(--myc-vid-filter)" }}
        />
      )}
    </>
  );
}
