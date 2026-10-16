import type { MetadataRoute } from "next";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import { CONDITION_SLUGS } from "@/lib/data/condition-pages";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";

// Regenerate on the same cadence as the marketing pages rather than on every
// request. This route previously used the cookie-bound Supabase client, which
// forced it dynamic (x-vercel-cache: MISS on every Googlebot fetch).
export const revalidate = 3600;

// `changeFrequency` and `priority` are deliberately omitted: Google has stated
// for years that it ignores both, and Bing treats them as hints at best. They
// were also actively misleading here, claiming "daily" for pages that change
// a few times a year.
//
// `lastModified` is likewise omitted for static routes. It used to be
// `new Date()` evaluated at module scope, so it reported the serverless
// instance's cold-start time and varied between instances for content that had
// not changed. An inconsistent lastmod is worse than none: it is the specific
// pattern that makes Google discard the signal for the whole file. Teacher
// pages keep their row's `updated_at`, which is a true modification time
// because their content is that row; condition pages do not (see below).
const STATIC_PATHS = [
  "/",
  "/about",
  "/classes",
  "/pricing",
  "/teachers",
  "/reviews",
  "/faq",
  "/contact",
  "/private-online-yoga-classes",
  "/doctor-led-yoga-therapy",
  "/guides/what-private-online-yoga-costs",
  "/online-yoga-classes-usa",
  "/online-yoga-classes-uae",
  "/classes/prenatal/poses-to-avoid",
  "/legal/privacy",
  "/legal/terms",
  "/legal/refund",
];

const STATIC_ROUTES: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
  url: `${BASE_URL}${path}`,
}));

// Build-time fallback for the condition pages. If the Supabase query fails we
// still emit all nine, because they are prerendered from this same constant
// (generateStaticParams) and therefore always exist. The previous bare
// `catch {}` returned static routes only, silently shrinking the sitemap from
// 23 URLs to 11 on a single failed round trip, with nothing to alert on.
const CONDITION_FALLBACK: MetadataRoute.Sitemap = CONDITION_SLUGS.map((slug) => ({
  url: `${BASE_URL}/classes/${slug}`,
}));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const teachers: MetadataRoute.Sitemap = [];
  let categories: MetadataRoute.Sitemap = [];
  // /reviews is noindex while it has nothing to show; listing a noindex URL in
  // the sitemap sends Search Console a contradiction. Kept on failure, since
  // the page itself falls back to rendering whatever the query returns.
  let hasReviews = true;

  try {
    const supabase = createSupabaseAnonClient();

    const [teachersResult, categoriesResult, reviewsResult] = await Promise.all([
      supabase.from("teachers").select("slug, updated_at").eq("is_active", true).eq("is_public", true),
      supabase.from("class_categories").select("slug").eq("is_active", true),
      // Same filter as getFeaturedReviews, which decides the page's robots tag.
      supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("is_featured", true)
        .eq("is_approved", true),
    ]);

    if (teachersResult.error) throw teachersResult.error;
    if (categoriesResult.error) throw categoriesResult.error;
    if (!reviewsResult.error) hasReviews = (reviewsResult.count ?? 0) > 0;

    for (const teacher of teachersResult.data ?? []) {
      if (!teacher.slug) continue;
      teachers.push({
        url: `${BASE_URL}/teachers/${teacher.slug}`,
        lastModified: teacher.updated_at ? new Date(teacher.updated_at) : undefined,
      });
    }

    // No lastModified: a condition page's content lives in
    // lib/data/condition-pages/*.json, so the row's updated_at (still June for
    // most of them) says nothing about when the page last changed.
    categories = (categoriesResult.data ?? [])
      .filter((c) => c.slug)
      .map((c) => ({ url: `${BASE_URL}/classes/${c.slug}` }));
  } catch (err) {
    // Surface it: a shrinking sitemap is invisible in production otherwise, and
    // there is no Sentry on this route today.
    console.error("[sitemap] Supabase query failed, using static fallback", err);
  }

  // Never emit fewer condition URLs than we prerender, whatever the DB says.
  if (categories.length < CONDITION_FALLBACK.length) {
    const seen = new Set(categories.map((c) => c.url));
    categories = [...categories, ...CONDITION_FALLBACK.filter((c) => !seen.has(c.url))];
  }

  const statics = hasReviews
    ? STATIC_ROUTES
    : STATIC_ROUTES.filter((r) => r.url !== `${BASE_URL}/reviews`);

  return [...statics, ...categories, ...teachers];
}
