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
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
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
