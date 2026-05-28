"use client";

import { useEffect } from "react";
import Lenis from "lenis";

export function LenisProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      // Respect reduced motion: skip smooth scroll for those users
      autoRaf: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    return () => lenis.destroy();
  }, []);
  return <>{children}</>;
}
