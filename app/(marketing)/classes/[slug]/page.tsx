import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/shared/JsonLd";
import { courseJsonLd } from "@/lib/seo/structuredData";
import { getClassCategories } from "@/lib/data/landing";
import { getConditionPage } from "@/lib/data/condition-pages";
import { ConditionLanding } from "@/components/marketing/condition/ConditionLanding";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";

type Category = Awaited<ReturnType<typeof getClassCategories>>[number];

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categories = await getClassCategories();
  const c = categories.find((x) => x.slug === slug);
  const rich = getConditionPage(slug);
  return {
    title: c?.name ?? "Class",
    description: rich?.metaDescription ?? c?.long_description ?? c?.description ?? undefined,
    alternates: { canonical: `/classes/${slug}` },
  };
}

export default async function ClassDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categories = await getClassCategories();
  const c = categories.find((x) => x.slug === slug);
  if (!c) notFound();

  const rich = getConditionPage(slug);

  return (
    <>
      <JsonLd data={courseJsonLd(c, `${siteUrl}/classes/${c.slug}`)} />
      {rich ? <ConditionLanding data={rich} /> : <SimpleDetail c={c} />}
    </>
  );
}

/**
 * Fallback layout for any class category that has no rich landing content yet
 * (renders straight from the class_categories DB row). The 9 condition pages all
 * have rich content via lib/data/condition-pages.
 */
function SimpleDetail({ c }: { c: Category }) {
  const cta = (
    <Button asChild size="lg" className="h-12 rounded-full px-6">
      <Link href="/login?next=/dashboard/book">
        Book my free 1:1 session
        <ArrowRight className="ml-1 size-4" />
      </Link>
    </Button>
  );

  return (
    <article className="px-7 pt-32 pb-24">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <div className="myc-eyebrow mb-4 justify-center capitalize">
            <span className="myc-dot" aria-hidden="true" />
            {c.intensity} intensity
          </div>
          <h1 className="text-[clamp(2.75rem,6vw,4.5rem)] leading-[1.08] tracking-tight">
            {c.name}
          </h1>
          <p className="mt-5 text-lg text-muted-foreground text-pretty">{c.description}</p>
          <div className="mt-9">{cta}</div>
        </div>

        <div className="mt-16 space-y-14">
          {c.long_description && (
            <p className="text-lg leading-relaxed text-foreground/80 text-pretty">
              {c.long_description}
            </p>
          )}

          {c.helps_with.length > 0 && (
            <section>
              <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-primary">
                What it can help with
              </h2>
              <ul className="flex flex-wrap gap-2">
                {c.helps_with.map((h) => (
                  <li
                    key={h}
                    className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/80"
                  >
                    {h}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {c.what_to_expect.length > 0 && (
            <section>
              <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-primary">
                What to expect in a session
              </h2>
              <ul className="space-y-3">
                {c.what_to_expect.map((w) => (
                  <li key={w} className="flex gap-3">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="size-3.5" />
                    </span>
                    <span className="text-foreground/80 text-pretty">{w}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(c.who_for || c.props_needed.length > 0) && (
            <section className="grid gap-5 sm:grid-cols-2">
              {c.who_for && (
                <div className="rounded-3xl border border-border bg-card p-6">
                  <h3 className="mb-2 font-medium">Who it&apos;s for</h3>
                  <p className="text-sm text-muted-foreground text-pretty">{c.who_for}</p>
                </div>
              )}
              {c.props_needed.length > 0 && (
                <div className="rounded-3xl border border-border bg-card p-6">
                  <h3 className="mb-2 font-medium">What you&apos;ll need</h3>
                  <p className="text-sm text-muted-foreground capitalize">
                    {c.props_needed.join(", ")}
                  </p>
                </div>
              )}
            </section>
          )}

          <p className="rounded-2xl bg-secondary/40 px-5 py-4 text-sm text-muted-foreground text-pretty">
            Yoga supports your overall wellbeing and is practised alongside professional medical
            care — it is not a substitute for diagnosis, treatment, or medication. Tell your teacher
            about any conditions so they can adapt your session safely.
          </p>

          <div className="pt-2 text-center">
            {cta}
            <p className="mt-3 text-xs text-muted-foreground">
              Free 1:1 trial · No credit card · 60 min, live on Google Meet
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
