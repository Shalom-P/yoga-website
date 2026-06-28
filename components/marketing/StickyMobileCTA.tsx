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
      className={`fixed inset-x-0 bottom-0 z-40 p-3 transition-transform duration-300 md:hidden ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur">
        <div className="text-sm">
          <div className="font-medium">Book a 1:1 session</div>
          <div className="text-xs text-muted-foreground">Live on Google Meet</div>
        </div>
        <Button
          asChild
          size="sm"
          className="shrink-0 rounded-full bg-accent text-white hover:bg-accent/90"
          onClick={() => track("cta_click", { position: "sticky_mobile" })}
        >
          <Link href="/login?next=/dashboard/book">Book now</Link>
        </Button>
      </div>
    </div>
  );
}
