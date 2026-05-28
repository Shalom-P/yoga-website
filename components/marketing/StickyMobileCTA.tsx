"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/events";

export function StickyMobileCTA() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 1.2);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="md:hidden fixed bottom-3 inset-x-3 z-30"
        >
          <Button
            asChild
            size="lg"
            className="w-full h-12 rounded-full shadow-lg shadow-primary/30 text-base"
            onClick={() => track("cta_click", { position: "sticky_mobile" })}
          >
            <Link href="/login?next=/onboarding">Book my free 1:1 session</Link>
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
