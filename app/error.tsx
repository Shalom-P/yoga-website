"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shared/BrandMark";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Boundary-caught render errors never become unhandled window errors, so
    // they must be reported explicitly or they vanish from monitoring.
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <div className="myc-theme min-h-dvh flex flex-col items-center justify-center px-6 py-16 text-center">
      <BrandMark className="size-12 [&_svg]:size-6" />
      <h1 className="mt-8 text-4xl md:text-5xl font-[family-name:var(--font-cormorant)] tracking-tight">
        Something went <span className="text-accent italic">out of balance.</span>
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        An unexpected error occurred. Try again — if it keeps happening, we&apos;d love to hear
        about it.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button
          size="lg"
          className="h-12 rounded-full px-7 bg-accent text-white hover:bg-accent/90"
          onClick={reset}
        >
          Try again
        </Button>
        <Button asChild variant="outline" size="lg" className="h-12 rounded-full px-7">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
