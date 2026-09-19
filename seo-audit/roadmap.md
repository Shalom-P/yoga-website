I verified the live site and repo before writing. Six items in the established list are wrong, and I correct them inline.

---

# Global SEO Roadmap: myyogaclasses.fit

**Corrections to the first-pass audit, verified this session:**

| # | Claim | Reality |
|---|---|---|
| 4 | 107 pose entries "unpublished" | They render live. `curl /classes/diabetes` returns Vajrasana, Paschimottanasana, Mandukasana in server HTML. 36 poseGroups is actually **35**; 107 entries dedupe to **55 unique Sanskrit names**, of which ~35 are publishable |
| 7 | FAQPage on condition pages | **False.** `/classes/diabetes` emits exactly two nodes: Organization and Course. FAQPage is on `/`, `/faq`, `/pricing` only |
| 9 | `/reviews` renders 12 reviews | **Six.** And all six are `MOCK_REVIEWS` from `lib/data/landing.ts:274-281`. The `reviews` table returns zero rows |
| 11 | No Search Console verification | **False.** `dig TXT myyogaclasses.fit` returns `google-site-verification=-KzwTiCrZvl1upIYAYmy7wbuW46q6lBdxuaRT1GZSVk`. A Domain property already exists |
| 12 | 5-pack is ~$23-24/session | **~$9.37.** ₹4,499 / 5 = ₹899.80 at 96.07 INR/USD. AED buyers pay $14.98. The gap to the $60-120 US rate is 6x to 13x, not 3x |
| 2 | Title separator is `\|` | It is `·` (U+00B7), from `app/layout.tsx:66` |

Also newly confirmed: `curl /pricing` returns exactly `3 AED, 3 INR` currency rows and nothing else. `/api/region` returns `{"country":"IN","currency":"INR"}`. Apex returns `307` (temporary) to www. `/faq` server HTML contains **zero** `accordion-content` nodes, so all nine FAQ answers are absent from the crawlable DOM. All nine condition JSONs contain the literal string `Placeholder`.

---

## 1. Sequencing decision

**Run global SEO now, in parallel with the payment rail. Do not gate content on payments. File the Razorpay International request in Week 1 and let it run in the background.**

The two have completely different clocks and pretending otherwise costs you a quarter.

The payment rail is a **days-to-weeks** problem with a known fix path: request International acceptance from Razorpay (a support ticket plus KYC), then insert nine `plan_prices` rows through `/admin/plans`. No deploy, no migration. Migration `0036_international_currencies.sql` already widened the CHECK constraint to `('INR','AED','USD','GBP','EUR')` and states in its own header that it "deliberately inserts NO prices." The blocker is a commercial decision and an account setting, not engineering.

SEO on this domain is a **6-to-12 month** problem. The domain was first committed 2026-05-28. It has 23 indexable URLs against myyogateacher.com's 613. It has one `sameAs` edge (Instagram) and no observable external citations. Nothing you publish today ranks before Q1 2027.

So the cost asymmetry is stark:

- **If you fix payments first and delay content by 8 weeks**, you lose 8 weeks off the front of a 26-week compounding curve, and you gain nothing in return, because there is currently no international organic traffic to convert. You would be optimising a checkout that nobody reaches.
- **If you ship content first and payments lag**, the only loss is the small trickle of early international visitors who see rupees. That is real but bounded, and it is **fully mitigable this week for zero engineering cost** by rewriting one meta description and one footnote string.

There is exactly one hard gate, and it is not on content: **do not spend a rupee on paid acquisition, directory placement, or outreach to US/UK roundups until a foreign card can actually be charged.** Those activities buy traffic on a schedule you control, so they should wait. Organic content does not; it buys traffic on a schedule Google controls, and that schedule starts the day you publish.

The concrete risk if payments are never fixed is worse than "wrong currency shown." `app/api/payments/intent/route.ts:101` routes every non-AED buyer to Razorpay, and `create-order/route.ts:91` mints the order in the downgraded currency. If International is off, an international card is very likely declined at the gateway. That is a silent revenue leak today at low volume and a catastrophe at month-6 volume. Which is precisely why it must be **fixed by month 3, not month 0**.

**Ruling: content and technical SEO start in Week 1. Razorpay International request filed Week 1. USD/GBP/EUR prices live before organic traffic arrives, which the timeline puts at month 3. Paid acquisition and link outreach blocked until the rail is verified with a real test charge.**

---

## 2. Week 1 quick wins

Ordered by impact per hour.

| Action | Why | Impact | Hours | Surface | Dependencies |
|---|---|---|---|---|---|
| Delete `testimonialQuote` and `testimonialWho` keys from all 9 condition JSONs; make both optional in the `ConditionPage` type; gate section 8 on their presence | All nine pages render "Placeholder, swap for a real review" attached to a fabricated first-person health testimonial. 39% of the indexable surface, on YMYL pages. 16 CFR 465.2 exposure | Critical trust | 0.5 | `lib/data/condition-pages/*.json`, `lib/data/condition-pages.ts:52-54`, `components/marketing/condition/ConditionLanding.tsx:231-239` | None. Match on JSON **keys**, not the placeholder text: punctuation differs across three files |
| Add `hiddenUntilFound` to the accordion Panel | 1,191 words of FAQ answers are absent from the server DOM on 12 of 23 URLs. On the 9 condition pages there is no JSON-LD fallback either. `/faq` renders 195 words | High | 0.25 | `components/ui/accordion.tsx:55` | Screenshot `/faq` after deploy to confirm panels still collapse |
| Add `seoTitle` to the `ConditionPage` type and to all 9 JSONs; change `title: c?.name ?? "Class"` to `title: rich?.seoTitle ?? c?.name ?? "Class"` | Nine best pages titled "Diabetes · My Yoga Classes". Title is the most weighted on-page element and is currently a DB category name an admin can change | High | 1.0 | `app/(marketing)/classes/[slug]/page.tsx:32`, `lib/data/condition-pages/*.json` | Strings below |
| Stop fabricating social proof: blank `landing.trust_rating` and `landing.trust_count` in admin **and** change the code fallbacks | Homepage claims "4.9 · 1,200+ reviews" against zero real reviews. `landingSetting()` treats an empty string as unset and falls back to the identical code literal, so the admin edit alone is a no-op | Critical trust | 0.5 | `/admin/settings` **and** `app/(marketing)/page.tsx:43-44` | Must do both or nothing changes |
| Change `getFeaturedReviews` empty-table fallback from `return MOCK_REVIEWS` to `return []`; keep the `!isSupabaseConfigured` branch | Six invented customers (Emma R. Dubai, James P. Abu Dhabi …) render as real testimonials on `/` and `/reviews`. Keeping the zero-env branch preserves the documented preview story | Critical trust | 0.5 | `lib/data/landing.ts:384` | Give `/reviews` an honest empty state, or drop it from `app/sitemap.ts` until real reviews exist |
| Zero `teachers.rating_avg` and `rating_count` for all three teachers | `/teachers/dr-sangeeta` renders "5.0 · 312 reviews". The `rating_count > 0` guards already exist in `TeacherGrid.tsx:93`, so zeroing the data hides the widget with no code change | High trust | 0.25 | Live DB / `/admin/teachers`, then `POST /api/admin/revalidate` | Code cannot reach this |
| Replace the hardcoded hero availability card | Hero renders "Gentle Hatha with Aarti / Today · 7:00 PM your time" to every visitor in every timezone. "Aarti" is not one of the three teachers | High trust | 0.25 | `components/marketing/Hero.tsx:191,194` | Replace with "Sessions from early morning to late evening, in your time zone." |
| Rewrite `/pricing` meta description | Current: "Honest yoga pricing in AED and INR." That is the SERP snippet a US searcher reads, and it names two currencies they do not use | High | 0.25 | `app/(marketing)/pricing/page.tsx:13` | New: "One-time packs of live 1:1 yoga sessions with teachers in India. No subscription, and your sessions never expire." |
| Move `<StickyMobileCTA />` from `app/(marketing)/page.tsx:64` into `app/(marketing)/layout.tsx` | Verified: `grep -rn StickyMobileCTA` returns one mount, the homepage. Every condition page, `/pricing` and every teacher page renders no sticky CTA on mobile, at 75% mobile traffic | High conversion | 0.5 | `app/(marketing)/layout.tsx`, delete the page.tsx import | Check it does not collide with `WhatsAppButton` (`bottom-24 right-4`) |
| Delete the "Pending legal review … must be verified before launch" banner from all three legal pages, and fill the "registration / trade-licence details to be inserted" placeholder | A buyer clicking "Refund policy" before purchase reads that the policy is unfinished. All three pages are static JSX, so the edit lands | High trust | 0.5 | `legal/refund/page.tsx:19-24`, `legal/terms/page.tsx:21-26`, `legal/privacy/page.tsx:19-23` | Owner must supply the entity name. Privacy's wording differs; edit each file separately |
| Change apex redirect from 307 to 308 in Vercel Domains | Verified `307` today. Google's docs: 302/307 means "the indexing pipeline doesn't use the redirect as a signal that the redirect target should be canonical" | Medium | 0.1 | Vercel dashboard only | Do **not** add a host redirect in `next.config.ts`; it would fight the domain rule |
| Add `verification` is **not** needed. Instead: open the existing GSC Domain property, submit `sitemap.xml`, set country filters | Correcting item 11. The property exists. Nobody has been reading it | High | 0.5 | search.google.com | None |
| Set `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_SENTRY_DSN` in Vercel production | Verified: zero occurrences of "posthog" across all 28 homepage chunks, including the default `https://us.i.posthog.com` literal. Every `track()` call is a dead no-op | High | 0.25 | Vercel env vars | No CSP edit needed. `next.config.ts:16,32` already allow `*.posthog.com` and `*.sentry.io` |
| Fix the public GitHub repo description and homepage field | Result #1 for the brand-domain query, advertising PayPal and "AU customers", linking to a 404 Vercel preview | Medium | 0.1 | GitHub settings | `gh repo edit Shalom-P/yoga-website --description "Source for myyogaclasses.fit, a live 1:1 online yoga studio. Next.js 16, Supabase, Razorpay." --homepage "https://www.myyogaclasses.fit"` |
| Change `locale: "en"` to `locale: "en_US"` | OG spec requires `language_TERRITORY`. Bare `en` is dropped | Low | 0.05 | `app/layout.tsx:75` | Do **not** add `alternateLocale` |
| Delete `title:` and `description:` from the root `openGraph` object | All 23 URLs emit the homepage OG title. Deleting lets each page's own title flow through | Medium | 0.1 | `app/layout.tsx:76-78` | Do this **after** the condition titles land, or you propagate the weak title into social cards. Promote the homepage OG string to the homepage segment |
| File Razorpay International acceptance request | The rail. Days-to-weeks lead time, so start the clock now | Critical (parallel) | 0.5 | Razorpay support | Confirm with one test-mode USD order once granted |

**The nine `seoTitle` strings.** Each is ≤42 chars so the 18-char `· My Yoga Classes` template keeps the total under 60. Every term is verified present in that page's own body copy:

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

Two of these are judgement calls I am making explicitly. **mental-health uses "Stress", not "Anxiety"**: "anxiety" appears zero times in `mental-health.json`, and Google rewrites titles whose terms are absent from the body, so the substitution would be wasted. It is also a clinical claim the `0024_category_copy_positive` compliance pass deliberately removed. **geriatric uses "Seniors", not "older adults"**: "seniors" appears zero times in the body but every ranking competitor titles on it, so add the word once to `helpsH2` in the same commit so title and body agree.

**Week 1 total: about 6 hours.**

---

## 3. Weeks 2-6 foundation

| Action | Why | Impact | Hours | Surface | Dependencies |
|---|---|---|---|---|---|
| Add a `RelatedConditions` block: 3 sibling links per condition page, chosen by clinical adjacency, from a static map | Verified: `/classes/diabetes` emits 13 unique internal hrefs, every one nav or footer. `ConditionLanding.tsx` contains exactly two `<Link>`s, one of which is `#how-it-helps`. Nine leaves, zero lateral edges | High | 4 | New `lib/data/condition-links.ts`, `ConditionLanding.tsx` (insert at line 174, before the `{/* 5 · HOW WE WORK */}` comment) | Pass the map as a prop; `ConditionLanding` is `"use client"`. Verify every condition receives ≥2 inbound before shipping |
| Add curated teacher ↔ condition cross-links, both directions | Do **not** derive these from `teachers.specialties`. Those are free-text ("Cardiovascular Health", "Posture Correction") matching none of the nine slugs, and token-matching on "yoga" falsely links Dr Sangeeta to kids-yoga. Hand-curate in code | High | 3 | `ConditionLanding.tsx`, `app/(marketing)/teachers/[slug]/page.tsx` (insert at line 118) | Resolve teacher slugs against the live roster so a deactivated teacher cannot produce a byline to a 404 |
| Add `BreadcrumbList` to all 9 condition pages | The only genuinely live rich result missing here. Builder already exists at `lib/seo/structuredData.ts:68` and is proven on `/teachers/[slug]:45` | Medium | 0.5 | `app/(marketing)/classes/[slug]/page.tsx:48` | Add `Home` as position 1 to the teacher breadcrumb too; it currently starts at "Teachers" |
| Prepend the first-name honorific fix | All three teacher pages render "Meet Dr , a quick hello." and the CTA button reads "Book a 1:1 with Dr". This is the primary CTA on the E-E-A-T pages | Medium | 0.5 | New helper in `lib/utils.ts`; apply at `teachers/[slug]/page.tsx:56,126` and `TeacherSlotPicker.tsx:70` | Strip a **leading** honorific only. Separately fix Dr Hima Bindu's bio ("Ultimately, Dr. aims to…") in `/admin/teachers` |
| Render `teachers.certifications` visibly on `/teachers/[slug]` and add `hasCredential` to `personJsonLd` | The data is already populated: Dr Vaishnavi holds `["Bachelor of Naturopathy and Yogic Sciences","MD in Clinical Yoga"]` and it appears in no markup and no scannable block. This is the site's single strongest differentiator against a 200-hr-certified field | High E-E-A-T | 3 | `lib/seo/structuredData.ts:36-48`, `teachers/[slug]/page.tsx` | Guard the `jsonb`: `Array.isArray(x) && x.every(s => typeof s === "string")`. Do **not** invent a `recognizedBy` issuer. Dr Sangeeta's array is empty; fill it in admin first |
| Replace the sitewide "Every teacher is at least 200-hr Yoga Alliance certified" claim | Unsubstantiated: none of the three holds a findable RYT registration, and all three hold Indian clinical degrees that outrank it for YMYL trust | High | 1 | `teachers/page.tsx:10,21`, `about/page.tsx:24,37`, `HowItWorks.tsx:10` | Use "university-qualified in yoga or naturopathic science" |
| Add per-teacher composed meta descriptions with a clamp | Live values are the raw `headline` field: 27, 32 and 33 chars. `headline` is unbounded admin text, so a template without a clamp will overflow | Medium | 1 | `teachers/[slug]/page.tsx:29` | Add per-teacher `openGraph` in the same change |
| Add reviewer byline and dates to the 9 condition pages | Zero authorship signal on nine YMYL health pages. No `<meta name="author">` anywhere on the site | High E-E-A-T | 4 + review time | `ConditionLanding.tsx`, `lib/data/condition-pages/*.json` (add `reviewerSlug`, `datePublished`, `dateReviewed`) | **Have the teacher actually read and sign off each page first.** Use 2026-06-22 (commit 5c4950c) as publish date. Do not print "Medically reviewed by" for a review that did not happen |
| Rewrite 7 keyword-free hub titles and 6 thin meta descriptions | "About", "Class types", "Pricing", "Teachers", "Reviews", "FAQ", "Contact". `/about` at 44 chars and `/reviews` at 47 give Google nothing | Medium | 2 | The 7 `app/(marketing)/*/page.tsx` metadata exports | Also strip the doubled brand from the three legal titles ("Privacy policy \| My Yoga Classes · My Yoga Classes") |
| Add "online yoga" to the nine `heroLead` strings and the homepage body | The site's own head term appears **zero** times in the body of any page, including the homepage whose title promises it | Medium | 1 | `lib/data/condition-pages/*.json`; note `lib/data/condition-pages.ts:1-6` claims `landing-pages/*.html` is the source of truth and the two have already diverged. Update the comment | None |
| Insert USD, GBP and EUR `plan_prices` rows for all three packs | `pricedCurrencies()` withholds a currency unless **every** active plan has a row, so this is all-or-nothing per currency | Critical revenue | 1 | `/admin/plans` | **Hard gate: Razorpay International confirmed live with a real test charge.** Price as a positioning decision, not an FX conversion. ₹4,499 is $46.83 for five sessions; against the $60-120 US rate that reads as implausible, not cheap |
| Add `Product` + `AggregateOffer` to `/pricing`, INR-derived, server-side | Page emits only Organization and FAQPage. Three real prices with no machine-readable form | Medium | 2 | `lib/seo/structuredData.ts`, `pricing/page.tsx` | Derive every amount from the `plans` array already awaited. Never hardcode. Emit **one** currency (the server-resolved one), never five. Do **not** import `lib/razorpay/catalog.ts` here; it pulls `server-only` into the ISR group |
| Fix `provider.sameAs` in `courseJsonLd` | It currently points at the condition page's own URL, so nine pages each assert a different organizational identity | Low | 0.25 | `lib/seo/structuredData.ts:58` | Point at `siteUrl`. Do **not** use `@id` until `orgJsonLd` has one |
| Fix `app/sitemap.ts`: replace `createSupabaseServerClient` with the anon client, add `export const revalidate = 3600`, hardcode per-route `lastModified` dates | Verified: `/sitemap.xml` returns `x-vercel-cache: MISS`, `age: 0` on every request because the cookie-bound client makes it dynamic. All 11 static routes report a runtime timestamp, so `/legal/privacy` claims to have changed minutes ago on every crawl | Low-Medium | 1.5 | `app/sitemap.ts:11-66,80` | Google only honours `lastmod` it can verify. Drop `changeFrequency` and `priority` while there; both are documented as ignored |
| Route `hero-poster.jpg` through `next/image`; add an immutable cache header rule for `/public` | It is the mobile LCP element, served as a 49,915 B JPEG with `cache-control: public, max-age=0, must-revalidate` (verified). The optimizer already serves it at 29,020 B WebP | Medium | 1 | `components/marketing/HeroVideo.tsx:118`, `next.config.ts:54` | Static import emits a hashed path that already gets `immutable`. Use `quality={75}`; `q=70` returns HTTP 400 on this deployment |
| Drop Inter and Geist_Mono preloads; set Fraunces `preload: false` | Verified via `document.fonts`: Inter renders zero glyphs sitewide, Fraunces zero on all 23 indexable pages. 192,264 B of 304,008 B preloaded font weight is unused, contending with the render-blocking CSS | Medium | 1 | `app/layout.tsx:17-34`, `app/globals.css:10-12` | Fraunces is baked into a `.font-heading` utility used on dashboard cards, so full removal is a visual change there. `preload: false` is the safe version |
| Remove `priority` from the below-fold teacher avatar; fix `sizes` | `TeacherGrid.tsx:87` preloads 114,480 B of WebP for a card 4.1 viewports below the fold | Medium | 0.5 | `TeacherGrid.tsx:87` | Add a `priorityFirst` prop; the same component **is** above the fold on `/teachers` |
| Dynamic-import the Capacitor bridge | 16,519 B brotli of native-shell code ships to every web visitor to then no-op at runtime | Low-Medium | 0.5 | `components/shared/NativeBridge.tsx:4` | Gate on `window.Capacitor?.isNativePlatform?.()` |

**Weeks 2-6 total: about 28 hours plus medical review time.**

---

## 4. Quarter 1 strategic

| Action | Why | Impact | Hours | Surface | Dependencies |
|---|---|---|---|---|---|
| Build `/poses` hub + 15 pose detail pages | The single largest indexable-surface gain available. Competitor runs 84 `/yoga-asana` URLs against this site's 23 total. The JSON gives you the **inventory and the link graph**, not the content: descriptions average 10.0 words | High | 40-60 | New `app/(marketing)/poses/`, `lib/data/poses/` | Dedupe on normalized `sa` or you emit 52 duplicates. Start with the 15 highest-reuse poses (Shavasana appears in 8 conditions, Bhramari in 7, Yoga Nidra in 7). Budget 400-600 words of **new** writing each. **Must** have `generateStaticParams` + `revalidate`, and **no `cookies()` anywhere**, or ISR dies group-wide with no build error |
| Link every pose card on the condition pages into `/poses/[slug]` | This is what makes the hub earn its place. 107 outbound edges appear the moment it ships, and Shavasana alone gains 8 inbound links from depth-1 pages | High | 2 | `ConditionLanding.tsx:151` (currently a plain `<div>`) | Ships with the hub |
| Build `/private-online-yoga-classes` pillar page | The highest-commercial-intent cluster on the board and the site has no URL for it. Every competitor that ranks has one: shvasa.com/lp/private, shyambhai.yoga/one-to-one-yoga-classes/ | High | 8 | New route, `app/sitemap.ts`, `Footer.tsx`, `ConditionLanding.tsx` | Must not cannibalise the homepage. Homepage keeps "find your 1:1 yoga teacher"; this page owns "private / one to one online yoga classes" |
| Build `/online-yoga-in-your-timezone` | The best-engineered feature on the site has no public page, while two competitors already rank one. The real data is good: the three teachers cover **05:00 to 23:00 IST, seven days**, which is US Pacific 17:30-20:30 evening and UK 06:30-14:30 | High | 8 | New route; read `teacher_availability` with the **anon** client (public-read RLS, so ISR survives) | Every slot starts at `:30` in every target market because IST is UTC+5:30. Never publish an on-the-hour local time. Keep DST descriptions qualitative |
| Add a static multi-zone availability table to the three `/teachers/[slug]` pages | Those pages already rank and publish zero schedule information, while the footer promises "Book a session in your local time" | High | 4 | `teachers/[slug]/page.tsx` | Render server-side as a fixed crawlable table (IST / GST / BST / CET / ET / PT). Do not gate behind client-side detection |
| Build `/guides/what-private-online-yoga-costs` | The best uncontested SERP found. Every result for "private yoga lessons cost" is written **for teachers pricing their own classes** or is a local-services aggregator. No buyer-side page exists, because every incumbent is the expensive option | High | 6 | New route | Blocked on USD pricing existing, or the page has no number to quote |
| Collect and publish 15-20 real reviews, geographically mixed | Six invented Gulf testimonials are being removed in Week 1, which leaves a visible hole. The fix is supply, not markup | High | Ongoing | `reviews` table via `/admin` | Only after real rows exist may you add `AggregateRating`, and then to `Product` on `/pricing` or `Course` on `/classes/[slug]`, never to `Person` (schema.org `Person` has no such property) |
| Get GDPR / UK GDPR / CCPA sections into `/legal/privacy`; generalise the Terms §12 consumer carve-out | GDPR Art.3(2) applies because the site explicitly offers services worldwide. Zero occurrences of GDPR, ICO, CCPA anywhere in `app/`, `components/` or `lib/` | Medium | Legal-led | `legal/privacy/page.tsx`, `legal/terms/page.tsx:12` | Edit the existing carve-out sentence, do not add a second one |
| Drop `@supabase/supabase-js` from the marketing bundle | 64,489 B brotli / 241,808 B parsed, shipped to all 23 URLs to decide whether the nav says "Sign in". Three separate static import chains must go together or the saving is zero | Medium | 8 | `lib/auth/useViewer.ts`, `AccountMenu.tsx:18`, `PricingTeaser.tsx:17` | Replace with a cookie read; `connect-src` already allows `*.supabase.co`, so no CSP edit. Keep a `storage` listener for cross-tab sign-out. TBT/INP gain, not LCP |
| Directory and entity placements | One `sameAs` edge total. Zero observable external citations | Medium | 8 | GitHub, LinkedIn, Wikidata | **Blocked until the payment rail works.** Best targets: `healthynexercise.com/best-yoga-classes/` (29-entry list, independent, already ranks for "myyogateacher alternatives"), `happytrainers.com`, Crunchbase. Skip yogatrail.com, it 301s to a defunct agency portfolio |

---

## 5. What we are deliberately NOT doing, and why

**hreflang.** Tempting because the brief says "global". Wrong here. There is one language and one URL per topic. A self-referential-only hreflang set is pure overhead, and pointing multiple hreflang values at the same URL is a self-inflicted duplicate-signal problem. `<html lang="en">` is already correct and is what Google actually consumes. Revisit only if genuinely differentiated per-market URLs ever ship, and note the ordering: differentiation is the prerequisite, hreflang is the follow-on.

**Geo landing pages (`/online-yoga-classes-usa` and friends).** patanjaleeyoga.com publishes seven of these and they are the weakest pages on their site: 1,254 words, duplicate H1s, no local signal behind the claim. They also actively fight the `areaServed: "Worldwide"` positioning already in the Organization JSON-LD. The timezone page captures the same intent honestly.

**FAQPage markup on the condition pages.** Cheap, yes, but Google removed FAQ rich results from Search on 2026-05-07 and deleted the documentation in June 2026. It produces no SERP surface. Ship `BreadcrumbList` instead, which still renders. If someone adds FAQPage anyway for Bing and AI answer surfaces, fine, but do not book it as a win. **Conflicting findings resolved in favour of dropping it.**

**HowTo and ExerciseAction schema on pose pages.** HowTo rich results were deprecated in September 2023. ExerciseAction was never a supported rich-result type. Neither renders anything.

**Any `AggregateRating` markup, anywhere, until real reviews exist.** This is the one change that would convert a copy and advertising problem into a structured-data spam problem with a manual-action surface. The current absence of rating markup is the only reason the "1,200+ reviews" claim is not already a Google policy issue as well as an FTC one.

**Migrating off the `.fit` TLD.** It is a gTLD, treated as globally neutral, with no ranking penalty. A migration would cost every existing signal for a benefit Google does not grant. Buy `myyogaclasses.com` as a 308 redirect if it is cheap, never as a second live site.

**Chasing head terms: "online yoga classes", "private yoga lessons cost", "yoga therapy".** The first is owned by yogainternational, doyogawithme, corepoweryoga and Alo Moves. The second is publisher cost-data pages. The third returns NCBI PMC four times plus Cleveland Clinic. A 23-URL domain with no citation profile does not enter these SERPs. Condition queries and pose queries are winnable; these are not.

**Guest-post networks and syndicated press releases.** Every "write for us" yoga site found (thedailymeditation.com, healthywrites.com, yoga2all.com submitting to a Gmail address, kayawell.com openly selling placements) is the exact footprint Google's link spam systems classify. On a four-month-old domain the links carry no equity and the footprint carries real risk.

**Making the GitHub repo private as an SEO action.** It removes one result and the SERP goes empty, because the site is barely indexed. Fix the metadata instead, which takes five minutes. Going private is a security decision worth arguing on its own merits.

**Publishing all 55 poses at once from the existing JSON.** Median description is 10 words. Fifty-five stubs would more than double the index with the thinnest pages on the domain, on a site that has no authority to spend on thin content. Ship 15 real ones.

**GA4 or Google Tag Manager.** PostHog already gives referrer and UTM attribution and country breakdowns, its origins are already in the CSP, and there is no cookie-consent component in the repo. Adding GA4 means a third-party origin in the hand-maintained `next.config.ts` CSP plus a consent gate for the EU and UK visitors the whole strategy is aimed at.

**Deleting `changeFrequency`, `priority` and the vestigial `CNAME` file as standalone tasks.** They save 75 gzipped bytes and nothing respectively. Fold them into the sitemap fix or skip them.

**The free-trial question.** `app/api/bookings/confirm/route.ts:22` has `isFreeTrial: z.boolean().default(true)`, so the backend grants a free first session that no public copy mentions. That is a deliberate documented mismatch and not an SEO item, but flag it before scaling acquisition: at volume it consumes one 60-minute teacher hour per signup against a three-teacher roster, and it buys nothing because nobody knows it is on offer. It is a business decision, not a bug. Make it consciously.

---

## 6. How we will know it worked

**The instrumentation gap is smaller than the brief assumed, and larger in a different place.** Search Console is already verified by DNS TXT as a Domain property, so historical data exists and nobody has read it. PostHog is the thing that is genuinely dead: `NEXT_PUBLIC_POSTHOG_KEY` is unset in production, and all 28 homepage chunks contain zero occurrences of "posthog", including the default `https://us.i.posthog.com` literal. Every `track()` call currently compiles to an empty function body.

### Week 1: establish the baseline

Before anything ships, record from the existing GSC property:

- Total indexed pages (Indexing → Pages). Critical distinction: **"Discovered, currently not indexed"** means a crawl-budget and authority problem; **"Crawled, currently not indexed"** means Google judged the pages thin. These point at different fixes.
- Impressions, clicks, average position, split by **Country**. This is the only instrument that answers the central question: is an INR-defaulting site with `areaServed: Worldwide` reaching any non-IN searcher today?
- Per-URL impressions for the nine condition pages and `/pricing`.

Then set `NEXT_PUBLIC_POSTHOG_KEY`, and add the missing revenue event **server-side** in `lib/razorpay/fulfillment.ts` (the single idempotent fulfilment point, so both the verify-payment and webhook rails are covered) plus the verify branch of `app/api/admin/payments/[id]/route.ts`. `trackServer` takes a free-form string, so no `EventName` union edit is needed.

Also install `@vercel/analytics` and `@vercel/speed-insights`. Both serve from same-origin `/_vercel/insights/`, so `script-src 'self'` already permits them with **zero CSP edits**. This matters specifically because a 23-URL site is almost certainly below the CrUX traffic threshold, so GSC's Core Web Vitals report will stay permanently empty and you will have no field data at all otherwise.

### Metrics, by checkpoint

**Month 1 (leading indicators only, no ranking movement expected)**

| Metric | Source | Target |
|---|---|---|
| Indexed pages | GSC Indexing → Pages | 23 of 23, no "Crawled, not indexed" |
| Condition-page impressions | GSC, per-URL filter | Any non-zero movement after the title change. This is the fastest-responding signal on the list; titles typically re-render in SERPs within 2-4 weeks |
| Rendered word count on `/faq` | `curl \| strip scripts \| wc -w` | 195 → ~395 |
| `accordion-content` nodes in server HTML | `curl /faq \| grep -c` | 0 → 9 |
| Zero "Placeholder" strings live | `curl` all 9 condition URLs | 0 |
| PostHog events firing | PostHog live view | `hero_cta_click`, `paid_plan_clicked` non-zero |
| Apex redirect status | `curl -sI https://myyogaclasses.fit/` | 308 |

**Month 3 (first real signal)**

| Metric | Source | Target |
|---|---|---|
| Non-IN impressions share | GSC Country dimension | Any measurable US/GB/AE share. This is the single most important number in the whole plan |
| Long-tail ranking positions | GSC, queries containing the condition terms | Positions 30-60 on "yoga for diabetes online", "chair yoga for seniors online". Page 1 is not the month-3 target |
| Indexed pages | GSC | 23 → ~40 as `/poses` and the pillar pages land |
| Organic sessions | PostHog | 20-100/month. This is genuinely the realistic range for a 4-month-old .fit domain with no citation profile |
| First international transaction | PostHog `pack_purchased` with a non-INR currency | ≥1. If this is still zero, the rail is the problem, not the SEO |

**Month 6**

| Metric | Source | Target |
|---|---|---|
| Condition-cluster positions | GSC | Page 1 for specific long-tail condition queries. patanjaleeyoga and shyambhai are beatable: thin, uncited, duplicate H1s. myyogateacher's 241-article hub is not |
| Internal-link depth effect | GSC per-URL impressions on condition pages | Each page should show impressions; if a page has zero after six months with 8+ inbound links, its content is the problem, not its linking |
| Organic sessions | PostHog | 200-600/month |
| Sessions → checkout rate by country | PostHog funnel | Comparable across IN, AE, US, GB. A US-specific drop points at pricing or trust, not traffic |
| External referring domains | Manual `link:` and referral traffic in PostHog | 3-8. Directory placements and roundup inclusions only |

**Months 12-24.** Head terms become contestable only with sustained link acquisition. Do not plan for them before month 12.

### The honest timeline

Months 0-3 produce **no meaningful ranking movement**. That is not a failure mode, it is how a four-month-old domain with 23 URLs, zero external citations and a brand SERP currently won by a GitHub repo behaves. Anyone promising otherwise is guessing.

What months 0-3 do produce is measurable and worth watching: indexation coverage, impression movement on the retitled condition pages (titles are the fastest-responding on-page lever there is), the removal of every fabricated trust claim, and a working international payment rail ready before the traffic arrives.

The one number that would justify re-planning the whole thing at month 3 is **non-IN impression share**. If it is still effectively zero after nine new URLs, a connected internal link graph and keyword-bearing titles, the constraint is authority rather than content, and the budget should shift from publishing to citation-building.