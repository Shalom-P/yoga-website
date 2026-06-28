"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

export function LenisProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Respect reduced motion: skip Lenis entirely so the browser's native
    // scrolling works. Keeping Lenis alive but turning off its RAF loop (the old
    // `autoRaf: false` approach) leaves it intercepting wheel events with nothing
    // to apply them — i.e. the page can't be scrolled with the mouse wheel at all.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      // Framerate-independent smoothing: every frame closes this fraction of the
      // distance left to the target. Windows mouse wheels emit large, discrete
      // deltas, so at the old lerp of 0.1 the page kept "catching up" a beat
      // behind the wheel — that trailing glide read as lag / non-responsiveness
      // next to a native-scrolling site. 0.2 settles in roughly half the frames,
      // so it tracks the wheel tightly while staying smooth on trackpads.
      lerp: 0.2,
      // >1 so a single Windows wheel notch travels a satisfying amount instead of
      // feeling like the page barely moves (a common "unresponsive" complaint).
      wheelMultiplier: 1.2,
      autoRaf: true,
    });
    lenisRef.current = lenis;

    return () => {
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Reset to the top on client-side route changes. The marketing layout (and so
  // this provider) persists across navigations, and Lenis overrides Next's
  // native scroll restoration — without this, navigating while scrolled down
  // lands you mid-page on the new route. Skip the first render so initial loads
  // (incl. back/forward restoration) aren't forced to the top.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    lenisRef.current?.scrollTo(0, { immediate: true });
  }, [pathname]);

  return <>{children}</>;
}
