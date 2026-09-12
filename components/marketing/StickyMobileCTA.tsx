"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/events";

export function StickyMobileCTA() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[60] p-3 transition-transform duration-300 md:hidden ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="myc-glass-bar flex items-center justify-between gap-3 py-3 pl-[18px] pr-3">
        <div className="text-sm">
          <div className="text-[14.5px] font-semibold">Book a 1:1 session</div>
          <div className="text-xs text-muted-foreground">Live online · 60 min</div>
        </div>
        <Button
          asChild
          size="sm"
          className="shrink-0 bg-accent text-accent-foreground hover:bg-[var(--myc-accent-hover)] hover:text-accent-foreground"
          onClick={() => track("cta_click", { position: "sticky_mobile" })}
        >
          <Link href="/login?next=/dashboard/book">Book now</Link>
        </Button>
      </div>
    </div>
  );
}
