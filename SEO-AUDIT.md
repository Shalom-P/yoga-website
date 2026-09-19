# Global SEO Audit: myyogaclasses.fit

**Scope:** full-site audit for worldwide (English) search
**Run:** 2026-09-16 to 2026-09-18
**Method:** 12 specialist agents, one per SEO dimension, every finding handed to an adversarial verifier instructed to refute it against the live site. A completeness critic then attacked the audit's own conclusions, and a backfill round closed the gaps it named. **224 findings raised, 3 refuted, 221 surviving, 185 keyword candidates. 154 agents, ~2,700 tool calls, 0 errors.**

**Supporting documents**
- [seo-audit/critique.md](seo-audit/critique.md) — read this second. It challenges the audit and changes the plan.
- [seo-audit/keyword-plan.md](seo-audit/keyword-plan.md) — 30 keywords, SERP-grounded, in three tiers
- [seo-audit/roadmap.md](seo-audit/roadmap.md) — week-by-week actions with file paths and hour estimates
- [seo-audit/competitor-brief.md](seo-audit/competitor-brief.md) — benchmark and positioning
- [seo-audit/ai-search-and-gaps.md](seo-audit/ai-search-and-gaps.md) — AI-search findings and the critic's gaps, closed
- [seo-audit/findings-ledger.md](seo-audit/findings-ledger.md) — all 221 findings with evidence

> **Data caveat.** No Ahrefs, Semrush or Search Console connector was authorized, so difficulty and volume are derived from live SERP inspection, not tool data. Authorize the Ahrefs MCP in claude.ai connector settings to upgrade this. Everything else here was verified against the live site or the repo.

---

## The finding that reframes everything

**The site is not in any search index.**

- `site:myyogaclasses.fit` on Google returns the GitHub repo and unrelated domains. Zero URLs from the domain.
- Bing returns the literal string `There are no results`.
- The decisive test: `/classes/diabetes` has the unique H1 `Yoga for diabetes, shaped around you.` Searching that exact phrase returns Healthline, myyogateacher, WebMD and shvasa. **The page itself does not appear.** An indexed page always returns for its own unique exact-match phrase.
- `whois`: `Creation Date: 2026-06-01`. The domain is 3.5 months old.
- There is **no crawl entry point**. The public GitHub repo ranks for the brand query, but its homepage field points at `yoga-website-seven-mocha.vercel.app`, which returns 404, and its README contains **no hyperlink to the live site**. Google's only discovery path into this domain is a sitemap it has likely never fetched.

A Google verification token *does* exist (`dig TXT` returns `google-site-verification=...`), but note the nuance: it sits alongside `v=spf1 include:_spf.google.com`, so it was almost certainly minted by Google Workspace setup. Ownership is provable today at zero cost. That is **not** the same as a Search Console property that someone has configured and is reading.

**One dissent, recorded honestly.** A backfill verifier asserted Google has indexed 2 of the 23 URLs. It supplied no method, and I could not reproduce it: two independent exact-phrase tests, on the `/classes/diabetes` H1 and on the verbatim homepage meta description, both return nine competitors and no page from this domain. I am reporting zero. **GSC URL Inspection is the only authoritative resolver**, which is another reason it is step one.

This inverts the entire audit. Title tags, JSON-LD, internal-link graphs and Core Web Vitals are all **ranking inputs**. There is nothing to rank yet. The constraint is discovery and trust, not optimization.

One qualification the backfill round insisted on, and it is right: **this is not an argument for freezing content.** A 3.5-month-old domain with 23 URLs, no backlink profile and nine orphaned condition pages is the exact profile Google parks in "Discovered, currently not indexed". Publishing nothing does not fix that. What fixes it is links, entity clarity and internal-link depth. More thin pages would not.

---

## The second finding: the site ships fabricated content to production

This is a YMYL health site. It currently publishes, live:

| Claim on the site | Reality |
|---|---|
| "4.9 · 1,200+ reviews" on the homepage | The `reviews` table has **zero rows** |
| 6 reviews on `/reviews` | All six are hardcoded `MOCK_REVIEWS` from `lib/data/landing.ts:274-281`, served via the mock fallback. Invented customers in Dubai, Abu Dhabi, Sharjah, Bengaluru. Zero Western reviewers |
| "5.0 · 312 reviews", "4.8 · 98 reviews" on teacher pages | Demo seed data in `teachers.rating_count` |
| A first-person health testimonial on all 9 condition pages | Attribution reads **"Placeholder, swap for a real review"**. Verified: all 9 condition JSONs contain the string |
| "Next available: Gentle Hatha with Aarti, Today · 7:00 PM your time" | Hardcoded in `components/marketing/Hero.tsx:191`. Shown to every visitor in every timezone. **"Aarti" is not one of the three teachers** |
| Three legal pages | All publicly state **"Pending legal review"**. `/legal/terms` reads "registration / trade-licence details to be inserted" |

Fabricated testimonials on health pages are a quality-rater failure on their own. In the US and UK markets this audit is about entering, invented reviews and invented review counts are an FTC and ASA matter, not an SEO one. It also makes `aggregateRating` markup impossible to add honestly, which kills a rich-result recommendation from the first pass.

**Fix this before anything else.** Not because of rankings, because it is live.

---

## The third finding: nobody outside India and the UAE can pay

Verified in the live prerendered `/pricing` RSC payload: exactly **six `plan_prices` rows, three INR and three AED. Zero USD, GBP or EUR.**

Migration `0036_international_currencies.sql` widened the CHECK constraint to all five currencies and, by its own header, deliberately inserted no prices. So `pricedCurrencies()` returns `{INR, AED}`, `effectiveCurrency()` downgrades USD, GBP and EUR to INR, and a US visitor sees `₹999 / ₹4,499 / ₹7,999` under the footnote "Prices shown in INR... Book from anywhere in the world."

The purchase path then mints a Razorpay order in INR on an Indian account whose own repo comments state International acceptance is not enabled. The manual bank-transfer rail is hard-gated to `preferred === "AED"`. **A non-India, non-UAE buyer has no priced currency and no working rail.**

---

## Three live bugs the backfill found, all verified by me

**1. Every teacher page renders "Meet Dr , a quick hello." and "Book a 1:1 with Dr".** `app/(marketing)/teachers/[slug]/page.tsx:56,126` take `t.display_name.split(" ")[0]`, and `display_name` is "Dr Sangeeta", so the first token is the honorific. Confirmed live on all three teacher URLs. No ranking impact (title, H1, meta and Person JSON-LD all carry the correct full name) but it is the credibility surface for your single best positioning asset.

**2. Your Course schema actively fragments your own entity.** `lib/seo/structuredData.ts:58` sets `provider: { "@type": "Organization", name: ORG_NAME, sameAs: url }`, where `url` is the class page. So `/classes/diabetes` emits `"sameAs":"https://www.myyogaclasses.fit/classes/diabetes"`. `sameAs` means "this is another reference for this entity", so nine pages each assert a different identity for the same Organization. Compounding it, **no JSON-LD node on the site carries an `@id`**, so the Organization is re-declared as an anonymous node 23 times and nothing links Course, Person and Organization into one entity.

**3. An AI assistant asked about your brand concludes you are not a business.** A search for the literal string `myyogaclasses.fit` returned nine results, zero of them the live site. Result #1 was the GitHub repo, and the generated answer concluded the domain "appears to be a web application framework designed for yoga studios rather than an active yoga class website itself." That is the entity problem stated in one sentence, by a machine, about your brand.

On AI search generally: extractability is **not** your problem. Every AI crawler tested (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, CCBot) receives an identical HTTP 200 with the full server-rendered HTML. The problem is that there is no machine-readable identity to resolve and no third-party corroboration to cite. `llms.txt` would not help. An `@id`, real reviews, and one inbound link would.

---

## Corrections to my first-pass report

The deep audit overturned several things I told you earlier. Owning them plainly:

| I said | Actually |
|---|---|
| ~$23-24 per session | **$9.38.** ₹4,499 ÷ 5 = ₹899.80. The 10-pack is $8.34; the AED 5-pack is $14.98. My figure was the retired AED 435 price that migration `0031` already superseded. The honest framing is **$8.34 to $10.41 per live 1:1 session against ~$21 list at the nearest comparable platform**, and $60-120/hr for an independent US teacher |
| 107 pose entries "unpublished, 40-80 pages you've written" | **Already published** and server-rendered on the condition pages. They dedupe to 55 unique names, ~35 publishable, **1,070 words total** at a mean of 10 words per entry. A seed index, not drafted content |
| FAQPage JSON-LD on condition pages | **None.** 45 written Q&As carry no markup at all |
| `/reviews` shows 12 reviews | **Six** |
| No Search Console verification | **It exists.** A Domain property is verified by DNS TXT. It has simply never been read |
| Mumbai origin hurting US/EU TTFB | Function region is **iad1 (US East)**. `bom1` was the PoP nearest my probe. US and EU visitors get the *good* TTFB; India and UAE pay the dynamic-route penalty |
| Missing font fallback metrics | next/font emits them correctly. Residual risk is only that they resolve via `local(Arial)`, absent on Android |
| Per-page depth beats competitors | **Loses.** 978 words against patanjalee's 1,994 and myyogateacher's 2,110 on the same topic |
| Pitch yogaia and allyogatraining for roundup inclusion | Both are **competitor-owned** and cover on-demand video only. Structurally unpitchable. `1om1.net` is the real target: three separately-ranking pages comparing live 1:1 platforms by price |
| Set up a Google Business Profile | **Not eligible.** Online-only businesses with no face-to-face contact are explicitly excluded |

Also: GSAP is not in the bundle at all (CLAUDE.md is stale), `lib/validation/phone.ts` no longer restricts to AE/IN (also stale), and shyambhai.yoga's sitemap is readable at 380 URLs. It is a slug-for-slug clone of patanjaleeyoga.com, so treat those two as one 797-URL operation.

---

## The strategic ruling: do not build 97 pages

The first-pass instinct, and three of the twelve dimensions, said the answer is to multiply page count toward myyogateacher's 613. The completeness critic argued that is wrong, and the evidence supports the critic:

- **It solves a problem you do not have.** Going from 23 unindexed URLs to 97 unindexed URLs changes nothing.
- **The source material does not exist.** The pose corpus is 1,070 words total, averaging 10 words per entry. Generating dozens of near-duplicate pages from that seed, on a YMYL health domain with no byline, no medical reviewer, no citations and zero index presence, is the textbook shape of scaled content abuse. The downside is not "these pages fail to rank". It is site-wide suppression on a 3.5-month-old domain with no authority to absorb it.
- **The playbook is from a dead era.** myyogateacher's 84 asana pages were built when informational health queries returned ten blue links. "Yoga for diabetes" and "chair yoga for seniors" are now among the most AI-Overview-saturated queries in existence.
- **Their 613 URLs are an effect, not a cause.** Their own copy: "240,000+ students transformed, 372,000+ 1-on-1 sessions completed." Page count is downstream of that scale. Reproducing the output without the inputs is cargo cult.

The independent AI-search agent reached the same verdict by a different route: the informational SERP for these terms is held by Healthline, WebMD and the American Diabetes Association under YMYL weighting, while the commercial SERP is held by a direct competitor running a plain service page. Its conclusion was that the effort belongs on entity and commercial surfaces, not a pose library. A re-derivation of the corpus also found **17 poses already repeat across pages**, with Shavasana on 8 of 9 pages and 5 of those descriptions byte-identical. A pose page spun from that seed would not publish new text, it would republish existing text at a new URL.

**What the evidence supports instead: roughly 6 to 10 genuinely finished pages.** The nine condition pages completed properly (images, teacher credentials, price, citations, contextual links, real testimonials), one `private online yoga` pillar, one cost-comparison guide, one PCOS split. Plus entity work, links, and getting indexed. Smaller, faster, and it does not bet the domain.

---

## Sequencing

**Weeks 1-2 is not SEO work. It is making the site honest and findable.**

### Stop shipping fabricated content (about 2.5 hours)
1. Delete `testimonialQuote` / `testimonialWho` from all 9 condition JSONs; gate the section on their presence. Match on **keys**, not the placeholder text, which differs across three files.
2. `getFeaturedReviews`: change the empty-table fallback from `return MOCK_REVIEWS` to `return []` (`lib/data/landing.ts:384`). Keep the `!isSupabaseConfigured` branch so the zero-env preview story survives.
3. Blank `landing.trust_rating` and `landing.trust_count` in `/admin/settings` **and** change the code fallbacks in `app/(marketing)/page.tsx:43-44`. `landingSetting()` treats an empty string as unset and falls back to the identical literal, so the admin edit alone is a no-op.
4. Zero `teachers.rating_avg` and `rating_count` for all three teachers. The `rating_count > 0` guards already exist, so this needs no code change.
5. Replace the hardcoded hero availability card (`Hero.tsx:191,194`).
6. Remove the "Pending legal review" banners and fill the trade-licence placeholder.

### Get discovered (about 1.5 hours)
7. Open the **existing** GSC Domain property, submit the sitemap, run URL Inspection on all 23 URLs.
8. Verify Bing Webmaster Tools and submit via IndexNow. This is not optional extra credit: ChatGPT Search and Copilot are Bing-index-backed, so zero Bing presence means zero eligibility for the AI surface entirely.
9. Fix the GitHub repo. It is the #1 result for your brand-domain query and it advertises PayPal, "AU customers" and a 404:
   ```
   gh repo edit Shalom-P/yoga-website --description "Source for myyogaclasses.fit, a live 1:1 online yoga studio. Next.js 16, Supabase, Razorpay." --homepage "https://www.myyogaclasses.fit"
   ```
10. Change the apex redirect from **307 to 308** in Vercel Domains. A temporary redirect is explicitly not used as a canonicalization signal. Delete the `Host:` directive from `app/robots.ts:16`; it is Yandex-only and Google and Bing ignore it, so the site currently has no host-consolidation signal at all.
11. Build one real inbound link. Today there are none.

### Then the on-page work (about 5 hours)
12. **Nine `seoTitle` strings.** The title dispute is settled: `app/(marketing)/classes/[slug]/page.tsx:32` already reads the *description* from repo JSON (`rich?.metaDescription`) and only the title from the DB. Add a sibling `seoTitle` key to each of the 9 JSONs and change line 32 to `title: rich?.seoTitle ?? c?.name ?? "Class"`. Pure code change, no DB write:
    ```
    diabetes         "Online Yoga for Diabetes, Live 1:1"
    hypertension     "Yoga for High Blood Pressure, 1:1"
    prenatal         "Prenatal and Postnatal Yoga, Online 1:1"
    hormonal-health  "Online Yoga for Hormonal Health, 1:1"
    pain-relief      "Yoga for Back and Neck Pain, Online 1:1"
    mental-health    "Online Yoga for Stress, Live 1:1"
    weight-loss      "Online Yoga for Weight Loss, Live 1:1"
    geriatric        "Chair Yoga for Seniors, Online 1:1"
    kids-yoga        "Online Kids Yoga, Live 1:1 Classes"
    ```
    Two are deliberate: **"Stress" not "Anxiety"** (anxiety appears zero times in the body, and it is a clinical claim `0024_category_copy_positive` removed on purpose), and **"Seniors" not "older adults"** (add "seniors" to `helpsH2` in the same commit so title and body agree).
13. **Delete `title` and `description` from the root `openGraph` object** (`app/layout.tsx:76-78`). Next.js does not merge `openGraph` per field, so all 23 pages currently emit the homepage OG title. Three lines fixes 23 pages. Do this *after* the condition titles land, and promote the homepage OG string to the homepage segment.
14. **Add `hiddenUntilFound` to the accordion panel** (`components/ui/accordion.tsx:55`). 1,191 words of FAQ answers are absent from the server DOM on 12 of 23 URLs, and they have no JSON-LD fallback now that **Google removed FAQ rich results on 2026-05-07**.
15. Rewrite the `/pricing` meta description. It currently says "in AED and INR", which deselects every other market in the snippet.
16. **Move `<StickyMobileCTA />` into `app/(marketing)/layout.tsx`.** It is mounted only on the homepage (`page.tsx:64`), so every condition page, `/pricing` and every teacher page renders no sticky CTA on mobile, at 75% mobile traffic. CLAUDE.md calls this non-negotiable; it is currently absent from 22 of 23 pages.
17. Fix the honorific split on teacher pages (`teachers/[slug]/page.tsx:56,126`). Use the full `display_name`, or strip a leading honorific before taking the first token.
18. Fix `lib/seo/structuredData.ts:58`: drop the misused `sameAs` from the Course provider, give the Organization an `@id` (`https://www.myyogaclasses.fit/#organization`) in `app/layout.tsx`, and point every Course, Person and Offer node at that `@id`. This is the single highest-leverage schema change available, because it turns 23 anonymous Organization declarations into one entity.
19. Set `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_SENTRY_DSN` in Vercel. **No CSP edit needed**, `next.config.ts:16,32` already allow both origins. GA4 or GTM would need `googletagmanager.com` added to `script-src` or they fail silently in production only.
20. `locale: "en"` becomes `locale: "en_US"` (`app/layout.tsx:75`). Do **not** add hreflang: there is one language and one URL set, so self-referential tags would only generate return-tag errors.

### In parallel, on its own clock
21. **File the Razorpay International request in Week 1.** It is a days-to-weeks support-and-KYC process. Then insert USD/GBP/EUR `plan_prices` rows at `/admin/plans`. No deploy, no migration.
22. **Block all paid acquisition, directory placement and roundup outreach until a foreign card is verified with a real test charge.** Those buy traffic on a schedule you control, so they can wait. Organic cannot, which is why content starts now.

---

## Keyword plan, in brief

Full table with SERP evidence in [seo-audit/keyword-plan.md](seo-audit/keyword-plan.md). The structure that matters:

**Tier 1, optimize what exists (11 keywords, ~1 engineering day).** The condition-plus-commercial-modifier long tail is genuinely open: the SERPs for "online yoga classes for PCOS", "for diabetes", "online prenatal yoga private", "chair yoga for seniors online" contain **zero large publishers and zero directories**. They are 100% small provider pages, several on domains no stronger than yours.

Three of these are blocked by vocabulary, not by authority:
- `/classes/geriatric` has **"chair" x42 and "senior" x0**
- `/classes/pain-relief` has **"back" x45 but "back pain" x0** and "sciatica" x0
- `/classes/hormonal-health` has **"PCOS" x2 against "menopause" x10**

Insert the phrase before retitling, or Google rewrites a title whose terms are absent from the body.

**Tier 2, build next (13 URLs, 23 to ~45 pages).** Led by `/private-online-yoga-classes`, which does not exist despite being the site's entire product, and `/guides/what-private-online-yoga-costs`, where the whole first page of results is teacher-side "how much should I charge" content and **not one page is written for a buyer**. Hard-gate the cost guide on USD pricing shipping first.

**Tier 3, unwinnable by ranking.** Bare head terms ("online yoga classes", "yoga for high blood pressure") are held by Healthline, Yoga Journal, Art of Living and a 613-URL incumbent. Attack via listings and links, never content.

**Excluded after review:** "yoga classes in my time zone" looked like a differentiator but the SERP is entirely B2B scheduling software (koalendar, lunacal, picktime, simplybook.me). Not a yoga query.

---

## The positioning wedge

"Indian teachers" is **not** available. myyogateacher, shyambhai and patanjalee all claim it explicitly. "Cheap" is owned by 1om1.

What nobody claims: **doctor-credentialed clinical yoga, sold as one-time packs, against a subscription leader whose own pricing page says "we do not offer any refunds" twice.**

Your three teachers hold an MD in Clinical Yoga and Naturopathy, a Yoga and Naturopathy doctorate, and Medical Yogic Sciences with 8 years. That data sits in the database and the admin UI and is **never rendered publicly**, never in `Person` JSON-LD, with `hasCredential` count zero. The query "yoga teacher who is a doctor" is completely unclaimed by any competitor.

Meanwhile myyogateacher's homepage Organization and BreadcrumbList JSON-LD are **invalid** (a leaked `{JSON.stringify(` literal silently voids their 4.9/360,000 AggregateRating), their 116 teacher pages serve 18 to 20 words with no H1 and no schema, and no competitor sampled ships HSTS or a CSP. Your technical execution genuinely wins. Your content depth does not.

---

## What this audit deliberately deprioritizes

- **Core Web Vitals.** CWV enters ranking only through CrUX field data. A 3.5-month-old domain with no index presence and no traffic has no CrUX record, so there is no page-experience signal to improve. The 19 performance findings are conversion and hosting-cost work, not SEO work. The one exception is the `opacity: 0` hero, and it qualifies as a rendering and accessibility defect rather than a speed one: your H1, subhead and primary CTA are server-rendered invisible until ~446 KB of JS hydrates.
- **FAQPage schema.** Google removed FAQ rich results on 2026-05-07. Emit it as an AI-extraction aid at two lines per page, expected rich-result value zero. Do not rate it high.
- **hreflang.** Wrong for a single-language, single-URL-set site.
- **The 97-URL architecture.** See the strategic ruling above.

---

## Known risks in acting on this

1. **There is no redirect layer.** `next.config.ts` has no `async redirects()`, and the admin slug field is free text. Renaming a slug or deactivating a category silently 404s an indexed URL. The keyword plan recommends re-slugging `/classes/geriatric` and splitting `/classes/pcos`: **build the redirect layer first**, and consider making `slug` immutable with a `slug_history` table behind it.
2. **The sitemap degrades silently from 23 URLs to 11.** `app/sitemap.ts:117` is a bare `catch {}` returning static routes only, and it is regenerated per request (`x-vercel-cache: MISS`) because it calls the cookie-bound Supabase client. One failed query during a Googlebot fetch drops all 9 condition and all 3 teacher pages, with no Sentry to catch it.
3. **Retitling for search can reopen a closed compliance question.** `0024_category_copy_positive.sql` states the current copy was vetted by an adversarial UAE (DHA/MOH) and India (ASCI, Drugs and Magic Remedies Act) pass, and that "supports balance" was specifically removed from Hormonal Health. India schedules diabetes by name, and your teachers are in India. The nine titles above were written to respect that. Anything stronger needs the pass re-run.
4. **Accessibility is a live US exposure.** The `opacity: 0` hero and the JS-gated FAQ answers are both WCAG failures, and a US-targeting online health service whose booking funnel is unusable without JS is the standard ADA Title III fact pattern.

---

## How you will know it worked

There is no baseline today, so the first month is instrumentation, not results.

| Checkpoint | What to look for |
|---|---|
| Week 2 | GSC sitemap fetched. URL Inspection shows pages moving from Discovered to Crawled |
| Week 4 | First pages Indexed. Bing returns non-zero for `site:` |
| Week 8 | First impressions in GSC. Position data on Tier 1 terms, however poor |
| Month 3 | USD/GBP/EUR prices live and a real test charge cleared. First non-brand clicks |
| Month 6 | Top-20 positions on two or three Tier 1 condition terms |
| Month 9-12 | Top-10 on the winnable long tail. This is a 3.5-month-old domain; nothing published today ranks before Q1 2027 |

One question this audit could not answer, and you should: **three teachers covering IST 05:00 to 23:00 is a finite amount of inventory.** Nowhere in 205 findings is there an estimate of how many booked sessions per month saturate them. If the answer is small, position 5 on two queries may be sufficient, and the content programme above is already larger than the business needs.
