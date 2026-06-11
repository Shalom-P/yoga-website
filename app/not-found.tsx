import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shared/BrandMark";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="myc-theme min-h-dvh flex flex-col items-center justify-center px-6 py-16 text-center">
      <BrandMark className="size-12 [&_svg]:size-6" />
      <p className="myc-eyebrow mt-8 justify-center">
        <span className="myc-dot" aria-hidden="true" />
        404
      </p>
      <h1 className="mt-3 text-4xl md:text-5xl font-[family-name:var(--font-cormorant)] tracking-tight">
        This page has <span className="text-accent italic">wandered off the mat.</span>
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg" className="h-12 rounded-full px-7 bg-accent text-white hover:bg-accent/90">
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-12 rounded-full px-7">
          <Link href="/teachers">Meet the teachers</Link>
        </Button>
      </div>
    </div>
  );
}
