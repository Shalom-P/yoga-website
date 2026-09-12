"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/events";
import { useViewer, viewerPrimaryCta } from "@/lib/auth/useViewer";

export function StickyMobileCTA() {
  const [show, setShow] = useState(false);
  const viewer = useViewer();
  const cta = viewerPrimaryCta(viewer.role);
  // Someone already signed in goes straight into the flow: /login only bounces
  // them back out via middleware, which costs a getUser() plus a profiles read.
  const href = viewer.signedIn ? cta.href : "/login?next=/dashboard/book";

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      // z-40, below the z-50 dialog/sheet overlay: at z-[60] this bar floated over
      // an open modal and swallowed taps meant for its footer buttons.
      className={`fixed inset-x-0 bottom-0 z-40 p-3 transition-transform duration-300 md:hidden ${
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
          <Link href={href}>
            {viewer.signedIn && viewer.role === "teacher" ? "My schedule" : "Book now"}
          </Link>
        </Button>
      </div>
    </div>
  );
}
