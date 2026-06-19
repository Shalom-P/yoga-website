import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/shared/JsonLd";
import { courseJsonLd } from "@/lib/seo/structuredData";
import { getClassCategories } from "@/lib/data/landing";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categories = await getClassCategories();
  const c = categories.find((x) => x.slug === slug);
  return {
    title: c?.name ?? "Class",
    description: c?.description ?? undefined,
    alternates: { canonical: `/classes/${slug}` },
  };
}

export default async function ClassDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categories = await getClassCategories();
  const c = categories.find((x) => x.slug === slug);
  if (!c) notFound();

  return (
    <article className="px-7 pt-32 pb-24">
      <JsonLd data={courseJsonLd(c, `${siteUrl}/classes/${c.slug}`)} />
      <div className="mx-auto max-w-3xl text-center">
        <div className="myc-eyebrow mb-4 justify-center capitalize">
          <span className="myc-dot" aria-hidden="true" />
          {c.intensity} intensity
        </div>
        <h1 className="text-[clamp(2.75rem,6vw,4.5rem)] leading-[1.08] tracking-tight">
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
          <Link href="/login?next=/dashboard/book">
            Book a free {c.name} session
            <ArrowRight className="size-4 ml-1" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
