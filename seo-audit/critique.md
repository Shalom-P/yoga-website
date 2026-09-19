# Gaps

### 1. Nobody checked whether the site is indexed at all. It appears not to be.

Every one of the 12 dimensions optimized ranking inputs without verifying that any page is in an index. I checked:

- **Bing**: `site:myyogaclasses.fit` returns the literal string `There are no results`. Zero pages.
- **Google**: `site:myyogaclasses.fit` returns the GitHub repo, myyogateacher.com, and unrelated domains. Zero URLs from the domain.
- **Exact-phrase test**: the live H1 on `/classes/diabetes` is the unique string `Yoga for diabetes, shaped around you.` Searching that exact phrase returns Healthline, myyogateacher, redcliffelabs, shvasa. The page itself does not appear. An indexed page always returns for an exact-match unique phrase.
- **`whois myyogaclasses.fit`**: `Creation Date: 2026-06-01T15:22:17Z`. The domain is 3.5 months old.

This is the load-bearing unverified assumption behind all 12 dimensions. Title rewrites, JSON-LD, internal-link graphs and CWV are all ranking inputs. There is nothing to rank yet.

**Research question:** after verifying a Search Console property, run URL Inspection on all 23 sitemap URLs and record for each whether it is Discovered/Crawled/Indexed, plus whether the sitemap has ever been fetched, and whether Google reports a crawl-source for any URL other than the sitemap.

### 2. Zero inbound links to the canonical host, so there is no crawl entry point.

The GitHub repo's About homepage field is `https://yoga-website-seven-mocha.vercel.app`, which returns 404. The repo body mentions `hello@myyogaclasses.fit` and `© MYYOGACLASSES` but contains **no hyperlink to the site**. offpage found the repo ranks; it did not find that the repo is not a link. Google's discovery paths into this domain are: a sitemap it has probably never fetched, and nothing else.

**Research question:** enumerate every live hyperlink on the web whose href resolves to `https://www.myyogaclasses.fit/*` (backlink tool, Instagram bio, TestFlight page, any directory). If the count is zero, indexation is a discovery problem, not an optimization problem, and the priority order in every dimension inverts.

### 3. Bing indexation is a separate channel, and it gates ChatGPT Search and Copilot citability.

No dimension mentions Bing Webmaster Tools or IndexNow. ChatGPT Search and Copilot are Bing-index-backed. Zero Bing index means zero eligibility for the AI surface the audit spends paragraphs theorizing about. IndexNow is a POST to an endpoint; `app/api/admin/revalidate/route.ts` already exists as the natural hook point, and it needs no CSP change because it is server-to-server.

**Research question:** does Bing Webmaster Tools report the domain as entirely unknown, and does a single IndexNow submission of the 23 URLs produce Bing indexation inside 7 days?

### 4. Image SEO and visual search: uncovered, and the site has almost no images.

Measured live `<img>` counts in server HTML:

| URL | `<img>` |
|---|---|
| `/` | 4 |
| `/teachers` | 3 |
| `/classes` | 0 |
| `/classes/diabetes` | 0 |
| `/classes/prenatal` | 0 |
| `/teachers/dr-sangeeta` | 0 |
| `/pricing` | 0 |
| `/about` | 0 |
| `/reviews` | 0 |

Seven images on the entire sampled site, and **zero on all nine condition pages**, which are pages about physical postures. The teacher detail page has zero because `app/(marketing)/teachers/[slug]/page.tsx:52-56` takes the `intro_video_url` branch, which renders `TeacherIntroVideo`, a `"use client"` component. The avatar URL only appears once in the RSC flight payload and never as an `<img>`. The face that CLAUDE.md calls the strongest landing element is not in the HTML.

This forfeits Google Images and Lens entirely in a vertical that is searched visually, removes the thumbnail that Google attaches to AI Overview cards and mobile results, and is a visible quality deficit against competitors who illustrate every asana.

**Research question:** across the 20 highest-intent pose and condition queries, what share of SERPs carry an image pack or a thumbnail beside the top organic result, and what does one licensed or shot image per pose actually cost?

### 5. Google Discover: never mentioned by any dimension.

`grep -c "max-image-preview"` on the homepage returns `0`. There is no `<meta name="robots">` tag anywhere and no `robots` object in `app/layout.tsx`'s metadata, so no `max-image-preview:large`. Combined with gap 4, the site is structurally ineligible for Discover. For health and wellness content in India and the Gulf, which are the two markets that already have a working payment rail, Discover is frequently a larger mobile surface than Search.

**Research question:** does `robots: { "max-image-preview": "large", "max-snippet": -1 }` plus one 1200px-wide in-HTML image per condition page produce Discover impressions in GSC within 60 days?

### 6. Video as a discovery surface: uncovered.

The business already owns teacher intro videos in the `teacher-media` bucket and a 1.27 MB `hero.mp4`. There is no `VideoObject` anywhere, no YouTube channel, and `lib/seo/structuredData.ts:19` puts exactly one URL in `sameAs` (Instagram). Yoga is the most video-native category in wellness. Note an implementation cost nobody priced: `next.config.ts` sets `frame-src https://*.razorpay.com https://accounts.google.com`, so a YouTube embed is blocked today and fails silently in production only.

**Research question:** for the nine condition queries, what fraction of SERPs contain a video carousel or a video result above position 5, and what is the marginal cost of one 3 to 5 minute video per condition filmed by existing teachers?

### 7. The nine best pages contain no commercial fact.

`grep` on the live `/classes/diabetes`: `60-minute` appears 4 times, `60 min` once. Currency symbols: zero. Price: zero. `Offer` schema: zero, sitewide. `/pricing` is 330 rendered words containing only `₹999`, `₹4,499`, `₹7,999`.

So a searcher who lands on the site's strongest page from a commercial query cannot learn what anything costs, and neither can an AI assistant asked "how much is a 1:1 online yoga session for diabetes." Several dimensions recommend `Offer` on `/pricing`; none noticed that the condition pages, which are the pages that would actually receive the query, carry no price at all.

**Research question:** for the query class "online yoga for X cost / price / how much", which facts do AI Overviews and assistants actually cite (price, currency, duration, cancellation terms, teacher credential), and which of those are currently extractable from any URL on this domain?

### 8. Accessibility was not audited, and it is a live US legal exposure.

Two findings from other dimensions are also WCAG failures that nobody labelled as such: the hero H1, subhead and primary CTA are server-rendered inside `opacity: 0` until ~446 KB of JS hydrates, and every FAQ answer is absent from the DOM until interaction (`components/ui/accordion.tsx` has no `forceMount`). A US-targeting online health service whose booking funnel is unusable without JS is the standard ADA Title III web-accessibility fact pattern, and the audit is recommending scaling US acquisition into it.

**Research question:** what is the axe-core violation count and WCAG 2.2 AA conformance level of the full booking path (`/login` to `/dashboard/book` to confirmation), and is an accessibility statement a prerequisite for US acquisition?

### 9. No expected-value model, so no dimension can say whether any of this is worth doing.

Three active teachers, IST 05:00 to 23:00, about $10 per 60-minute session, a 3.5-month-old unindexed domain, no links. Nowhere in 200+ findings is there an estimate of how much organic traffic the business can even absorb, or what it is worth.

**Research question:** how many booked sessions per month saturate three teachers, and what position on which two or three queries delivers that? If the answer is "position 5 on one query," the 97-URL architecture is over-built by an order of magnitude.

### 10. Nobody checked what happens when an admin edits a slug or deactivates a category. There is no redirect layer at all.

- `components/admin/ClassesAdmin.tsx:229-232` is a free-text `slug` input, hint: `URL-safe identifier (used in /classes/<slug>) and as the value in plan included_session_types.`
- `next.config.ts` has **no `async redirects()`**. Confirmed by grep.
- `lib/data/landing.ts:347` filters `.eq("is_active", true)`, and both `generateStaticParams()` and the `notFound()` call in `app/(marketing)/classes/[slug]/page.tsx:41` key off that.

So an admin toggling a category inactive, or renaming a slug, silently 404s an indexed URL with no redirect and no 410, and breaks the plan linkage at the same time. kw-commercial explicitly recommends re-slugging `/classes/geriatric` to a chair-yoga slug. Acting on that today permanently drops the old URL.

**Research question:** what redirect layer can be added without forcing the `(marketing)` group dynamic (static `redirects()` in `next.config.ts`, or a middleware lookup outside the marketing group), and should `slug` become immutable in the admin UI with a `slug_history` table behind the redirect?

### 11. The sitemap fails silently and degrades from 23 URLs to 11.

`app/sitemap.ts:117` is a bare `} catch {` that returns `STATIC_ROUTES` only. Live headers confirm it is regenerated per request: `x-vercel-cache: MISS`, `cache-control: public, max-age=0, must-revalidate`, `age: 0`. One failed Supabase round trip during a Googlebot fetch removes all 9 condition pages and all 3 teacher pages from the sitemap, with no error surfaced anywhere and no Sentry configured to catch it.

**Research question:** what is the real failure rate of that anon query from `iad1`, and should the fallback be a build-time snapshot of slugs rather than nothing?

### 12. `robots.txt` ships a directive Google and Bing both ignore.

Live line 6: `Host: https://www.myyogaclasses.fit`, from `app/robots.ts:16`. `Host` is a Yandex-only directive. Google and Bing ignore it. Since the apex to www redirect is a 307 temporary, the site currently has no host-consolidation signal that Google reads. The fix is to delete the directive and make the redirect permanent.

### 13. AI-assistant citability was theorized about, never tested.

`llms.txt` and `llms-full.txt` both return 404 (verified). But access is not the constraint: I fetched `/classes/diabetes` with 12 AI crawler UAs (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot, Perplexity-User, meta-externalagent, Bytespider, Amazonbot, Applebot, Google-Extended) and every single one received `200` and the full `90,549` bytes. Retrieval is the constraint, and retrieval for ChatGPT runs through Bing, where the site has zero presence (gap 3).

**Research question:** for 15 target questions, which domains do ChatGPT Search, Perplexity, Gemini and Claude actually cite, and what do the cited pages have structurally in common (Bing index presence, named author, publish date, outbound citations, price in HTML)?

### 14. Two surfaces nobody fetched or reasoned about: the booking wall and `/contact`.

`/login` is indexable, has 23 inlinks, canonicalizes to the homepage, and is the wall in front of every availability, timezone and teacher-schedule proof point. `/contact` has zero H2 elements and no schema. For a business with 6 reviews, no address, no registration number and no entity, these are the trust surfaces.

**Research question:** what is the minimum unauthenticated, indexable proof-of-availability surface (for example a read-only `/schedule` rendering the next 7 days of open slots) that can be built without `cookies()`, so the `(marketing)` ISR group survives?

### 15. Seasonality and publishing lead time: uncovered.

New Year, Ramadan in the UAE, and International Yoga Day on 21 June, which is both the annual demand peak in this category and the one moment an Indian-teacher story is pitchable to press. For a domain that needs 6 to 9 months to rank anything, the calendar is a constraint on the whole plan, and no dimension has one.

**Research question:** what is the 5-year monthly Google Trends index for "online yoga classes" in US, UK, UAE and India, and what publish date does a new page need to be competitive by the June peak?

---

# Challenges to the audit's conclusions

### 1. The central assumption is wrong, and acting on it is the most dangerous thing in this audit.

"Publish many more pages" is not the answer for this site, and the audit's own evidence refutes it four ways.

**It solves a problem the site does not have.** Going from 23 unindexed URLs to 97 unindexed URLs changes nothing. The constraint is discovery and trust, not surface area.

**The source material does not exist.** kw-informational measured the pose corpus itself: 107 entries, 55 unique names, 1,070 words total, a mean of **10 words per entry**. architecture measured 40 publishable pages after folding variants, and conceded "3 of the 40 will share copy across up to 9 conditions." Three dimensions then recommend shipping 40 to 90 pages from it. Generating dozens of near-duplicate pages from a 10-word-per-entry seed file, on a YMYL health domain with no byline, no medical reviewer, no citations and zero index presence, is the textbook shape of scaled content abuse. The downside is not "these pages don't rank." It is site-wide suppression on a 3.5-month-old domain with no authority to absorb it.

**The playbook being copied is from a dead era.** myyogateacher's 241 articles and 84 asana pages were built when informational health queries returned ten blue links. In 2026 "yoga for diabetes" and "chair yoga for seniors" are among the most AI-Overview-saturated queries that exist. kw-informational rates AIO exposure "low" severity. It is the central fact about that entire keyword class, and it means the audit's biggest single work item targets the query type where the click has been removed.

**And the 613 URLs are an effect, not a cause.** The competitor's own copy from the live SERP: "240,000+ students transformed, 372,000+ 1-on-1 sessions completed, students in 20+ countries," plus App Store and Play Store listings that rank in their own right, real PR, and a free first session. Their page count is downstream of that scale. Reproducing the output without the inputs is cargo cult.

**What the evidence actually supports:** roughly 6 to 10 genuinely finished pages. The nine condition pages completed properly (images, teacher credentials, price, citations, contextual links, real testimonials), one `private 1:1 online yoga` pillar, one cross-timezone page, one cost-comparison page. Plus entity work, links, and getting indexed. Smaller, faster, and it does not bet the domain.

### 2. Five dimensions call missing hreflang a defect. They are wrong, and acting on them makes things worse.

onpage, kw-commercial, conversion, technical and schema all rate "no hreflang" as medium severity. international alone gets it right. There is one language and one URL set. hreflang requires distinct URLs per locale and there are none; self-referential `hreflang="en"` tags accomplish nothing and are the standard way to generate return-tag errors. The real fix is one string: `app/layout.tsx:75`, `locale: "en"` becomes `locale: "en_US"`. That is the whole valid finding, repeated five times with a wrong remedy attached.

### 3. Everyone says "no analytics." Nobody checked which analytics the CSP already allows.

`next.config.ts:16` already ships `https://*.posthog.com` in `script-src`, and `connect-src` already carries `https://*.posthog.com https://*.i.posthog.com`. **PostHog is a one-environment-variable fix with no code and no CSP edit.** GA4 or GTM are not: they need `https://www.googletagmanager.com` added to `script-src` and `https://*.google-analytics.com https://*.analytics.google.com` to `connect-src`, or they fail silently in production only, which is exactly the failure mode CLAUDE.md warns about. Search Console verification is a meta tag and needs no CSP change at all. Several dimensions recommend "add GA4/GTM" without a word about this.

### 4. The audit recommends undoing a documented compliance decision without doing the compliance work.

kw-commercial wants clinical nouns in titles and itself observes that `/classes/mental-health` "omits every clinical noun... a deliberate compliance choice." international and onpage want commercial condition titles. `supabase/migrations/0024_category_copy_positive.sql` lines 12 to 16 state the current copy "was authored + vetted by an adversarial UAE (DHA/MOH) + India (ASCI / Drugs & Magic Remedies Act) compliance pass," and that "supports balance" was specifically removed from Hormonal Health as an implied "balances hormones" claim. `0023` repeats the constraint. India's Drugs and Magic Remedies (Objectionable Advertisements) Act schedules diabetes by name, and the teachers are in India. Retitling for search is correct. Retitling to "Yoga for Diabetes: Lower Your Blood Sugar" without re-running that pass reopens a risk somebody already closed on purpose.

### 5. The title dispute is settled, and `technical` is wrong.

technical asserts "the 'fix it in code' assumption is wrong" because the title comes from a DB column. But `app/(marketing)/classes/[slug]/page.tsx:32-33` already reads the **description** from repo JSON (`rich?.metaDescription`) and only the title from the DB (`c?.name`). I parsed `lib/data/condition-pages/diabetes.json`: its keys already include `metaDescription`, currently `"Gentle 1:1 yoga for diabetes: easy movement, breathwork, and rest to support steady energy and calmer days, practised alongside your medical care."`

Adding a sibling `seoTitle` key to each of the 9 JSON files and changing line 32 to `title: rich?.seoTitle ?? c?.name ?? "Class"` is a pure code change. No DB write, no admin task, no effect on the H1 or on nav anchor text. This is the single highest-leverage fix in the audit, and one dimension mislabelled it as blocked on an admin.

### 6. The pricing conclusions contradict each other and nobody reconciled them.

international: the INR price is "6 to 14 times below the US private-yoga market rate." competitor: that benchmark is wrong, the actual category leader charges $21 per session. conversion: UAE buyers already pay 47% more than Indian buyers for the identical pack. These three cannot drive one action. The unasked question is whether per-market pricing is right at all, given that `effectiveCurrency()` silently downgrades unpriced currencies to INR and the resulting failure mode is quoting rupee integers under a dollar sign.

### 7. Core Web Vitals work has close to zero SEO value here.

CWV enters ranking only through CrUX field data. A 3.5-month-old domain with no index presence, no analytics and effectively no traffic has no CrUX record, so there is no page-experience signal to improve. The 19 performance findings and the "469,743 B removable" ledger rated **high** are conversion and hosting-cost work, not SEO work, and sequencing them as SEO will consume the first sprint for no search return. The one genuine SEO item in that dimension is the `opacity: 0` hero, and it qualifies because it is a rendering and accessibility defect, not because it is slow.

### 8. "Add FAQPage" is rated high, medium and low by three dimensions, one of which proves it does not matter.

onpage rates it high, schema's correction medium, competitor low, while schema separately establishes that FAQ rich results were removed from Search on 2026-05-07. The honest framing: emit it as an AI-extraction aid, cost two lines per page, expected rich-result value zero. Rating it **high**, next to a currency gap that blocks every sale outside two countries, is a prioritization error that will propagate straight into whatever ticket list the owner builds from this document.

### 9. Two dimensions give opposite instructions about `app/sitemap.ts`.

kw-informational: "app/sitemap.ts already uses the cookie-bound Supabase client. Add the new routes from the JSON, not from another DB call." architecture: "NEW DEFECT: sitemap.xml is rendered dynamically on every request because it reads cookies." I confirmed architecture is right: `x-vercel-cache: MISS`, `cache-control: public, max-age=0, must-revalidate`, `age: 0`. Adding 90 URLs to a sitemap regenerated from a live DB query on every Googlebot fetch, behind a bare `catch {}` that degrades to 11 URLs on failure, multiplies the blast radius rather than building on a foundation.

### 10. offpage's headline number is off by 2x and contradicts six other dimensions.

Its surviving finding reads "claims 1,200+ reviews against **12** published." Six dimensions independently verified the real count is **6**. A high-severity finding that misstates its own central quantity will not survive contact with the owner and will cast doubt on the accurate findings around it.

### 11. The audit never states the concrete path to AI citation, and it runs through Bing.

There is discussion of AI Overviews and `llms.txt`, a file with no confirmed consumer. The concrete version is boring: ChatGPT Search and Copilot are Bing-backed, Bing has zero pages from this domain, and Bing Webmaster Tools verification plus an IndexNow submission costs an afternoon. No dimension mentions either.

### 12. The audit treats a product problem as a search problem.

Its own verified facts: no priced currency outside INR and AED, no working payment rail outside India and the UAE, three legal pages that publicly say "Pending legal review" with **zero occurrences of "GDPR" or "CCPA"** across all three (verified by grep) against 12 mentions of India and 9 of UAE in the terms page alone, zero reviews from any Western market, a fabricated sitewide review count, and a testimonial reading "Placeholder, swap for a real review" shipped to production on all nine condition pages.

A perfectly optimized page that lands a Californian on a rupee price, a checkout that will decline, and a terms page admitting no lawyer has read it does not have an SEO problem. The conversion dimension says this plainly and is correct. The other eleven proceed as though it were a caveat rather than the gate. It is the gate.