/**
 * One-shot IndexNow submission of every URL in the live sitemap.
 *
 * Run after a deploy that changes many pages at once, or to (re)announce the
 * whole site. Day-to-day, admin saves ping IndexNow automatically through
 * /api/admin/revalidate.
 *
 * `lib/seo/indexnow.ts` imports `server-only`, which is a Next.js bundler alias
 * and NOT an installed package, so plain tsx dies with MODULE_NOT_FOUND. Stub it
 * for the run:
 *
 *   mkdir -p node_modules/server-only
 *   printf '{"name":"server-only","version":"0.0.0-local-stub","main":"index.js"}\n' > node_modules/server-only/package.json
 *   printf 'module.exports = {};\n' > node_modules/server-only/index.js
 *   npx tsx --env-file=.env.local scripts/indexnow-submit.ts
 *   rm -rf node_modules/server-only
 */
import { submitToIndexNow } from "../lib/seo/indexnow";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";

async function main() {
  const xml = await fetch(`${SITE}/sitemap.xml`).then((r) => r.text());
  const urls = [...xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/g)].map((m) => m[1]);
  if (urls.length === 0) {
    console.error("No URLs found in sitemap. Refusing to submit an empty list.");
    process.exit(1);
  }
  console.log(`Submitting ${urls.length} URLs from ${SITE}/sitemap.xml`);
  const result = await submitToIndexNow(urls);
  console.log(result.ok ? "OK" : "FAILED", result);
  process.exit(result.ok ? 0 : 1);
}

void main();
