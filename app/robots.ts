import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /teacher is the private teacher surface. A bare "/teacher" prefix
        // would also swallow the public /teachers listing, so match the exact
        // path and its subtree only.
        // /login is deliberately NOT here: it is linked from every page, and a
        // Disallow would stop Google reading its noindex and leave a
        // contentless URL in the index. It carries robots:noindex instead.
        disallow: ["/admin", "/dashboard", "/api", "/teacher$", "/teacher/", "/onboarding", "/auth"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    // No `host`: it is a Yandex-only directive that Google and Bing ignore.
    // Host consolidation comes from the apex -> www redirect and the canonicals.
  };
}
