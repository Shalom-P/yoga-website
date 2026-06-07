import type { MetadataRoute } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  {
    url: `${BASE_URL}/`,
    changeFrequency: "daily",
    priority: 1.0,
    lastModified: new Date(),
  },
  {
    url: `${BASE_URL}/about`,
    changeFrequency: "monthly",
    priority: 0.8,
    lastModified: new Date(),
  },
  {
    url: `${BASE_URL}/classes`,
    changeFrequency: "weekly",
    priority: 0.9,
    lastModified: new Date(),
  },
  {
    url: `${BASE_URL}/pricing`,
    changeFrequency: "weekly",
    priority: 0.9,
    lastModified: new Date(),
  },
  {
    url: `${BASE_URL}/teachers`,
    changeFrequency: "weekly",
    priority: 0.9,
    lastModified: new Date(),
  },
  {
    url: `${BASE_URL}/reviews`,
    changeFrequency: "weekly",
    priority: 0.7,
    lastModified: new Date(),
  },
  {
    url: `${BASE_URL}/faq`,
    changeFrequency: "monthly",
    priority: 0.6,
    lastModified: new Date(),
  },
  {
    url: `${BASE_URL}/contact`,
    changeFrequency: "monthly",
    priority: 0.6,
    lastModified: new Date(),
  },
  {
    url: `${BASE_URL}/legal/privacy`,
    changeFrequency: "yearly",
    priority: 0.3,
    lastModified: new Date(),
  },
  {
    url: `${BASE_URL}/legal/terms`,
    changeFrequency: "yearly",
    priority: 0.3,
    lastModified: new Date(),
  },
  {
    url: `${BASE_URL}/legal/refund`,
    changeFrequency: "yearly",
    priority: 0.3,
    lastModified: new Date(),
  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dynamicRoutes: MetadataRoute.Sitemap = [];

  try {
    const supabase = await createSupabaseServerClient();

    const [teachersResult, categoriesResult] = await Promise.all([
      supabase
        .from("teachers")
        .select("slug, updated_at")
        .eq("is_active", true),
      supabase
        .from("class_categories")
        .select("slug, updated_at")
        .eq("is_active", true),
    ]);

    const teachers = teachersResult.data ?? [];
    const categories = categoriesResult.data ?? [];

    for (const teacher of teachers) {
      if (teacher.slug) {
        dynamicRoutes.push({
          url: `${BASE_URL}/teachers/${teacher.slug}`,
          changeFrequency: "monthly",
          priority: 0.7,
          lastModified: teacher.updated_at ? new Date(teacher.updated_at) : new Date(),
        });
      }
    }

    for (const category of categories) {
      if (category.slug) {
        dynamicRoutes.push({
          url: `${BASE_URL}/classes/${category.slug}`,
          changeFrequency: "monthly",
          priority: 0.7,
          lastModified: category.updated_at ? new Date(category.updated_at) : new Date(),
        });
      }
    }
  } catch {
    // Supabase not configured or query failed — return static routes only.
  }

  return [...STATIC_ROUTES, ...dynamicRoutes];
}
