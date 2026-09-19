import "server-only";

/**
 * IndexNow: push URL changes to Bing, Yandex, Seznam and Naver in one call.
 *
 * Worth doing here for a reason beyond Bing's own traffic. ChatGPT Search and
 * Copilot are Bing-index-backed, so a page Bing has never crawled cannot be
 * cited by them at all. This site had zero pages in Bing, which made it
 * invisible to that whole surface regardless of how good the content was.
 *
 * Google does not participate in IndexNow, and it retired its sitemap ping
 * endpoint in 2023, so Google discovery still depends on Search Console and
 * real inbound links.
 *
 * The key is deliberately not a secret: the protocol requires it to be readable
 * at https://<host>/<key>.txt, which is what proves we control the domain.
 * public/647bea3f370790e02b698269b5da4bbc.txt must keep matching this constant.
 */
export const INDEXNOW_KEY = "647bea3f370790e02b698269b5da4bbc";

const ENDPOINT = "https://api.indexnow.org/indexnow";

export type IndexNowResult = { ok: boolean; status: number; submitted: number };

/**
 * Submit up to 10,000 URLs. Every URL must be on `host` or the whole batch is
 * rejected with 422. Never throws: indexing is best-effort and must not fail
 * the request that triggered it.
 */
export async function submitToIndexNow(urls: string[]): Promise<IndexNowResult> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";
  const host = new URL(siteUrl).host;

  const urlList = [...new Set(urls)].filter((u) => {
    try {
      return new URL(u).host === host;
    } catch {
      return false;
    }
  });
  if (urlList.length === 0) return { ok: true, status: 0, submitted: 0 };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${siteUrl}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
    });
    // 200 accepted, 202 accepted but key still validating. Both are successes.
    return { ok: res.ok || res.status === 202, status: res.status, submitted: urlList.length };
  } catch {
    return { ok: false, status: -1, submitted: urlList.length };
  }
}
