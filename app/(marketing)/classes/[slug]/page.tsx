import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getClassCategories } from "@/lib/data/landing";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categories = await getClassCategories();
  const c = categories.find((x) => x.slug === slug);
  return { title: c?.name ?? "Class", description: c?.description ?? undefined };
}

export default async function ClassDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categories = await getClassCategories();
  const c = categories.find((x) => x.slug === slug);
  if (!c) notFound();

  return (
    <article className="pt-32 pb-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
        <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">
          {c.intensity} intensity
        </div>
        <h1 className="text-4xl md:text-6xl font-[family-name:var(--font-heading)] tracking-tight">
          {c.name}
        </h1>
        <p className="mt-5 text-lg text-muted-foreground text-pretty">{c.description}</p>
        {c.props_needed.length > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">What you&apos;ll need:</span>{" "}
            {c.props_needed.join(", ")}
          </p>
        )}
        <Button asChild size="lg" className="mt-10 h-12 px-6 rounded-full">
          <Link href={`/login?next=/onboarding%3Fclass%3D${c.slug}`}>
            Book a free {c.name} session
            <ArrowRight className="size-4 ml-1" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
