# Full findings ledger

221 findings surviving adversarial verification: 205 from the 12 audit dimensions, 16 from the backfill round (AI search, and closing the completeness critic's gaps).

Verdicts: `confirmed` = verifier reproduced it as stated. `partially-correct` = core issue real, evidence/severity/recommendation corrected (the corrected text is what appears below). `unverified` = beyond the 10-per-dimension verification cap.

---

## international (17)

### [HIGH] Homepage advertises "4.9 · 1,200+ reviews" while the reviews table is empty and all six testimonials are hardcoded UAE mocks

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/, https://www.myyogaclasses.fit/reviews, /Users/shalomp/YOGA_WEBSITE/lib/data/landing.ts

**Evidence.** Live DB: `select * from reviews limit 1` returns `(0 rows)`. The homepage nonetheless renders `★★★★★ 4.9 · 1,200+ reviews` (extracted from live HTML at https://www.myyogaclasses.fit/), sourced from admin_settings keys `landing.trust_rating = "4.9"` and `landing.trust_count = "1,200+ reviews"`. Because getFeaturedReviews() falls back on an empty result (lib/data/landing.ts:384 `if (!data || data.length === 0) return MOCK_REVIEWS;`), what renders on / , /pricing and /reviews is MOCK_REVIEWS, which is exactly 6 entries at lib/data/landing.ts:274-281 with display_location values `Dubai, AE`, `Abu Dhabi, AE`, `Abu Dhabi, AE`, `Sharjah, AE`, `Dubai, AE`, `Bengaluru, IN`. Five of six are UAE and the sixth is India. Zero are US, UK, EU, Canada, Singapore or Australia.

**Recommendation.** Title: Homepage trust bar advertises "4.9 · 1,200+ reviews" and teacher cards show 4.8/5.0 star ratings, while the reviews table is empty and the six rendered testimonials are hardcoded Gulf mocks

Severity: high (advertising-compliance and conversion-trust, not a ranking mechanism)

Evidence, verified 2026-09-16 by direct fetch:
- Homepage hero renders "★★★★★ 4.9 · 1,200+ reviews", sourced from admin_settings landing.trust_rating and landing.trust_count (RSC payload: "4.9","trustCount":"1,200+ reviews").
- Only / and /reviews call getFeaturedReviews (app/(marketing)/page.tsx, app/(marketing)/reviews/page.tsx). /pricing does not, and carries no trust bar. Both surfaces render exactly the six MOCK_REVIEWS at lib/data/landing.ts:274-281, with locations Dubai AE, Abu Dhabi AE, Abu Dhabi AE, Sharjah AE, Dubai AE, Bengaluru IN. /reviews shows 6 cards, not 12.
- The fallback firing on a fully configured live Supabase (lib/data/landing.ts:384) is itself the proof the featured+approved reviews query returns zero rows.
- Additionally: /teachers renders "★ 4.8 Dr Vaishnavi Mayya" and "★ 5.0 Dr Sangeeta"; the payload carries rating_avg 4.95 / rating_count 312 for a teacher with an empty reviews table. The homepage "Next available" strip advertises "Gentle Hatha with Aarti" for a teacher not on the live roster.
- No AggregateRating or Review structured data exists on any page. Homepage JSON-LD is Organization, FAQPage with 9 Question/Answer pairs, and ContactPoint. Teacher pages are Organization, Person, BreadcrumbList. The only aggregateRating string in the repo is a comment at lib/seo/structuredData.ts:34.

Why it is high and not critical: with no review markup there is no rich-result eligibility and no Google spam-policy surface, so this costs nothing in rankings today. It is a Section 5 / CAP Code exposure and it undercuts the conversion story for a Western searcher who sees six Gulf cities under a claim of 1,200 reviews backed by 3 teachers.

Three fixes, in priority order:
1. admin_settings (DB, not code, per the DB-driven-copy constraint): set landing.trust_count and landing.trust_rating at /admin/settings to something defensible, or blank them so the trust bar drops out. The component already reads these keys, so a null renders nothing.
2. teachers.rating_avg and teachers.rating_count (DB, not code): zero the seeded 312 on Dr Vaishnavi Mayya and suppress the star badge on /teachers when rating_count is 0. This one is invisible to a repo grep and will survive any code-side fix.
3. lib/data/landing.ts:274-281 (code, and effective precisely because the table is empty): until real consenting customers exist, either shrink MOCK_REVIEWS to a geographic mix that matches the worldwide positioning, or gate the reviews section off entirely when the DB returns zero rows rather than falling back to invented testimonials. A visibly empty section is a smaller trust cost than six fictional Gulf students on a page whose Organization JSON-LD says areaServed Worldwide.

Do not add AggregateRating, Review or Product review markup on top of any of these numbers. That is the one change that would convert a copy problem into structured-data exposure.

### [HIGH] Condition page titles are bare category names, wasting the nine strongest pages on the site

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx, https://www.myyogaclasses.fit/classes/diabetes, https://www.myyogaclasses.fit/classes/hypertension

**Evidence.** Live titles fetched directly: `<title>Diabetes · My Yoga Classes</title>`, `<title>Hypertension · My Yoga Classes</title>`, `<title>Prenatal &amp; Postnatal · My Yoga Classes</title>`, `<title>Weight Loss · My Yoga Classes</title>`, `<title>Mental Health · My Yoga Classes</title>`, `<title>Kids Yoga · My Yoga Classes</title>`. Source is app/(marketing)/classes/[slug]/page.tsx generateMetadata, which returns `title: c?.name ?? "Class"`, the raw class_categories row name. Not one contains the words "yoga", "online", "1:1" or "class". Correcting the first-pass audit: the meta DESCRIPTIONS are actually good and keyword-bearing (for example "Gentle 1:1 yoga for diabetes: easy movement, breathwork, and rest to support steady energy and calmer days, practised alongside your medical care"), so the defect is titles only. Page bodies are substantial: 978 words (diabetes), 979 (prenatal), 865 (kids-yoga).

**Recommendation.** Title: Condition page titles are the bare class_categories name, leaving the site's nine strongest pages without a keyword-bearing title element.

Corrected evidence: All nine live titles are the raw category name plus the layout template, e.g. `<title>Diabetes · My Yoga Classes</title>`, `<title>Geriatric Yoga · My Yoga Classes</title>`. Source: app/(marketing)/classes/[slug]/page.tsx:28-36, `title: c?.name ?? "Class"`. Template: app/layout.tsx:64-67, `template: "%s · My Yoga Classes"` (18 chars). Two of the nine do contain the word "yoga"; none contains "online", "1:1" or "class". Meta descriptions AND H1s are already good and keyword-bearing (H1 "Yoga for diabetes, shaped around you"), so the title element is the only gap.

Corrected implementation: do NOT add a separate map in page.tsx. The per-slug content layer already exists. Add `metaTitle: string` to the ConditionPage type in lib/data/condition-pages.ts (alongside the existing `metaDescription` field), add one line to each of the nine lib/data/condition-pages/*.json files, and change page.tsx line 31 to `title: rich?.metaTitle ?? c?.name ?? "Class"`. The `?? c?.name` fallback keeps any future category added in the DB rendering correctly.

Corrected title strings, each at or under 42 chars, all commas, no em-dashes, and each one verified against terms that actually appear in that page's body:
- diabetes: "Yoga for Diabetes, Live 1:1 Online" (34)
- hypertension: "Yoga for High Blood Pressure, 1:1 Online" (40)
- prenatal: "Prenatal and Postnatal Yoga, 1:1 Online" (39) — restores "Postnatal", which appears 4 times in the body and in the category name
- weight-loss: "Yoga for Weight Loss, Live 1:1 Online" (37)
- mental-health: "Yoga for Stress Relief, Live 1:1 Online" (39) — NOT "Anxiety", which appears 0 times in the body and is a clinical-claim risk under the UAE/India health-claim-safe copy rule
- pain-relief: "Yoga for Neck, Back and Joint Pain" (34) — mirrors the page's own meta description framing. Do NOT use "Back Pain Relief": "back pain" appears 0 times; the body is neck, shoulder, hip and knee
- hormonal-health: "Yoga for Hormonal Health, 1:1 Online" (36) — drop "PCOS", which appears once and only inside an FAQ question. Add it to the title only after the body covers PCOS substantively
- geriatric: "Chair Yoga for Seniors, Live 1:1 Online" (39) — verified sound, "chair" appears 20 times
- kids-yoga: "Kids Yoga Online, Live 1:1 Classes" (34)

Expected-impact caveat to state alongside the fix: Google rewrites 61-76% of title tags and substitutes primarily from the H1. Because these H1s already read "Yoga for X", part of the SERP-display benefit may already be in place; the durable gain is the relevance signal and the addition of "online" and "1:1", which appear in neither the current title nor the H1. Keeping the new title aligned with the visible H1 also measurably reduces the odds Google rewrites it.

Also reclassify: this is an on-page metadata finding, not an international one.

### [HIGH] No Google Search Console verification exists, and the country-targeting setting people expect to configure was retired by Google in 2022

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** https://www.myyogaclasses.fit/, /Users/shalomp/YOGA_WEBSITE/app/layout.tsx

**Evidence.** No `google-site-verification` meta tag anywhere in the live homepage HTML, and no such string in the repo. Separately, the site runs on two independently resolving hosts (apex 216.198.79.65 / 216.198.79.1, www 64.29.17.65 / 216.198.79.1), so a URL-prefix property on one host would miss the other.

**Recommendation.** Correct the common misconception first: the GSC International Targeting report, and with it the ability to set a country target for a gTLD, was removed by Google in 2022. There is no country-targeting setting to configure for .fit. What to actually do: (1) create a DOMAIN property for myyogaclasses.fit and verify by DNS TXT, not by meta tag, because a Domain property covers apex, www, every subdomain and both protocols in one record and survives the apex/www split; (2) submit https://www.myyogaclasses.fit/sitemap.xml; (3) use Performance, then the Country dimension, as the measurement surface for market prioritisation, and set up per-country filters for US, GB, AE, IN, CA, SG, AU; (4) if you later ship region pages, create URL-prefix properties per directory so you can read each market's performance in isolation. The one place geo-targeting still exists as a lever is Bing Webmaster Tools, which retains per-site and per-directory geo-targeting, so set that once region pages exist. Adding a verification meta tag to app/layout.tsx is fine as a secondary method but do not make it the primary one.

### [MEDIUM] Every US, UK and EU visitor is billed in Indian rupees right now, at 44% below the UAE price for the identical pack

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/pricing, https://www.myyogaclasses.fit/api/region, /Users/shalomp/YOGA_WEBSITE/lib/razorpay/catalog.ts, /Users/shalomp/YOGA_WEBSITE/supabase/migrations/0036_international_currencies.sql, /Users/shalomp/YOGA_WEBSITE/components/marketing/PricingTeaser.tsx

**Evidence.** Live DB query against db.fjwffujcnpltkpfrgpdx.supabase.co returns exactly 6 plan_prices rows and zero USD/GBP/EUR rows: `AED|pack-1|5900, AED|pack-10|49900, AED|pack-5|27500, INR|pack-1|99900, INR|pack-10|799900, INR|pack-5|449900`. Migration 0036 IS applied (pg_constraint shows `plan_prices_currency_check CHECK (currency = ANY (ARRAY['INR','AED','USD','GBP','EUR']))`) but inserted no prices, exactly as its own header comment says. pricedCurrencies() in lib/razorpay/catalog.ts only adds a currency when EVERY active plan has a row, so the priced set is {INR, AED}. effectiveCurrency('USD'|'GBP'|'EUR') therefore returns DEFAULT_CURRENCY = 'INR'. Confirmed end to end on the live site: GET https://www.myyogaclasses.fit/api/region returns `{"country":"IN","currency":"INR","locale":"en-IN"}`, and the prerendered /pricing HTML that Googlebot crawls contains ₹999, ₹4,499, ₹7,999 plus the literal string `Prices shown in INR.` (components/marketing/PricingTeaser.tsx:411). At the 2026-09-15 rate of 1 INR = 0.01042 USD / 0.00773 GBP / 0.00903 EUR: the 5-pack is $46.88 / £34.78 / €40.64 ($9.38 per session) and the 10-pack is $83.35 / £61.85 / €72.26 ($8.33 per session). The same 5-pack in AED 275 is $74.87 ($14.97 per session). A US buyer pays 37% less than a UAE buyer for identical service.

**Recommendation.** TITLE: US, UK and EU visitors are quoted and charged in INR because no USD/GBP/EUR plan_prices rows exist, roughly 37% below the UAE price for the same pack

SEVERITY: medium, not critical. Zero search-visibility impact (no Offer/priceCurrency JSON-LD on /pricing to poison, and no established international rankings yet). This is a margin ceiling on international traffic, and it is a blocker for spending on US/UK/EU acquisition, not a ranking defect.

EVIDENCE (corrected):
- Live plan_prices, read straight out of the prerendered /pricing RSC payload (no DB access needed): AED 5900/27500/49900 and INR 99900/449900/799900 across pack-1/pack-5/pack-10. No USD, GBP or EUR row.
- lib/razorpay/catalog.ts pricedCurrencies() only adds a currency when every ACTIVE plan is covered, so the priced set is {INR, AED}; effectiveCurrency('USD'|'GBP'|'EUR') returns DEFAULT_CURRENCY = INR. components/marketing/PricingTeaser.tsx:160-161 applies the same downgrade client-side, so grid and checkout agree on the wrong currency.
- Correct proof to cite for a US visitor: GET /api/region from a US IP returns country "US" with currency "INR" and locale "en-IN". Do not cite an Indian-vantage call: I fetched /api/region twice and got {"country":"IN","currency":"INR","locale":"en-IN"} with x-vercel-id bom1, which is correct behaviour and proves nothing.
- Drop the "prerendered HTML contains ₹" line as evidence of mispricing. /pricing is prerendered for everyone, so a UAE visitor also receives ₹ in the initial HTML and gets AED only after the client-side /api/region swap.
- Corrected gap, at USD/INR 96.07 (2026-09-15) and the AED peg 3.6725/USD, i.e. 26.16 INR per AED: pack-5 ₹4,499 = $46.83 vs AED 275 = $74.88, 37.4% below. pack-10 ₹7,999 = $83.26 vs AED 499 = $135.88, 38.7% below. pack-1 ₹999 = $10.40 vs AED 59 = $16.07, 35.2% below. Per session a US buyer pays $9.37 on the 5-pack against $14.98 for a UAE buyer. The 44% in the original title is not supported by any rate; delete it.

RECOMMENDATION (corrected):
- Unchanged in substance and already executable: /admin/plans renders USD/GBP/EUR inputs today (components/admin/PlansAdmin.tsx:400 maps SUPPORTED_CURRENCIES; the save path upserts on plan_id,currency at lines 193-218). Fill all three packs in a currency or leave it blank everywhere, since a partially priced currency is deliberately withheld.
- Replace the verification query, which currently counts inactive plans: select pp.currency, count(*) from plan_prices pp join plans p on p.id = pp.plan_id where p.is_active group by 1 order by 1; each live currency must equal the active-plan count (3 today).
- Treat the suggested anchors as illustrative, not as a finding: USD 2900/11900/19900, GBP 2400/9900/16900, EUR 2700/10900/18900 minor units. At USD 11900 the 5-pack is $23.80 per session, still well under the $89 to $459/month competitor band.
- Razorpay International acceptance must be live on the account first, otherwise USD/GBP/EUR orders are created and then declined at Checkout. Price the rows only after that is confirmed.

ADD, and this is the genuinely SEO-facing half the finding omitted: app/(marketing)/pricing/page.tsx:13 ships description "Honest yoga pricing in AED and INR. One-time session packs, no subscription." That is the live SERP snippet for /pricing worldwide and it reads as a Gulf/India-only service to every US, UK and EU searcher. It is in code, not a DB-driven surface, so change it to something currency-neutral, for example "One-time packs of live 1:1 yoga sessions with teachers in India. No subscription, sessions never expire." Fix that in the same pass.

ALSO CORRECT THE AUDIT'S OWN FACT LIST: established item 12 ("5-pack is ~$23-24/session") is wrong. The live 5-pack is $9.37 per session in INR, or $14.98 per session for a UAE buyer in AED.

### [MEDIUM] Apex to www redirect is a 307 Temporary Redirect, so Google will not fully consolidate signals onto the canonical www host

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** medium
- **Locations:** https://myyogaclasses.fit/, /Users/shalomp/YOGA_WEBSITE/CNAME

**Evidence.** `curl -o /dev/null -w '%{http_code} %{redirect_url}' https://myyogaclasses.fit/` returns `307 https://www.myyogaclasses.fit/`. By contrast the http-to-https hops are correct 308s (`http://myyogaclasses.fit/` returns 308, `http://www.myyogaclasses.fit/` returns 308). So the only host-consolidation hop on the site, the one that actually matters, is the one marked temporary. DNS confirms both hosts resolve independently: apex A records 216.198.79.65 and 216.198.79.1, www A records 64.29.17.65 and 216.198.79.1. Additionally, a stale GitHub Pages artifact `/Users/shalomp/YOGA_WEBSITE/CNAME` contains `myyogaclasses.fit`, the apex, contradicting the www canonical the site actually uses.

**Recommendation.** Title: Apex to www is a 307 Temporary Redirect, so bare-domain link equity will not consolidate onto the canonical www host

Severity: medium (not high). The apex serves no content and every other canonical signal already points to www unanimously, so www is not at risk of being displaced in the index. The cost is confined to inbound links and citations that use the bare apex, which is the form people naturally type and link. Real but forward-looking, and trivially fixable.

Dimension: technical / canonicalization (not international).

Evidence (verified):
- `curl -sSI https://myyogaclasses.fit/` returns `HTTP/2 307` with `location: https://www.myyogaclasses.fit/`, `server: Vercel`, empty `text/plain` body. Path-preserving: `/pricing` and `/classes/diabetes` also 307 to their www equivalents.
- The chain from the typed domain is two hops and the final hop is the temporary one: `curl -L http://myyogaclasses.fit/` yields `308 -> https://myyogaclasses.fit/` then `307 -> https://www.myyogaclasses.fit/`.
- Google's documentation (developers.google.com/search/docs/crawling-indexing/301-redirects): 301/308 means "the indexing pipeline uses the redirect as a signal that the redirect target should be canonical"; 302/307 means "the indexing pipeline doesn't use the redirect as a signal that the redirect target should be canonical."
- Mitigating context that bounds the severity: the homepage carries `<link rel="canonical" href="https://www.myyogaclasses.fit"/>`, all 23 sitemap `<loc>` entries are on www, `robots.txt` declares `Host: https://www.myyogaclasses.fit`, and `app/layout.tsx:60-63` sets `metadataBase` to `https://www.myyogaclasses.fit`. Google's same doc notes the target "might still be indexed if other canonicalization signals are present."

Recommendation:
In the Vercel project's Domains settings, open `myyogaclasses.fit`, keep the redirect target as `www.myyogaclasses.fit`, and change the status code from 307 to 308. Vercel exposes 301/302/307/308 on domain redirects (per the "Domains can now be redirected with a custom status code" changelog); 308 is the permanent, method-preserving equivalent of 301. Re-verify with `curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' https://myyogaclasses.fit/` expecting `308 https://www.myyogaclasses.fit/`, and re-run `curl -L http://myyogaclasses.fit/` to confirm both hops in the chain are now 308.

Guardrail: make this change only in the Vercel Domains dashboard. Do not add a host-matched `redirects()` entry in `next.config.ts`. A Next-level host redirect would fight the domain-level rule and can loop on non-root paths, and it would evaluate on every request into the ISR-cached (marketing) group.

Dropped from this finding: the `/Users/shalomp/YOGA_WEBSITE/CNAME` claim. That file is at repo root rather than in `public/`, so Next never serves it (`/CNAME` returns 404 live), GitHub Pages is not enabled on the repo (`shalom-p.github.io/yoga-website` returns 404) and there is no `.github/workflows/`. It is invisible to every crawler and has no SEO effect. Deleting it is optional repo tidying, not an SEO action, and belongs in a housekeeping list.

Also dropped: the DNS sentence. The observed records (apex 216.198.79.65 / 64.29.17.1, www 64.29.17.65 / 216.198.79.1) are Vercel's rotating anycast pool. Both hosts living on Vercel's edge is exactly how a correctly configured apex redirect looks and says nothing about signal consolidation.

### [MEDIUM] 107 Sanskrit-named poses are already rendering live but are buried inside nine pages with no dedicated URLs, forfeiting the exact URL class the market leader uses to outrank you 26 to 1

- **Verdict:** partially-correct | **Effort:** substantial | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx, https://www.myyogaclasses.fit/sitemap.xml

**Evidence.** Correcting the first-pass audit: these are NOT unpublished. Live HTML for /classes/diabetes contains 16 occurrences of "asana" including Tadasana, Vajrasana, Mandukasana, Paschimottanasana, Matsyendrasana, Bandhasana, Shavasana; /classes/kids-yoga has 20 and /classes/prenatal has 18. Parsing lib/data/condition-pages/*.json confirms 107 poses across 35 poseGroups (not 36), each with `sa` (Sanskrit), `en` (English) and `desc` fields, for example `{"sa": "Bhujangasana", "en": "Cobra", "desc": "..."}`. The real defect is that each pose is one line inside a 978-word page, so none can rank for its own name. Meanwhile myyogateacher.com runs 84 URLs under /yoga-asana and 241 under /articles within a 613-URL sitemap, against this site's 23.

**Recommendation.** CORRECTED FINDING: A pose library is already rendering live inside the 9 condition pages but has no dedicated URLs. The real inventory is 107 pose ENTRIES resolving to 55 unique names, of which only ~31 are true Sanskrit asana names (plus 5 pranayama/meditation practices that merit their own pages: Nadi Shodhana, Bhramari, Sheetali, Yoga Nidra, Dhyana). 17 entries are English descriptors with no Sanskrit name and are not viable standalone pages. Seventeen names repeat across conditions (Shavasana in 8 files, Bhramari in 7, Yoga Nidra in 7, Nadi Shodhana in 6), so any per-entry URL scheme must deduplicate on `sa` or it will emit 52 duplicate pages.

CORRECTED RECOMMENDATION:
1. Build /poses as a hub plus ~36 detail pages (31 asanas + 5 pranayama), deduplicated on a normalized `sa` key. Realistic sitemap growth is 23 to ~60 URLs, not 131. Use bare Sanskrit slugs matching the competitor's proven pattern (/poses/bhujangasana), not the compound "bhujangasana-cobra-pose", and put the English name in the H1: "Bhujangasana (Cobra Pose)".
2. Budget the content honestly. The existing `desc` fields average 10.0 words and several are condition-flavored rather than neutral (the Bhujangasana desc is written for kids: "a gentle backbend children get to hiss along with"). Reaching 300-500 words per page is 10,500-17,500 words of new writing plus a neutral rewrite of every reused desc. This is a content project, not a rendering change. The JSON gives you the page inventory and the internal-link graph, not the prose.
3. Drop HowTo and ExerciseAction. HowTo rich results were deprecated by Google in September 2023; ExerciseAction was never a supported rich-result type. Neither renders anything. Ship BreadcrumbList only, which IS still live and is genuinely missing from the condition pages today.
4. Keep the strongest part of the original recommendation: two-way internal links between each pose page and every condition page whose poseGroups reference it. The dedupe map makes this free, and it fixes the condition pages' dead-end problem. Shavasana alone links to 8 condition pages.
5. Replicate the /classes/[slug] bottom medical disclaimer on every pose page and keep the claim-safe framing established by migration 0024. Do not let expanded descriptions drift into therapeutic claims, per UAE/India ad rules.
6. Reuse the existing ISR pattern verbatim: export const revalidate plus generateStaticParams over the static JSON, and add the routes to app/sitemap.ts. No cookies(), no new third-party origin, so ISR and the CSP are both unaffected.
7. Sequence this AFTER the condition-page title-tag fix. Live titles are bare category names ("Diabetes · My Yoga Classes"), which is a one-line change on higher-intent traffic.

Also correct established-list item 7: there is NO FAQPage on the condition pages. Live /classes/diabetes carries only Organization and Course JSON-LD.

### [MEDIUM] No Product or Offer structured data on /pricing, so no price, currency or availability is eligible for rich results in any market

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** medium
- **Locations:** https://www.myyogaclasses.fit/pricing, /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts

**Evidence.** Parsed every application/ld+json block on the live /pricing HTML. Exactly two nodes exist: `Organization` (keys: @context, @type, name, url, logo, sameAs, description, areaServed) and `FAQPage` (keys: @context, @type, mainEntity). No Product, no Offer, no AggregateOffer. The page renders three real purchasable packs (₹999 / ₹4,499 / ₹7,999) with no machine-readable price at all.

**Recommendation.** Title: /pricing has no Product/Offer structured data, so the three session-pack prices are not machine-readable (severity: medium, not high)

Evidence (corrected): Live /pricing serves exactly two application/ld+json nodes. Organization (@context, @type, name, url, logo, sameAs, description, areaServed, knowsLanguage, contactPoint) and FAQPage (@context, @type, mainEntity). No Product, Offer or AggregateOffer anywhere in the 93 KB document. Three purchasable packs render at ₹999 / ₹4,499 / ₹7,999 with the note "Prices shown in INR", none of it machine-readable.

Why medium, not high: Google's product-snippet docs state "Currently, product rich results only support pages that focus on a single product (or multiple variants of the same product)." A three-pack pricing page is defensible as variants but eligibility is not guaranteed, and the merchant-listing experiences that actually display price require e-commerce/Merchant Center signals this service business will not have. Real upside is a possible price snippet on one branded-intent URL out of 23. Worth doing, cheap, but it is not a high-impact international lever. Against hreflang, the invalid og:locale "en", and content depth, this ranks below all three.

Recommendation (corrected): Add a productJsonLd builder to lib/seo/structuredData.ts alongside the existing schema-dts builders, and render it from app/(marketing)/pricing/page.tsx, which already awaits getPlansWithFeatures() and receives the plan_prices rows.

Emit ONE Product with an AggregateOffer in exactly one currency: the currency the server actually renders. Derive it from the prices rows already in hand, reusing the rule at PricingTeaser.tsx:156-161 (a currency counts only when every active plan has a row in it), defaulting to INR. Do NOT import lib/razorpay/catalog.ts here: it pulls server-only and the service-role client into the public (marketing) ISR group. Build amounts from amount_cents divided by 100, never from a hardcoded literal, so the markup cannot drift from the rendered price.

Shape, today (INR): {"@context":"https://schema.org","@type":"Product","name":"Live 1:1 Online Yoga Sessions","description":"Prepaid 60-minute personalised 1:1 yoga sessions with experienced teachers in India.","brand":{"@type":"Brand","name":"My Yoga Classes"},"url":"https://www.myyogaclasses.fit/pricing","offers":{"@type":"AggregateOffer","priceCurrency":"INR","lowPrice":"999","highPrice":"7999","offerCount":3,"availability":"https://schema.org/InStock"}}. Use "experienced" rather than "certified": the site's own copy says "expert teachers from India" and an unverified certification claim on a health-adjacent page is a needless exposure under UAE/India ad rules. No em-dashes, no free-trial wording.

Two constraints that govern the implementation:
1. The displayed currency is swapped client-side after mount by PricingTeaser.tsx:71-95 (/api/region) on a single shared ISR cache entry. The JSON-LD must be emitted server-side from the server-resolved currency and must never be rewritten on the client, or the markup and the DOM diverge for any visitor whose currency differs.
2. Do NOT emit one Offer per (plan, currency) pair when USD/GBP/EUR are priced. Five currencies for the same pack on one cached URL is ambiguous to Google and gains nothing internationally. If real multi-currency pricing ever ships, the correct answer is per-market URLs with hreflang, and one currency per URL.

Keep the finding's AggregateRating guardrail: do not add one. The homepage trust bar claims "4.9 · 1,200+ reviews" while /reviews renders 12, so marking that up would be a fabricated-review exposure.

### [MEDIUM] Teacher supply ends at 23:00 IST, which structurally starves the two highest-value Western booking slots: UK/EU evening and US Pacific evening

- **Verdict:** partially-correct | **Effort:** substantial | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/teachers, https://www.myyogaclasses.fit/pricing

**Evidence.** Live DB aggregate over the 3 active teachers (all Asia/Kolkata). Union of availability is IST 05:00 to 23:00, seven days a week. Slot density by IST window (count = slots per week): 05:00-06:00 = 14, 06:00-07:00 = 7, 07:00-08:00 = 14, 08:00-09:00 = 9, 09:00-10:00 = 9, 10:00-11:00 = 8, 11:00-12:00 = 6, 12:00-13:00 = 7, then a dense block 13:00-19:00 = 14 each, then 19:00-23:00 = 7 each (a single teacher). Computed overlaps against that window (September, northern DST on): UAE 15.5 usable hours in a 06:00-22:00 civil day, Singapore 14.2, EU Central 13.5, UK 12.5, Australia Sydney 12.2, US East 10.0, US Pacific 10.0. But the dense 13:00-19:00 IST block maps to: UK 08:30-14:30, EU Central 09:30-15:30, UAE 11:30-17:30, Singapore 15:30-21:30, US East 03:30-09:30, US Pacific 00:30-06:30. UK prime evening (18:00-21:00 BST) equals IST 22:30-01:30, of which only 22:00-23:00 IST exists, and that is one teacher. US Pacific prime evening (17:00-21:00 PDT) equals IST 05:30-09:30, served by 7 to 14 slots and never more than two teachers.

**Recommendation.** TITLE (corrected): Teacher supply ends at 23:00 IST, which leaves the UK with zero bookable evening slots. US evening is already well served and should be the first international page built.

EVIDENCE (corrected): Live aggregate over the 3 active teachers (all Asia/Kolkata), 186 availability rows, no slot overrides, all 60-minute slots. Union IST 05:00-23:00, seven days a week. Hourly density per week: 05:00=14, 06:00=7, 07:00=14, 08:00=9, 09:00=9, 10:00=8, 11:00=6, 12:00=7, 13:00-19:00=14 each, 19:00-23:00=7 each (19:00-21:00 Vaishnavi alone, 21:00-23:00 Sangeeta alone). Critically, every window starts on the hour IST and IST is UTC+5:30, so every slot start lands at :30 past the hour in every target market, in both DST and standard time. Prime-evening (17:00-21:00 local) slot starts by market: US Pacific 17:30/18:30/19:30/20:30 PDT = 39 slots per week; US Eastern 19:30/20:30 EDT = 21 per week; EU Central 17:30/18:30 CEST = 14 per week, one teacher; UK 17:30 BST only, 7 per week, one teacher, and nothing at or after 18:00. UK is the single genuinely starved Western evening market. Usable hours inside a 06:00-22:00 civil day: UAE 15.5, Singapore 14.5, EU Central 13.5, UK 12.5, Sydney 12.5 (AEST), US East 10.0, US Pacific 10.0. Note also that generateSlots (lib/booking/slots.ts) only expands 7 days forward, so the bookable horizon is one week.

RECOMMENDATION (corrected), in priority order:

(1) Ship a static multi-zone availability table on the three existing /teachers/[slug] pages, which are already indexed and currently publish zero schedule information despite the footer promising "Book a session in your local time." Render it server-side with the anon Supabase client reading teacher_availability (public-read RLS, so no cookies() call and ISR in the (marketing) group is unaffected), as a fixed crawlable table with columns IST, GST, BST, CET, ET, PT. Static columns keep it prerenderable and keyword-rich; do not gate it behind client-side timezone detection. This is the highest-value move because it is shippable now against pages that already exist and already rank.

(2) Build the US page first, not the UK one, and build it around evening. Target "evening yoga from India" and "1:1 yoga 8pm ET", because 19:30 and 20:30 Eastern and 17:30 through 20:30 Pacific are real, bookable, and currently invisible to search. Always write the :30 times. Never publish "6am Eastern" or any on-the-hour local time: no such slot can exist.

(3) For a UK or EU page, sell the morning and midday block honestly. UK slot starts run 06:30 through 14:30 BST (from IST 11:00-19:00), EU Central 07:30 through 15:30 CEST. Frame it as "Morning and lunchtime 1:1 yoga, 07:30 to 14:30 UK time." Do not target UK evening keywords until supply exists.

(4) Recruiting IST 23:00-02:00 is the supply fix for the UK gap (it yields UK 18:30-21:30), but it is an ops action, not an SEO one, and it should not block items 1-3. Drop the claim that it also unlocks US Pacific prime: IST 23:00-02:00 is PDT 10:30-13:30, which is a workday lunch hour, not the evening the finding said was starved.

Drop /pricing from the locations list. Correct locations are the three /teachers/[slug] URLs and /teachers.

### [MEDIUM] Copy on the live site that reads India-only or UAE-only to a Western searcher

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** https://www.myyogaclasses.fit/pricing, https://www.myyogaclasses.fit/reviews, /Users/shalomp/YOGA_WEBSITE/components/marketing/PricingTeaser.tsx, /Users/shalomp/YOGA_WEBSITE/lib/data/landing.ts

**Evidence.** Quoted verbatim from live HTML. (1) /pricing: "Prices shown in INR. One-time payment, no subscription. Book from anywhere in the world." The second sentence contradicts the first for a US reader. (2) /pricing meta description: "Honest yoga pricing in AED and INR. One-time session packs, no subscription." This is the snippet a US or UK searcher sees in the SERP, and it names two currencies neither of them uses. (3) Testimonials on / , /pricing and /reviews: "Emma R. Dubai, AE", "James P. Abu Dhabi, AE", "Fatima H. Abu Dhabi, AE", "Noor S. Sharjah, AE", "Mohammed A. Dubai, AE", "Priya N. Bengaluru, IN". Six of six are Gulf or India. (4) /legal/terms: "governed by the laws of the United Arab Emirates (Emirate of Dubai)". (5) /legal/terms: "Prices are displayed inclusive of any applicable taxes (such as UAE VAT or India GST)." (6) /legal/refund: "operated from India with payments settled in INR and AED." Working in the site's favour, and worth preserving: the footer reads "© 2026 My Yoga Classes. Teachers in India · Students everywhere", and /legal/privacy opens with "an online platform that connects students anywhere in the world with yoga teachers based in India".

**Recommendation.** The /pricing meta description is in code (app/(marketing)/pricing/page.tsx) and is the highest-value single string to change, because it is what a Western searcher reads before clicking. Replace with: "Live 1:1 online yoga with certified teachers in India. Prepaid 60-minute sessions, priced in your local currency. No subscription." Note this becomes true only once USD/GBP/EUR rows exist, so ship it with the pricing change, not before. The "Prices shown in INR." string at components/marketing/PricingTeaser.tsx:411 is already dynamic (`Prices shown in {displayCurrency}`) and resolves itself the moment the currencies are priced. Testimonial locations are editable in lib/data/landing.ts:274-281 because the reviews table is empty. The legal strings are covered in the legal finding above. Do not touch the hero headline or subhead expecting a live change: those come from admin_settings (`landing.hero_headline`, `landing.hero_subhead`) and must be edited at /admin/settings.

### [MEDIUM] The Gulf NRI diaspora outside the UAE has the best timezone fit of any segment and no currency support at all

- **Verdict:** unverified | **Effort:** moderate | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/geo/region.ts, /Users/shalomp/YOGA_WEBSITE/supabase/migrations/0036_international_currencies.sql

**Evidence.** SUPPORTED_CURRENCIES in lib/geo/region.ts is `["INR", "AED", "USD", "GBP", "EUR"]` and CURRENCY_BY_COUNTRY maps only IN, AE, US, GB and the 20 eurozone members. Saudi Arabia (SAR), Qatar (QAR), Kuwait (KWD), Oman (OMR) and Bahrain (BHD) are absent from the enum entirely, so under resolveRegion() a Riyadh or Doha visitor falls to INTERNATIONAL_CURRENCY = "USD", which effectiveCurrency() then downgrades to INR. These markets sit at UTC+3 and UTC+4, giving them the same 15-plus hour overlap the UAE enjoys, and they hold several million Indian expatriates.

**Recommendation.** Two options, and the cheap one is probably right. Cheap: leave the currency enum alone and simply price in USD, which is the de facto secondary currency across the Gulf and which SAR, QAR, BHD and OMR are all pegged or near-pegged to. That gets these visitors a sane price the moment the USD rows exist, with zero code change. More thorough: add SAR and QAR to SUPPORTED_CURRENCIES, CURRENCY_BY_COUNTRY and LOCALE_BY_CURRENCY in lib/geo/region.ts, extend the plan_prices CHECK constraint in a new migration (0039), and price them. Note that adding to the enum is inert until priced, by design, so the code change is safe to ship ahead of the commercial decision. Either way, add Asia/Riyadh, Asia/Qatar, Asia/Kuwait, Asia/Bahrain and Asia/Muscat to CURRENCY_BY_TIMEZONE so the off-platform fallback is also correct.

### [MEDIUM] Market prioritization: ranked by demand, willingness to pay, English fit, competitive density and computed IST overlap

- **Verdict:** unverified | **Effort:** substantial | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/pricing, https://www.myyogaclasses.fit/teachers, /Users/shalomp/YOGA_WEBSITE/lib/geo/region.ts

**Evidence.** Ranking is built on the overlap windows computed from live teacher_availability (IST 05:00-23:00, seven days, dense 13:00-19:00) crossed with observed competitive and pricing data. Overlap hours within a 06:00-22:00 civil day: UAE 15.5, Singapore 14.2, EU Central 13.5, UK 12.5, Australia 12.2, US East 10.0, US Pacific 10.0 (September); in January UK drops to 11.5 and EU to 12.5 as northern DST ends. Competitive density evidence: myyogateacher.com runs a 613-URL sitemap and prices US private sessions at roughly $89 to $459 per month, and has 167 tracked competitors including Habuild, Shvasa and Yog4Lyf, with ONE OM ONE and Mywowfit explicitly running the same arbitrage model (English-speaking teachers in lower-cost regions serving higher-cost markets). Currency readiness: AED and INR priced, USD/GBP/EUR not.

**Recommendation.** Rank and sequence as follows. (1) UAE: best overlap at 15.5h with the dense block landing 11:30-17:30 local, AED already priced, legal and tax framing already fits, and roughly a third of the population is Indian-origin. Smallest absolute search volume but the only market that is commercially ready today. Harvest now. (2) UK: 12.5h overlap, dense block at 08:30-14:30 which suits the work-from-home and lunchtime segment, 1.9M Indian-origin population, native English, London private yoga at £50-80 per session. GBP unpriced, so this is the single largest unlocked upside. (3) Singapore: best effort-to-return ratio on the board. The dense IST block lands at 15:30-21:30 SGT, which is prime evening, giving it the best time-fit-to-demand-hours match of any market. Highest per-capita willingness to pay in Asia, English official, very low competitive density, offset by a small 5.9M population. (4) US: biggest ceiling and highest rates ($60-120/hr in-person private), 4.8M Indian-American diaspora, but structurally the worst fit because the dense block lands at 03:30 ET and 00:30 PT. US East is workable via the genuine 6am-yoga habit; US Pacific is not serviceable at scale until IST late-evening supply exists. Also the most contested market by a wide margin. (5) Canada: free rider on US content since Toronto is ET and Vancouver is PT, with 1.86M Indian-origin, the fastest-growing diaspora, and materially lower competitive density than the US. (6) Australia: 11.2 to 12.2h overlap with the dense block at 17:30-23:30 AEST, so IST afternoon equals Australian evening, which works. Roughly 976k Indian-born. Deprioritised mainly because the repo's legacy AU artifacts need cleaning first. (7) EU non-UK: the best raw overlap number at 13.5h, but English-only content competes poorly in Germany, France and Spain. Treat Ireland and the Netherlands as the viable sub-segment rather than the eurozone as a bloc. (8) India: already the default currency and trivially the best overlap, but lowest willingness to pay (₹900 per session is already the local market rate) and highest domestic competitive density. Sequence: price GBP and USD first, build the /poses hub and fix titles (which serve all markets at once), then ship a UK region page before a US one, because the UK gives you native English, a workable time window with existing supply, and a fraction of the US competitive density.

### [MEDIUM] The NRI diaspora is a genuinely underserved, high-converting segment with search behavior the current site is accidentally well-equipped for

- **Verdict:** unverified | **Effort:** substantial | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/, /Users/shalomp/YOGA_WEBSITE/app/layout.tsx, https://www.myyogaclasses.fit/teachers

**Evidence.** Competitors are already segmenting explicitly by diaspora country list: indiannatya.com publishes a page titled "Best Online Yoga Classes from India for Kids and Ladies - UAE - US - UK - CA - IN", and fitsri.com markets "convenient timings for US/UK/Canada/Australia/India/UAE students". More tellingly, zugafitness.in runs a URL at /Blog/live-online-yoga-class-london-timezone.html, which is direct evidence that timezone-qualified queries are a live search-behavior hook in this niche and that at least one competitor has built a page for it. Reporting on the UK diaspora notes expats seek "more than just physical workouts" and "a genuine connection to their roots", which is a materially different motivation from the Western wellness searcher. Against that, this site already owns the right asset: 107 Sanskrit-named poses rendering live across the nine condition pages (Bhujangasana, Tadasana, Vajrasana, Mandukasana, Paschimottanasana, Matsyendrasana, Shavasana and so on), plus real Indian teachers with doctor titles.

**Recommendation.** Yes, this is the highest-conversion segment available to you, and the reason is structural rather than sentimental: the diaspora searcher is not comparing you against a $25 American studio class, they are comparing you against no authentic option at all, which collapses the price objection that otherwise dominates Western markets. Three concrete plays. (1) Own the Sanskrit vocabulary via the /poses hub described above: a Western-native competitor will not build 107 pages on Bhujangasana, and a diaspora searcher types exactly that. (2) Build timezone-qualified pages, which is a proven pattern in this niche and one nobody has built well: /online-yoga-classes-uk with a real BST/GMT availability table, same for /online-yoga-classes-usa (lead with 6am Eastern), /online-yoga-classes-uae and /online-yoga-classes-singapore. These are the pages that would then require reciprocal hreflang plus x-default. (3) Lean the teacher pages into provenance, which is your actual differentiator: the three active teachers carry doctor titles (dr-vaishnavi-mayya, dr-sangeeta, dr-hima-bindu) and that is exactly the credential a diaspora parent booking kids-yoga or a prenatal student is screening for. Surface qualifications, lineage and languages spoken in the Person JSON-LD and in visible copy. If any teacher speaks Hindi, Tamil, Telugu, Kannada or Malayalam, say so: language-matched search is a distinctive diaspora behavior the site currently gives no signal for, and `knowsLanguage: ["en"]` in the Organization JSON-LD actively says the opposite.

### [LOW] Live legal pages publicly state they have not been reviewed by a lawyer, and set UAE/Dubai governing law with no GDPR, UK GDPR or CCPA coverage

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/legal/privacy, https://www.myyogaclasses.fit/legal/terms, https://www.myyogaclasses.fit/legal/refund

**Evidence.** Extracted from live HTML. /legal/privacy: "This is a good-faith draft for a service that accepts students worldwide. It has not yet been reviewed by a qualified lawyer in any relevant jurisdiction and must be verified before launch." The same disclaimer appears on /legal/refund. /legal/privacy frames compliance solely as "the UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021) and its implementing regulations, India's Digital Personal Data Protection Act 2023 (DPDP Act)" and the regulator list names only the UAE Data Office, DIFC/ADGM commissioners and the Data Protection Board of India, then "Elsewhere: your local data-protection or privacy regulator." No mention of GDPR, UK GDPR, the ICO, CCPA/CPRA or PIPEDA anywhere. /legal/terms: "These Terms are governed by the laws of the United Arab Emirates (Emirate of Dubai), and disputes arising under them are subject to the non-exclusive jurisdiction of the courts of Dubai." /legal/terms on tax: "Prices are displayed inclusive of any applicable taxes (such as UAE VAT or India GST)." /legal/refund: "operated from India with payments settled in INR and AED."

**Recommendation.** CORRECTED FINDING (severity: low as SEO, high as conversion/legal exposure; dimension should be trust/compliance, not international)

Title: Three live legal pages carry a "not yet reviewed by a qualified lawyer, must be verified before launch" banner, and /legal/privacy names no GDPR, UK GDPR or CCPA route despite worldwide sales.

Corrected evidence:
- The banner is on ALL THREE pages, not two. /legal/terms and /legal/refund verbatim: "Pending legal review. This is a good-faith draft for a service that accepts students worldwide, operated from India with payments settled in INR and AED. It has not yet been reviewed by a qualified lawyer in any relevant jurisdiction and must be verified before launch." /legal/privacy uses a different wording: "This policy is a good-faith draft written for a service that accepts students worldwide. It has not yet been reviewed by a qualified lawyer in any relevant jurisdiction and must be verified before launch." Sources: app/(marketing)/legal/privacy/page.tsx:20-23, terms/page.tsx:22-26, refund/page.tsx:19-23.
- No GDPR / UK GDPR / ICO / CCPA / CPRA / PIPEDA string exists anywhere in app/, components/ or lib/ (verified by grep).
- The banner does NOT reach search results: all three pages set an explicit meta description that omits it, so Google will render the curated description, not the warning.

Corrected severity reasoning: there is no measurable ranking or indexing effect. These are 3 of 23 indexable URLs, reachable only from the footer and the login page, with no search demand. The real cost is (a) on-page conversion, since a buyer who clicks "Refund policy" from the footer before a purchase reads that the policy is unverified, and (b) regulatory exposure under GDPR Art.3(2), which applies because the site explicitly offers services to "students anywhere in the world." Treat it as a launch-blocker for trust and legal, not as an SEO ranking issue.

Corrected recommendation (ordered, and note the finding's Terms fix is mostly already shipped):
1. Get the actual legal review first, then delete the three banner divs. Do not delete the banner while the pages remain unreviewed. If review is not imminent, replace the banner with a neutral "Last reviewed: <date>" line rather than a self-disqualifying warning, and fill in the three "registration / trade-licence details to be inserted" placeholders that are also live on privacy and terms.
2. /legal/privacy: add a GDPR / UK GDPR section (lawful basis per purpose, Art.15-21 rights, the DSAR route, the ICO and the lead EU supervisory authority as named complaint routes, and the Art.46 transfer mechanism, since the existing sec.5 only cites UAE PDPL and DPDP safeguards for a transfer chain that runs to India and the USA). Add a short CCPA/CPRA notice covering the do-not-sell statement, which sec.4 already makes ("We do not sell your personal information to third parties") but does not label.
3. /legal/terms sec.12: do NOT add a new carve-out sentence, one already exists. Edit the existing one. Current text: "This does not deprive you of the protection of mandatory consumer-protection law in your country of residence: customers in India retain the right to pursue remedies under Indian consumer law before the appropriate Indian forum." Change the tail to generalise the forum right, for example: "customers in India, the EU, the UK and any other jurisdiction whose law grants non-waivable consumer rights retain the right to pursue remedies under their own consumer law before their local courts." No em-dashes, consistent with the project rule.
4. /legal/terms sec.5: change "(such as UAE VAT or India GST)" to "(for example UAE VAT, India GST, UK VAT or EU VAT)". Note this creates a factual exposure to check with the accountant, since UK/EU VAT on B2C digital-adjacent supplies is not actually being collected.
5. Optional and genuinely SEO-relevant: none of this needs a schema, CSP or ISR change. These are static server-rendered pages in the (marketing) group, so the edits ship without touching cookies(), the CSP allow-list or admin_settings.

### [LOW] hreflang is correctly absent today, but og:locale is invalid and the moment region pages ship, hreflang becomes mandatory or the new pages will be deduplicated away

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/layout.tsx, https://www.myyogaclasses.fit/

**Evidence.** Verified across four live pages (/ , /pricing, /faq, /classes/diabetes): zero `<link rel="alternate" hreflang=...>` elements, `<html lang="en">`, and `<meta property="og:locale" content="en"/>`. The og:locale value comes from app/layout.tsx `openGraph: { ... locale: "en" }`. The Open Graph spec requires `language_TERRITORY` (an ISO 639-1 code, underscore, an ISO 3166-1 alpha-2 code), so bare "en" is invalid and Facebook/LinkedIn fall back to en_US silently.

**Recommendation.** Retitle to: "og:locale is an invalid bare `en` (cosmetic, no search impact); hreflang is correctly absent and should stay absent until region pages are genuinely differentiable." Severity: low.

Corrected evidence framing: the hreflang absence is not a defect, it is correct. All 23 sitemap URLs are one language with one URL per piece of content, so a self-referential-only hreflang set would be pure overhead. `<html lang="en">` is valid and is the signal Google actually consumes. The single real defect is `app/layout.tsx:75`.

Corrected fix (the whole of it):
In /Users/shalomp/YOGA_WEBSITE/app/layout.tsx:75 change `locale: "en",` to `locale: "en_IN",`. Prefer en_IN over the finding's en_US: the teachers are in India, the only two live currencies are INR and AED, and /api/region already returns locale "en-IN". Do not add `alternateLocale` at all. That field is for locales you actually publish; listing en_GB, en_AE, en_SG, en_CA when no such pages exist adds five false claims with zero SEO value, since Google ignores og:locale entirely.

Corrected forward-looking guidance (this is advice, not a finding, and should be logged separately rather than counted as a site defect):
Ordering matters and the finding has it backwards. Differentiation is the prerequisite; hreflang is the follow-on. Do not build region pages at all until USD/GBP/EUR have plan_prices rows for every active plan, because until then effectiveCurrency() downgrades to INR and a "USA" page would quote rupees, which is both a thin duplicate and a conversion failure. Once a currency is genuinely priced, differentiate on local price, an IST-to-local timezone table, and local testimonials, then add the reciprocal hreflang set with absolute URLs and x-default pointing at `/`. In Next.js 16 that is `alternates: { languages: { ... } }` inside generateMetadata, which is static and safe for the ISR (marketing) group. Correct the rationale when you write this up: hreflang will not rescue near-duplicates, it only assigns an already-distinct page to a country. The no-geo-redirect warning in the original is sound and worth keeping.

### [LOW] The public GitHub repo tells Google the business serves "AU customers" and takes PayPal, and links to a dead Vercel preview instead of the site

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** medium
- **Locations:** https://github.com/Shalom-P/yoga-website

**Evidence.** github.com/Shalom-P/yoga-website returns HTTP 200 and the GitHub API confirms `private: False`, `description: 'Conversion-first yoga studio web app — Next.js 16 + Supabase + PayPal + Google Meet. AU customers, IN teachers.'`, `homepage: 'https://yoga-website-seven-mocha.vercel.app'`. Three separate mis-signals in one indexable page: an Australia-only service-area claim, a payment rail (PayPal) retired in PRs #13 to #17, and a homepage link that points at a Vercel preview URL rather than https://www.myyogaclasses.fit.

**Recommendation.** Retitle and reframe: "Public GitHub repo is the #1 result for the brand-domain query, with a stale snippet naming a retired payment rail and the wrong geography."

Reclassify from international to brand-SERP hygiene, severity low. Reproduced facts: repo is public, description names PayPal (retired in PRs #13 to #17) and "AU customers", homepage field points at yoga-website-seven-mocha.vercel.app which 404s with x-vercel-error: DEPLOYMENT_NOT_FOUND, and the repo root is crawlable (github.com/robots.txt does not disallow it). A search for "myyogaclasses.fit" returns this repo first; the live site does not appear.

Drop the claim that this affects the site's geo-targeting. It does not. A third-party github.com page cannot geo-target myyogaclasses.fit; that comes from hreflang, ccTLD, GSC international targeting, and on-site signals. The repo is not outranking the site either, since the site is not indexed for that query at all. Real cost is limited to a wrong, stale snippet shown to people who already searched the brand, plus leakage of pricing logic, RLS policies and migration history. Fix it, but do not queue it above the 23-URL content gap.

Fix the whole page, not just the metadata. The finding's recommendation leaves the larger half wrong:
1. Description to "Live 1:1 online yoga platform. Students worldwide, teachers in India." (no em-dash, no free-trial wording, keeps 1:1).
2. Homepage field to https://www.myyogaclasses.fit.
3. README.md:3, currently "**UAE + India customers, Indian teachers**, live on Google Meet. Multi-currency billing (UAE→AED, India→INR)." to "Students worldwide, teachers in India, live 1:1 sessions. Multi-currency billing, INR base with additional currencies priced per plan."
4. README.md:19, currently "(handles AU customers and IN teachers)" to "(handles students worldwide and teachers in India)".
5. README.md:20, reconcile the PayPal/Razorpay contradiction.

Going private is a safe alternative and I verified the one risk: GitHub Pages is not in use (API has_pages: false, shalom-p.github.io/yoga-website/ returns 404) and the live domain is served by Vercel, so the vestigial CNAME file breaks nothing. But private is a heavier action sold as "fastest"; the metadata plus README edit takes about five minutes and is the better default unless the owner independently wants the architecture leakage closed, which is worth its own non-SEO ticket.

The genuinely high-severity observation surfaced while checking this one is separate and should be filed on its own: site:myyogaclasses.fit returned zero indexed pages, which combined with the established finding that no Google Search Console verification exists in the codebase suggests the site may have little or no index coverage. That, not the repo, is the international blocker.

### [LOW] The .fit gTLD is geographically neutral and carries no ranking penalty, but the www/apex handling and brand-query landscape are where the domain actually costs you

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** low
- **Locations:** https://www.myyogaclasses.fit/, https://myyogaclasses.fit/

**Evidence.** .fit is a generic top-level domain (delegated 2015), not a country-code TLD, so Google treats it as global with no implied country association. This is confirmed by observed behaviour: the site's Organization JSON-LD declares `areaServed: "Worldwide"` and nothing in the live response carries a country signal from the TLD. The real domain-level defects found are the 307 apex redirect (separate finding) and the fact that the top brand-adjacent result is a GitHub repo saying "AU customers" (separate finding).

**Recommendation.** Keep .fit. Do not migrate to .com for SEO reasons: a gTLD migration would cost you every existing signal for a benefit Google does not grant. The genuine downsides are non-algorithmic and worth mitigating rather than solving: (1) lower type-in familiarity, so always render the full https://www.myyogaclasses.fit in citations, email signatures and directory listings rather than a bare brand name; (2) type-in leakage, so if myyogaclasses.com is available and cheap, buy it purely as a 308 redirect to the www host, never as a second live site; (3) some legacy corporate mail filters treat newer gTLDs more harshly, which matters for your Resend transactional deliverability more than for rankings. Also note the latent inconsistency: admin_settings key `support.email` still holds `hello@myyogaclasses.com.au` even though all 80 rendered occurrences on the live site correctly say `hello@myyogaclasses.fit`. Fix the stored value before something starts reading it.

### [LOW] CLAUDE.md documents a phone-validation country restriction that no longer exists in the code

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** low
- **Locations:** /Users/shalomp/YOGA_WEBSITE/CLAUDE.md, /Users/shalomp/YOGA_WEBSITE/lib/validation/phone.ts

**Evidence.** CLAUDE.md states: "`lib/validation/phone.ts` restricts country codes to `[\"AE\",\"IN\"]`." The actual file contains no such allow-list. Its header comment reads: "Customers are welcome from any country, so <PhoneField> offers every calling code rather than an allow-list. There is deliberately no default country: for a worldwide audience any pre-selection is wrong for most people." `isValidPhone` and `toE164` both take an optional `country` argument and otherwise defer to libphonenumber's global validation. This means the audit brief's geo-signal concern about phone validation is already resolved in code; only the documentation is stale.

**Recommendation.** Update the Validation bullet in CLAUDE.md to match the code, since the stale line will keep sending future contributors and audits down a false path. Replace with: "`lib/validation/phone.ts` accepts any country calling code with no default country, matching the worldwide audience. `app/api/contact/route.ts` uses a zero-length `company` honeypot and returns a fake `ok: true` when tripped." No code change needed. One genuine follow-on: the file's docstring says "Phone is a required contact field (collected during sign-up)" while CLAUDE.md says phone is optional, so confirm which is true and reconcile, because a required phone number is a measurable signup-conversion drag in US and UK markets where it reads as a telemarketing signal.

---

## eeat-ymyl (14)

### [CRITICAL] Review-count fabrication is far larger than the first-pass audit found: 1,200+ claimed sitewide, 410 claimed across two teacher pages, 6 reviews actually published

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/, https://www.myyogaclasses.fit/reviews, https://www.myyogaclasses.fit/teachers, https://www.myyogaclasses.fit/teachers/dr-sangeeta, https://www.myyogaclasses.fit/teachers/dr-vaishnavi-mayya, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/page.tsx:44, /Users/shalomp/YOGA_WEBSITE/lib/db/schema.ts:89

**Evidence.** Homepage RSC payload contains `\"4.9\",\"trustCount\":\"1,200+ reviews\"`. /teachers/dr-sangeeta renders "5.0 · 312 reviews" and the homepage payload carries `\"rating_count\":312` with `rating_avg` 4.95 for that teacher. /teachers/dr-vaishnavi-mayya renders "4.8 · 98 reviews". /teachers renders "★ 4.8" and "★ 5.0" with no count at all. https://www.myyogaclasses.fit/reviews renders SIX review cards (grep for ★★★★★ = 6): Emma R., James P., Fatima H., Noor S., Mohammed A., Priya N. The first-pass audit said 12; it is 6. Schema default is lib/db/schema.ts:89 `rating_avg: numeric(...).default("5.0")`, i.e. a 5.0 is the DB default, not an earned score.

**Recommendation.** CORRECTED FINDING
Title: The site publishes zero real reviews. Six invented testimonials render as customer reviews on / and /reviews, and 1,610 review-equivalents are claimed sitewide (1,200+ homepage, 312 + 98 on teacher pages).

Evidence: The live `reviews` table returns `[]` to the anon key, which is the exact client getFeaturedReviews (lib/data/landing.ts:375-388) uses, so it falls through to MOCK_REVIEWS (lib/data/landing.ts:274-281). All six live bodies and locations on /reviews byte-match that array. They are not seed data (supabase/seed.sql:112-114 has different text). Homepage trust bar renders "4.9 · 1,200+ reviews" from a real admin_settings row (get_admin_settings RPC returns `{"landing.trust_count":"1,200+ reviews","landing.trust_rating":"4.9"}`). Teacher rows: dr-sangeeta 4.95/312, dr-vaishnavi-mayya 4.85/98, dr-hima-bindu 5.00/0. The 5.00 on a zero-count teacher is the schema default at lib/db/schema.ts:89, proving these numbers are not derived from anything.

CORRECTED RECOMMENDATION

(1) Kill the fabricated testimonials first. This is the actual violation. Either delete the MOCK_REVIEWS fallback for the /reviews route so an empty table renders an honest empty state, or replace the six entries with reviews you have actually collected and can produce on request. Do not leave invented names in a fallback path that ships to production. If you keep a fallback for the zero-env preview story described in CLAUDE.md, gate it on `!isSupabaseConfigured` only, and make getFeaturedReviews return `[]` when Supabase IS configured and the query comes back empty. That preserves the documented preview behavior and stops the live site from inventing customers.

(2) Fix the trust bar in BOTH places, because either one alone is a no-op. Blanking the admin setting does not work: lib/data/landing.ts:429-430 treats an empty string as unset and falls back, and the fallback at app/(marketing)/page.tsx:43-44 is the identical "4.9" / "1,200+ reviews". So: set the admin_settings values at /admin/settings to something you can evidence, AND change the code defaults at app/(marketing)/page.tsx:43-44. If you want a non-numeric proof point instead, change the Hero props (components/marketing/Hero.tsx:13-14) to optional and render a claim you can stand behind. Two that are true and need no reviews: "60-minute 1:1 sessions, live online" or "Shown in your local time, wherever you are." No em-dashes, no free-trial wording, both consistent with the existing "1:1" framing.

(3) Teacher ratings: no new code needed. A `rating_count > 0` guard already exists at components/marketing/TeacherGrid.tsx:93 and app/(marketing)/teachers/[slug]/page.tsx:89, which is why dr-hima-bindu renders no star. Set `rating_count = 0` for dr-sangeeta and dr-vaishnavi-mayya and the star and count disappear from /teachers, /teachers/[slug], the homepage TeacherGrid, and app/(dashboard)/dashboard/book/page.tsx:47 in one change. Separately, drop the `.default("5.0")` on `rating_avg` in a new hand-written migration so a new teacher does not inherit a 5.0 they have not earned. Restore real numbers only once a real review row exists per teacher.

(4) Keep the existing decision NOT to add AggregateRating JSON-LD. Verified: zero `aggregateRating` occurrences across /, /teachers, /teachers/dr-sangeeta and /reviews, and the comment at lib/seo/structuredData.ts:34-35 documents why. Adding it on top of unverifiable counts would convert an on-page problem into a structured-data manual action.

Regulatory framing, corrected: 16 CFR 465.2 (effective 21 Oct 2024) prohibits reviews purporting to be by a person who does not exist, which is exactly what the six MOCK_REVIEWS names are, and 465.6 covers misrepresenting review counts. In the UK the sharper instrument is the DMCC Act 2024 (consumer provisions in force April 2025), which makes publishing fake reviews a banned practice, alongside CAP Code 3.45/3.47 on testimonials. None of this is an SEO ranking penalty today; it is legal exposure plus a conversion leak, since a US or UK buyer who clicks "1,200+ reviews" lands on six cards.

Severity stays critical, but for E-E-A-T and legal reasons on a health-condition site, not for ranking impact.

### [HIGH] All nine condition pages ship a fabricated testimonial whose visible attribution reads "Placeholder, swap for a real review"

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/classes/diabetes, https://www.myyogaclasses.fit/classes/prenatal, https://www.myyogaclasses.fit/classes/hypertension, https://www.myyogaclasses.fit/classes/hormonal-health, https://www.myyogaclasses.fit/classes/pain-relief, https://www.myyogaclasses.fit/classes/mental-health, https://www.myyogaclasses.fit/classes/weight-loss, https://www.myyogaclasses.fit/classes/geriatric

**Evidence.** Live HTML of https://www.myyogaclasses.fit/classes/diabetes renders: "I started after my type 2 diagnosis, nervous about getting it wrong. My teacher built everything around me... Placeholder, swap for a real review. Member · practising for 5 months". Same on /classes/prenatal ("Placeholder. Swap for a real review. Member · second trimester") and /classes/hypertension ("Placeholder: swap for a real review. Member · practising for 4 months"). Source: lib/data/condition-pages/diabetes.json:152 "testimonialWho": "<strong>Placeholder, swap for a real review.</strong> Member · practising for 5 months" plus the identical field in geriatric.json:168, hypertension.json:137, kids-yoga.json:163, hormonal-health.json:153, mental-health.json:157, prenatal.json:158, weight-loss.json:157, pain-relief.json:162. All 9 of 9 files.

**Recommendation.** CORRECTED FINDING: All nine condition pages ship a fabricated testimonial whose visible attribution admits it is fake. Reproduced live on all 9 URLs and in all 9 JSON files at the cited lines. This is 9 of 23 sitemap URLs (39% of the indexable surface) and it sits on the site's only real long-form content (~930-980 words each), on YMYL health topics. It is NOT in structured data (only Organization and Course JSON-LD are emitted), so there is no ranking penalty, no rich-result exposure and no manual action surface. The cost is human: every prospect who reaches a condition page reads the site admitting its social proof is invented, and it is exactly the kind of line an AI Overview or LLM summarizer will quote back. 16 CFR 465.2 (effective 21 Oct 2024, up to ~$53,088 per KNOWING violation) and CAP Code 3.45/12.1 make it a live legal exposure once it is knowingly left up. Severity high, not critical, because ranking impact is zero. Fix it first anyway because it is 15 minutes, not because it is the biggest lever.

CORRECTED FIX (ship today, ~15 min, delete rather than hide):
1. lib/data/condition-pages.ts:52-54 - make both fields optional: `testimonialQuote?: string;` and `testimonialWho?: string;`
2. Delete the `testimonialQuote` and `testimonialWho` keys from all nine files in lib/data/condition-pages/: diabetes.json:151-152, hypertension.json:136-137, geriatric.json:167-168, hormonal-health.json:152-153, prenatal.json:157-158, kids-yoga.json:162-163, mental-health.json:156-157, pain-relief.json:161-162, weight-loss.json:156-157. Match on the JSON KEY names, not on the placeholder text: the three punctuation variants and the missing <strong> in mental-health.json:157 will defeat a text-based replace.
3. components/marketing/condition/ConditionLanding.tsx:231-239 - gate section 8 on `{d.testimonialQuote && d.testimonialWho && ( ... )}`. The TestimonialWho helper at line 55 can stay as is.
4. `npm run typecheck` (strict is on) will then surface any other consumer. No migration, no DB change, no CSP entry, no cookies(), so ISR in the (marketing) group is untouched. revalidate = 300 on the route means a redeploy propagates within 5 min.
This removes the invented quotes from the repo entirely instead of leaving them behind a `.includes('placeholder')` test.

WHEN REAL REVIEWS EXIST: source them from the existing `reviews` table (already DB-driven and admin-managed) keyed by condition slug, each with a first name, a market and the condition, so one governance path covers /reviews and the condition pages. Do not add Review or AggregateRating JSON-LD to these pages until the reviews are real, consented and verifiable, since that is the step that converts a trust problem into a structured-data spam problem.

RELATED, SAME EXPOSURE CLASS, DIFFERENT FIX PATH: the homepage trust bar "4.9 · 1,200+ reviews" against 12 rendered reviews is the same 16 CFR 465 issue. I confirmed /reviews itself contains no "Placeholder" string and no "4.9" claim, so that number lives in admin_settings and must be corrected at /admin/settings, not in code.

### [HIGH] No verifiable business identity anywhere: no postal address, no registration number, no phone, no named founder, and profanity on /about

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/about, https://www.myyogaclasses.fit/contact, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/about/page.tsx, /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts

**Evidence.** /about is 246 words total and opens "Old practice. New room. No bullsh*t." It names no founder, no legal entity, no country of incorporation, no year founded. /contact is 111 words and contains only a form and "Reach us directly at hello@myyogaclasses.fit". No address, no phone number, no company registration on either page or in the footer, which reads only "© 2026 My Yoga Classes. Teachers in India · Students everywhere". The Organization JSON-LD has `contactPoint` with an email and nothing else: no `address`, no `legalName`, no `foundingDate`, no `telephone`, no `taxID`.

**Recommendation.** Corrected finding: The operating entity is anonymous to buyers, while the practitioners are not. /teachers does name three real credentialed teachers (Dr Vaishnavi Mayya, MD in Clinical Yoga & Naturopathy; Dr Sangeeta, Yoga and Naturopathy Doctor; Dr Hima Bindu, Medical Yogic Sciences, 8 years) and emits Person JSON-LD, so drop "nowhere" / "anywhere" framing. What is missing is entity-level identity: no legal name, no postal address, no phone, no named operator, no year founded on /about (246 words), /contact (111 words), the footer, the three legal pages, or the Organization JSON-LD (app/layout.tsx:85-105). The legal pages additionally self-declare as an unreviewed draft, which is its own trust liability.

Corrected recommendation:
1. Do not ask for a company or GST registration number. Every signal (personal-name SWIFT beneficiary in lib/payments/bankTransfer.ts, "operated from India" with no entity named in /legal/terms) points to a sole operator, not an incorporated company, and Indian GST registration is not mandatory below the services turnover threshold. Publish only what is true: the operator's legal name, the words "sole proprietor" or the company name if one exists, the operating city and country ("Operated from <city>, India"), and a GST/CIN number only if one has actually been issued. Naming the operator publicly costs nothing, since AED buyers are already shown that person's legal name at checkout.
2. Add a phone or WhatsApp number to /contact, or state plainly "Email only, we reply within 1 business day" so the absence reads as a policy rather than an omission. Razorpay merchant onboarding expects a contact page with address and contact details, so this is also a payments-compliance item, not only SEO.
3. Extend the Organization node in app/layout.tsx (NOT lib/seo/structuredData.ts) with legalName, foundingDate, and address as a PostalAddress with addressLocality and addressCountry "IN". Add telephone only if one is actually published on /contact. Keep aggregateRating off until the homepage "4.9 · 1,200+ reviews" claim is reconciled with the 12 reviews that /reviews renders.
4. On /about, add the operator's name with a photo, one paragraph of background, the founding year, and an explicit teacher-vetting paragraph (how the 200-hr Yoga Alliance certification is verified, who checks it). The page already asserts "Every teacher is a 200-hr Yoga Alliance certified professional" with zero evidence of how that is confirmed, which is the Experience signal being claimed but not shown.
5. Remove "No bullsh*t" at app/(marketing)/about/page.tsx:15. Frame this as brand and rater perception, not a ranking penalty. There is no Google profanity demotion for a non-adult site; the argument is that it undercuts the medical-credential positioning the /teachers page and the nine condition pages are built on.
6. Note also that pricing renders INR to non-Indian visitors, so correct "US and UK consumers" to: a US or UK buyer is charged in rupees by an unnamed party, which compounds the identity gap rather than being a separate issue.

### [MEDIUM] Zero authorship on 9 of 9 YMYL health pages: no byline, no medical reviewer, no publish date, no updated date, no author meta tag anywhere on the site

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/*.json, /Users/shalomp/YOGA_WEBSITE/components/marketing/condition/ConditionLanding.tsx, /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx:48

**Evidence.** Grep across the live HTML of /classes/diabetes, /classes/prenatal, /classes/hypertension, /teachers and /teachers/dr-sangeeta for (reviewed by|written by|last updated|dateModified|datePublished|medically) returns zero matches; the only "author" hits are the string `unauthorized` inside the Next.js RSC payload. `grep '<meta name="author"' *.html` returns NONE across all 10 fetched pages. The JSON-LD on /classes/diabetes is exactly two nodes, Organization and Course; there is no author, no reviewedBy, no dateModified. The condition JSON files have no author field at all: keys are ['slug','eyebrow','h1Before','h1Em','h1After','heroLead','empathyLabel','empathyText','helpsH2','helpsSubhead','levers','posesH2','posesSubhead','poseGroups','selectionNote','howH2','howSubhead','steps','sessionTitle','sessionChecklist','whoForTitle','whoForText','propsTitle','props','testimonialQuote','testimonialWho','faqH2','faqs','safetyTitle','safetyText','metaDescription'].

**Recommendation.** CORRECTED FINDING (severity: medium, not critical)

Title: The 9 condition pages carry no authorship, review or date signal, and no FAQPage or BreadcrumbList markup. Google emits only Organization + Course on these pages.

Evidence (all reproduced): zero matches for reviewed by / written by / last updated / dateModified / datePublished / medically across 14 live pages; no `<meta name="author">` anywhere; /classes/diabetes JSON-LD is exactly two nodes, Organization and Course; the only "author" substring is `unauthorized` x4 in the RSC payload; no author/reviewed/date field in any of the 9 JSON files or in ConditionLanding.tsx or structuredData.ts.

Corrected framing: this is a trust, rater-guideline and AI-citation gap, not a ranking lever. Author markup is not a direct ranking factor and MedicalWebPage yields no Google rich result. Do not sell it as the reason these pages do not rank; the 23-URL footprint and the nav-and-footer-only inbound linking are the load-bearing causes.

Corrected recommendation:

1. Establish the fact before writing the markup. Have the named teacher actually read and sign off each page. Only then attribute. Do not print "Medically reviewed by" for a review that has not happened, and do not invent credentials: use the exact headline the DB already stores, "MD in Clinical Yoga & Naturopathy" for Dr Vaishnavi Mayya, "Yoga and Naturopathy Doctor" for Dr Sangeeta, "Medical Yogic Sciences" for Dr Hima Bindu. Drop "BNYS" entirely, it exists nowhere on this site.

2. Add to the ConditionPage type and all 9 JSON files: `reviewerSlug` (string), `datePublished` (ISO), `dateReviewed` (ISO). Use 2026-06-22 as datePublished for all nine, that is commit 5c4950c, the real first publish. Set dateReviewed to the day the teacher actually signs off. One field, `reviewerSlug`, not separate author and reviewedBy, until there genuinely are two different people.

3. Render the block under the H1 in ConditionLanding.tsx, no em-dashes, wording such as: "Reviewed by Dr Vaishnavi Mayya, MD in Clinical Yoga & Naturopathy. Published 22 June 2026. Last reviewed 16 September 2026." Resolve the slug at render against the live active-teacher list rather than trusting the JSON string: pass the resolved teacher down from the server page (getTeacherBySlug is already imported in the teacher route and is ISR-safe, no cookies()), link the name to /teachers/[slug] when it resolves and fall back to unlinked plain text when it does not, so a deactivated teacher can never produce a byline pointing at a 404.

4. Structured data on app/(marketing)/classes/[slug]/page.tsx, in priority order:
   a. `faqPageJsonLd(rich.faqs)` and `breadcrumbJsonLd([{Home},{Classes},{<name>}])`. Both helpers already exist in lib/seo/structuredData.ts, both are one line each, and BreadcrumbList is a live Google SERP feature. This is the highest-value item on the page and the original finding missed it. Note FAQ rich results are now restricted to government and health-authority sites, so treat FAQPage as entity and AI-answer signal, not as a SERP win.
   b. Then the MedicalWebPage @graph with author/reviewedBy pointing at a Person @id, lastReviewed, datePublished, dateModified, and specialty (schema.org/Endocrine for diabetes, /Obstetric for prenatal, /Cardiovascular for hypertension, /Psychiatric for mental-health, /Musculoskeletal for pain-relief, /Geriatric for geriatric). Correct schema, valuable for entity resolution, but zero rich result, so it goes second.

5. Adjacent freshness fix worth doing at the same time: the sitemap stamps the same build-time `new Date()` on all 23 URLs (every lastmod read 2026-09-16T11:04:48.517Z on the fetch above). An identical, always-now lastmod is a signal Google discounts. Once dateModified exists per condition page, drive that page's sitemap lastmod from it instead.

### [MEDIUM] Teacher credentials exist in the database and the admin UI but are never rendered on the public teacher page and never emitted in Person JSON-LD

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts:33-48, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/[slug]/page.tsx, /Users/shalomp/YOGA_WEBSITE/lib/supabase/types.ts:54, https://www.myyogaclasses.fit/teachers/dr-vaishnavi-mayya, https://www.myyogaclasses.fit/teachers/dr-sangeeta, https://www.myyogaclasses.fit/teachers/dr-hima-bindu

**Evidence.** lib/supabase/types.ts:54-55 defines `years_experience: number` and `certifications: unknown` on the Teacher type. components/admin/TeacherFormDialog.tsx:337-345 gives admins a certifications textarea and :310 a years_experience input. Grep for `certifications` across app/ and components/ returns hits ONLY in TeacherFormDialog.tsx and TeacherEditPanel.tsx, both admin-only. The public page app/(marketing)/teachers/[slug]/page.tsx never reads either field. The emitted Person node on /teachers/dr-vaishnavi-mayya is: {"@type":"Person","name":"Dr Vaishnavi Mayya","jobTitle":"Yoga Teacher","worksFor":{...},"knowsAbout":[...],"knowsLanguage":["English"],"image":"...","description":"MD in Clinical Yoga & Naturopathy"}. No honorificPrefix, no hasCredential, no alumniOf, no sameAs, no award. jobTitle is the generic string "Yoga Teacher" for a person whose actual qualification is an MD in Clinical Yoga. The real credential "MD in Clinical Yoga and a Bachelor of Naturopathy and Yogic Sciences" and "9 years of personal practice and 6 years of clinical teaching" sits only in free-text bio prose, machine-unreadable.

**Recommendation.** CORRECTED FINDING (severity: medium)

Teacher credentials are populated on the live rows and rendered nowhere in structured form. The live teachers table holds certifications ["Bachelor of Naturopathy and Yogic Sciences","MD in Clinical Yoga"] for dr-vaishnavi-mayya and ["Doctor of Yogic Sciences"] for dr-hima-bindu, plus years_experience 9 / 2 / 8. Neither field is read by app/(marketing)/teachers/[slug]/page.tsx, and personJsonLd() in lib/seo/structuredData.ts:34-47 hardcodes jobTitle "Yoga Teacher" for people holding medical degrees. Only dr-sangeeta has an empty certifications array.

Impact is entity understanding and YMYL trust, not rich results. Person is not a Google-supported rich-result type and hasCredential produces no SERP feature, so this changes nothing in the blue-link appearance. It matters for how Google's entity graph and LLM answer engines resolve "is this practitioner qualified to teach yoga for hypertension", which is exactly what the nine condition pages assert. Rank it below the 23-URL index-size problem, the keyword-free condition titles, and the internal-linking dead ends.

CORRECTED RECOMMENDATION

(1) In lib/seo/structuredData.ts personJsonLd(), using only data that exists:
- `"@id": `${url}#person`` so Course.instructor can reference it.
- `jobTitle: t.headline ?? "Yoga Teacher"` so the real qualification lands in jobTitle instead of a generic string.
- `honorificPrefix: "Dr"` derived by testing whether display_name starts with "Dr", not hardcoded.
- `hasCredential` mapped from the existing certifications array, one node per string, with NO invented issuer:
  `{"@type":"EducationalOccupationalCredential","credentialCategory":"degree","name": <the exact stored string>}`
  Skip the property entirely when the array is empty (dr-sangeeta), so the builder never emits an empty node.
- Do NOT add alumniOf, award, or a Yoga Alliance sameAs. No institution or year exists in the schema, and no teacher holds an RYT registration. Fabricating an issuer on a health page is worse than omitting one.
- `sameAs` only if and when a teacher has a real verifiable third-party profile. There is currently none, so leave it out rather than shipping a dead property.

(2) In app/(marketing)/teachers/[slug]/page.tsx, add a visible Credentials block that renders `t.certifications` as a list, conditional on a non-empty array. This is the half with genuine E-E-A-T value: it turns bio prose into a scannable qualification block on a site making condition-specific health claims. Guard the jsonb: it is typed `unknown`, so `Array.isArray(x) && x.every(s => typeof s === "string")` before mapping.

(3) Do NOT render years_experience as a generic trust badge. It is 2 for dr-sangeeta, already duplicated in dr-hima-bindu's headline, and for dr-vaishnavi-mayya the stored 9 contradicts her bio's "6 years of clinical teaching" while the admin field is labelled teaching experience. Fix the data at /admin/teachers first, or skip this entirely. It is the weakest part of the original recommendation.

(4) Fix the bug in the same file while you are in it: `t.display_name.split(" ")[0]` renders "Meet Dr , a quick hello." and "Book a 1:1 with Dr" on all three live pages. Use a first name that skips a leading "Dr" token, or add a short-name field. This is visible on every teacher page today and costs nothing to fix.

(5) Related, higher yield than the JSON-LD itself: set `instructor: {"@id": "<teacher-url>#person"}` on the Course node of each condition page so the qualification attaches to the health claim, and fix `provider.sameAs` in courseJsonLd(), which currently points at the condition page's own URL instead of the site root.

All of this is code-side, touches no cookies(), adds no third-party origin, and needs no CSP or ISR change. Only dr-sangeeta's empty certifications array needs an admin data entry.

### [MEDIUM] Zero citations, zero evidence, zero reference to any medical body across all nine condition pages

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/diabetes.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/prenatal.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/hypertension.json, /Users/shalomp/YOGA_WEBSITE/components/marketing/condition/ConditionLanding.tsx

**Evidence.** Full text extraction of /classes/diabetes (978 words), /classes/prenatal (979 words) and /classes/hypertension (929 words) contains no study, no journal, no link out, no mention of ADA, NIH, WHO, NHS, ACOG, Diabetes UK or any health authority. The JSON sources confirm it: diabetes.json asserts "When your muscles work, they draw glucose from your blood", "Stress can nudge blood sugar upward" and "Poor sleep makes blood sugar harder to manage" with no source attached and no citations key in the schema. Compare myyogateacher.com/articles/yoga-for-diabetics, roughly 2,100 words, which cites two sources (ijrpr.com/uploads/V5ISSUE12/IJRPR36467.pdf on insulin sensitivity, and njppp.com on blood pressure and lipid profile).

**Recommendation.** CORRECTED FINDING

Keep the core issue at medium: nine YMYL condition pages assert physiological mechanisms about blood glucose, blood pressure and pregnancy with zero sourcing. Fix the recommendation and re-rank it below two defects in the same files that this finding walked past.

FIX THE RECOMMENDATION

Drop the MedicalWebPage instruction. It does not exist. Either add `citation` to the existing Course node in lib/seo/structuredData.ts:51 (Course inherits CreativeWork, so `citation` is valid there), or skip the markup entirely. No Google rich result reads `citation`, so this is a correctness nicety, not an SEO win. The value is the visible References block and the outbound links. Keep the `citations` array in the JSON schema, render it above the safety block, three to five per page, and keep the rendered copy em-dash free.

HIGHER PRIORITY, SAME FILES, MISSED (this is the high-severity item)

All nine condition pages render a placeholder testimonial live right now. Live diabetes HTML: `<span class="font-semibold text-foreground">Placeholder, swap for a real review.</span> Member · practising for 5 months`, attached to a first-person quote beginning "I started after my type 2 diagnosis, nervous about getting it wrong." Hypertension ships the colon variant, prenatal the period variant, which is why a single-string grep across the nine URLs looks like it only hits two pages. Source is `testimonialWho` in each of the nine JSONs (diabetes.json:152). A fabricated patient testimonial with the scaffolding still visible, on a medical page, is a rater-guidelines trust failure and a conversion failure, and it is a one-line edit per file. This outranks missing citations on both axes.

ALSO MISSED

No condition page carries an author or a medical reviewer. Zero hits on the extracted text for author, byline, Written by, Reviewed by, Medically reviewed. For YMYL health content, who wrote this and what are their credentials is weighted more heavily by raters than whether a journal is cited. The site already has real Indian teachers with bios at /teachers/[slug]. Attaching a named teacher as author and reviewer, linked to their profile, closes the authorship gap and simultaneously breaks the condition-page internal-linking dead end (established audit item 3) in one change. Do that before, or at least alongside, the citations.

CORRECTION TO THE FIRST-PASS AUDIT

Established item 7 is wrong that condition pages emit FAQPage. `grep -c FAQPage` on the live diabetes HTML returns 0. faqPageJsonLd exists at lib/seo/structuredData.ts:22 but app/(marketing)/classes/[slug]/page.tsx:48 only calls courseJsonLd. Each condition page renders five visible Q and A pairs with no markup on them at all.

### [MEDIUM] "Dr" honorific and "Yoga and Naturopathy Doctor" used without qualification disclosure, a live regulatory risk in the US and UK markets the site is targeting

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/teachers, https://www.myyogaclasses.fit/teachers/dr-sangeeta, https://www.myyogaclasses.fit/classes/prenatal, /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts:33

**Evidence.** /teachers renders "Dr Vaishnavi Mayya / MD in Clinical Yoga & Naturopathy", "Dr Sangeeta / Yoga and Naturopathy Doctor", "Dr Hima Bindu / Medical Yogic Sciences · 8 years". The Person JSON-LD description for Dr Sangeeta is the bare string "Yoga and Naturopathy Doctor". Nowhere on the site is the awarding institution, the country of qualification, or the nature of the qualification stated. Dr Vaishnavi's bio is the only place the underlying degree appears: "holding an MD in Clinical Yoga and a Bachelor of Naturopathy and Yogic Sciences", i.e. an Indian AYUSH BNYS plus an MD in Yoga and Naturopathy. Dr Sangeeta's page states no degree at all.

**Recommendation.** CORRECTED FINDING

Title: Bare "Dr" honorific with no stated qualification on teacher surfaces, while the real credentials already sit unrendered in teachers.certifications.

Evidence (all verified live): /teachers renders "Dr Vaishnavi Mayya / MD in Clinical Yoga & Naturopathy", "Dr Sangeeta / Yoga and Naturopathy Doctor", "Dr Hima Bindu / Medical Yogic Sciences · 8 years". The Person JSON-LD on /teachers/dr-sangeeta carries description: "Yoga and Naturopathy Doctor" (jobTitle is correctly "Yoga Teacher"). No teacher surface states an awarding institution, country of qualification, or scope of practice: grep for disclaimer text across app/(marketing)/teachers/ returns nothing. Sangeeta's certifications array is empty. Meanwhile Vaishnavi's and Hima Bindu's certifications arrays are populated and are never rendered on any public page.

DROP from Locations: /classes/prenatal. No teacher is named on that page (0 occurrences of "Sangeeta"), it has no author markup, and it already carries a health disclaimer from app/(marketing)/classes/[slug]/page.tsx:148.

Severity: medium.

CORRECTED RECOMMENDATION, split by where the change actually has to be made.

A. Code, in the repo (implementable now, no DB dependency, no em-dashes):
1. Render the existing certifications array on /teachers/[slug] and on the teacher card. This is a pure E-E-A-T gain using data already in the DB.
2. Add one static line to the teacher card component and the teacher detail page: "Qualified in India. Our teachers are yoga and naturopathy practitioners. They are not medical doctors registered in your country, and they do not diagnose or treat."
3. lib/seo/structuredData.ts:47: stop passing the raw headline as the only credential signal. Keep jobTitle: "Yoga Teacher" and add hasCredential built from t.certifications, e.g. certifications.map(c => ({"@type":"EducationalOccupationalCredential", credentialCategory: "degree", name: c, recognizedBy: {"@type":"Country", name:"India"}})). This puts the verifiable qualification into the markup instead of a bare honorific string.
All three are static server-rendered changes, so ISR in the (marketing) group is unaffected and no new third-party origin touches the CSP.

B. Admin DB edits at /admin/teachers (code changes cannot do these, the strings live in the Supabase teachers table):
4. Dr Sangeeta: fill the empty certifications field with her actual degree, and change headline from "Yoga and Naturopathy Doctor" to a qualification-bearing string such as "BNYS, Bachelor of Naturopathy and Yogic Sciences, India". Her headline is what the Person JSON-LD description emits, so this fixes the markup at the same time.
5. Dr Hima Bindu: change headline from "Medical Yogic Sciences · 8 years" to "Doctor of Yogic Sciences, India, 8 years".
6. Dr Vaishnavi: headline is already qualification-bearing; add ", India" for jurisdiction.

Sequencing note: do A1 before B4, otherwise filling certifications changes nothing visible.

### [MEDIUM] Rendering bug prints "Meet Dr , a quick hello." and "Book a 1:1 with Dr" on every teacher page, the exact page that carries E-E-A-T

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/[slug]/page.tsx:56, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/[slug]/page.tsx:126, /Users/shalomp/YOGA_WEBSITE/components/dashboard/TeacherSlotPicker.tsx:70, https://www.myyogaclasses.fit/teachers/dr-vaishnavi-mayya

**Evidence.** app/(marketing)/teachers/[slug]/page.tsx:56 `Meet {t.display_name.split(" ")[0]}, a quick hello.` and :126 `Book a 1:1 with {t.display_name.split(" ")[0]}`. Because every display_name begins with "Dr", token [0] is the honorific. Live output on /teachers/dr-vaishnavi-mayya: "Meet Dr , a quick hello." and "Book a 1:1 with Dr". Dr Hima Bindu's bio compounds it: "Ultimately, Dr. aims to help students carry the confidence...". Present on all three of three teacher pages.

**Recommendation.** Severity: medium (not high).

Corrected finding: app/(marketing)/teachers/[slug]/page.tsx takes `display_name.split(" ")[0]` as a first name at lines 56 and 126. Every teacher's display_name starts with the honorific "Dr", so all three live teacher pages render the caption "Meet Dr , a quick hello." and the primary CTA "Book a 1:1 with Dr". Verified live on /teachers/dr-hima-bindu, /teachers/dr-sangeeta and /teachers/dr-vaishnavi-mayya. This is a conversion and trust defect on the CTA of the credential pages, not a ranking factor; it affects 3 of the 23 indexable URLs.

Corrected recommendation (two separate fixes, do not conflate them):

A. CODE fix, strip only a LEADING honorific. The finding's snippet filters honorifics anywhere in the string and has no empty-token guard. Use instead, in a shared helper (suggest lib/utils.ts or a new lib/format/name.ts so both call sites import it):

const HONORIFICS = new Set(["dr", "mr", "mrs", "ms", "prof", "sri", "smt"]);
export function firstName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  const head = parts[0]?.replace(/\.$/, "").toLowerCase();
  const rest = HONORIFICS.has(head ?? "") ? parts.slice(1) : parts;
  return rest[0] ?? displayName;
}

Apply at page.tsx:56, page.tsx:126 and components/dashboard/TeacherSlotPicker.tsx:70. For "Dr Sangeeta" this yields "Sangeeta"; for a hypothetical honorific-less name it is a no-op. The TeacherSlotPicker call site is UX only, since /dashboard is robots-disallowed.

B. DATA fix, which the code change cannot do. Dr Hima Bindu's `teachers.bio` literally contains "Ultimately, Dr. aims to help students carry the confidence, peace, and steadiness..." with the surname missing. That string lives in the DB and must be corrected through /admin/teachers, then followed by the POST /api/admin/revalidate call the admin client already makes, since /teachers/[slug] is ISR at revalidate = 300.

Drop the `short_name` column suggestion as the primary path. It is a schema change, which under this project's rules means hand-written SQL plus a numbered migration applied to the live DB, and it buys nothing the helper above does not, given a three-teacher roster. Revisit only if a teacher ever wants a display name whose first name is not the right address form.

### [MEDIUM] All six published reviews are from AE and IN; there is zero social proof from the US, UK or EU markets the site is trying to sell into

- **Verdict:** unverified | **Effort:** substantial | **Impact:** medium
- **Locations:** https://www.myyogaclasses.fit/reviews, /Users/shalomp/YOGA_WEBSITE/lib/geo/region.ts

**Evidence.** /reviews in full: Emma R. Dubai AE, James P. Abu Dhabi AE, Fatima H. Abu Dhabi AE, Noor S. Sharjah AE, Mohammed A. Dubai AE, Priya N. Bengaluru IN. Six of six are Gulf or India. Meanwhile the Organization JSON-LD claims `areaServed: "Worldwide"` and lib/geo/region.ts lists USD, GBP and EUR among SUPPORTED_CURRENCIES.

**Recommendation.** A US or UK visitor evaluating a health service run from India, priced in a currency that may downgrade to INR, with three teachers and six Gulf reviews, has no reason to trust it. Prioritise collecting and publishing reviews from US, UK and EU students, with city and country shown, and mark each with the condition it relates to so condition pages can pull matching real reviews and finally retire the placeholders. Until such reviews exist, lead with credential-based trust rather than volume-based trust: teacher qualifications, institution names, years of clinical teaching, Yoga Alliance registration. Also note that the "Worldwide" areaServed claim is not currently backed by any evidence of serving anyone outside AE and IN, which is itself a rater-visible mismatch.

### [MEDIUM] Course JSON-LD on condition pages names no instructor and carries no credential, so the only machine-readable expertise signal on a YMYL page is the word "Organization"

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts:50-66, https://www.myyogaclasses.fit/classes/diabetes

**Evidence.** Live node on /classes/diabetes: {"@type":"Course","name":"1:1 Yoga: Diabetes focus","description":"...","url":"...","provider":{"@type":"Organization","name":"My Yoga Classes","sameAs":"https://www.myyogaclasses.fit/classes/diabetes"},"hasCourseInstance":{"@type":"CourseInstance","courseMode":"Online","courseWorkload":"PT60M"}}. Two defects beyond the missing instructor: `provider.sameAs` points at the condition page itself rather than at the organization, which is meaningless, and `hasCourseInstance` has no `instructor` and no `offers`, so Google cannot render a Course rich result for it.

**Recommendation.** In lib/seo/structuredData.ts courseJsonLd(), fix `provider.sameAs` to the Instagram profile already exported as INSTAGRAM_URL, or drop it and use `provider: {"@id": "<siteUrl>#organization"}` with a site-wide Organization @id. Add `hasCourseInstance.instructor` as a reference to the matched teacher Person @id, add `courseMode: "Online"` alongside `"https://schema.org/OnlineEventAttendanceMode"`, and add an `offers` node once the pricing Offer work lands. The instructor reference is the piece that matters for E-E-A-T: it is what ties a health topic page to a named, credentialed human in a way a machine can follow.

### [MEDIUM] The prenatal page is the single highest-liability asset on the site and currently has the weakest attribution of any of the nine

- **Verdict:** unverified | **Effort:** moderate | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/classes/prenatal, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/prenatal.json:158, https://www.myyogaclasses.fit/teachers/dr-sangeeta

**Evidence.** /classes/prenatal is 979 words covering "Is it safe to do yoga while pregnant?", "Which trimester can I start?", "Which poses do you avoid?" and "What if I feel dizzy, breathless, or have any pain or bleeding?". The only teacher with prenatal specialty is Dr Sangeeta, whose page lists no degree at all, only the headline "Yoga and Naturopathy Doctor" and a claimed "5.0 · 312 reviews". The page's testimonial reads "Being pregnant and far from family, having one teacher who knew exactly what was safe each trimester was such a relief" attributed to "Placeholder. Swap for a real review. Member · second trimester". Doctor or midwife clearance is mentioned only inside the session checklist, roughly 700 words in, and in the step-1 text.

**Recommendation.** Treat this page as its own workstream. Order: remove the placeholder testimonial, put doctor or midwife clearance above the fold as a boxed prerequisite not a bullet, byline it to Dr Sangeeta with her full qualification and awarding institution spelled out, add a named medical reviewer, cite ACOG Committee Opinion 804 and NHS pregnancy exercise guidance, and add `"@type": "MedicalWebPage", "specialty": "https://schema.org/Obstetric"` with `reviewedBy` and `lastReviewed`. A bleeding-in-pregnancy question answered by an unnamed author on an anonymous company page is the worst-case YMYL shape, and it is also the page most likely to attract a complaint in the UK or a state board inquiry in the US.

### [MEDIUM] Competitor benchmark: myyogateacher.com beats this site on every E-E-A-T axis on equivalent content, despite being weak itself

- **Verdict:** unverified | **Effort:** moderate | **Impact:** high
- **Locations:** https://myyogateacher.com/articles/yoga-for-diabetics, https://myyogateacher.com/articles/sitemap.xml, https://www.myyogaclasses.fit/classes/diabetes

**Evidence.** myyogateacher.com/articles/yoga-for-diabetics carries "Written by: Neelmani", "Posted On: August 1, 2022", "Updated On: 05/2026", two cited sources (ijrpr.com IJRPR36467.pdf on insulin sensitivity, njppp.com on blood pressure and lipid profile), and roughly 2,100 words. myyogaclasses.fit/classes/diabetes: 978 words, no byline, no date, no citation, one fabricated testimonial. Their articles sitemap at myyogateacher.com/articles/sitemap.xml contains 381 URLs, not the 241 the first-pass audit recorded, against 23 total indexable URLs here. Their sitemapindex lastmod is 2026-09-11 for main pages.

**Recommendation.** The bar to beat is low and specific. The competitor has an author name with no stated credentials, no medical reviewer, and two non-PubMed references. This site has three genuinely credentialed clinical practitioners, MD in Clinical Yoga, BNYS, Medical Yogic Sciences, and publishes none of it. Beat them by doing the thing they cannot: byline every condition page to a named clinical practitioner, add a second named practitioner as medical reviewer, show the awarding institutions and Yoga Alliance registrations, add a visible last-reviewed date, and cite ACOG, ADA, NHS and PubMed rather than low-tier journals. That is a defensible E-E-A-T advantage on identical query intent, and it is the only lever available at 23 URLs against their 613.

### [LOW] CORRECTION to the first-pass audit: condition pages have NO FAQPage JSON-LD, despite carrying five visible Q&As each

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx:5-6,48, /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts:22, https://www.myyogaclasses.fit/classes/diabetes

**Evidence.** Item 7 of the established list says FAQPage is present on "/ /faq /pricing and condition pages". It is not. The complete JSON-LD inventory on /classes/diabetes is two nodes: Organization and Course (with a nested CourseInstance). Grep for FAQPage across the ten fetched pages matches only homepage.html and pricing.html. app/(marketing)/classes/[slug]/page.tsx:5-6 imports only `JsonLd` and `courseJsonLd`, and line 48 is the single `<JsonLd data={courseJsonLd(...)} />` call. Meanwhile the page renders five real questions, for example on /classes/diabetes: "Can yoga replace my diabetes medication?", "Do I need to be fit or flexible to start?", "How soon might I notice anything?", "Is it safe if I have neuropathy or eye concerns?", "When's the best time to practise?". Also confirmed missing: BreadcrumbList on condition pages, which the first-pass audit did get right.

**Recommendation.** CORRECTED FINDING (severity: low, dimension is really structured-data hygiene, not eeat-ymyl)

Condition pages emit only Organization + Course. They are missing BreadcrumbList, which /teachers/[slug] already has, and their Course node has a malformed `provider.sameAs`.

What to actually do, in app/(marketing)/classes/[slug]/page.tsx:

1. ADD BreadcrumbList (this one still renders in Google SERPs). Import `breadcrumbJsonLd` from @/lib/seo/structuredData and add next to line 48:
   <JsonLd data={breadcrumbJsonLd([{ name: "Classes", url: `${siteUrl}/classes` }, { name: c.name, url: `${siteUrl}/classes/${c.slug}` }])} />
   Copy the exact shape from app/(marketing)/teachers/[slug]/page.tsx:45 so both routes stay consistent.

2. DO NOT add faqPageJsonLd. Google retired FAQ rich results on 2026-05-07 and deleted the documentation on 2026-06-15. It buys no SERP surface and adds markup that Search Console can no longer validate. Leave the visible accordion exactly as it is, it is good decision-support content.

2b. Consider the reverse cleanup: app/(marketing)/page.tsx:49, faq/page.tsx:19 and pricing/page.tsx:21 all emit the identical 10-item FAQPage from the same FAQS constant. That is now three copies of dead markup. Low priority, but it is maintenance with no payoff, and the comment at lib/seo/structuredData.ts:2-3 promising "FAQ accordions" is stale and will mislead the next person.

3. FIX lib/seo/structuredData.ts:57. Change
   provider: { "@type": "Organization", name: ORG_NAME, sameAs: url }
   to use the site root plus the real social profile, which the file already exports as INSTAGRAM_URL at line 20:
   provider: { "@type": "Organization", name: ORG_NAME, url: siteUrl, sameAs: [INSTAGRAM_URL] }
   Right now every condition page tells Google the organization's identity URL is that condition's page.

4. The title-separator correction stands and is worth acting on. The live title is "Diabetes · My Yoga Classes" (middot, from the app/layout.tsx:66 template), not "Diabetes | My Yoga Classes". Any title rewrite must budget for the template's 18 characters, and a bare `title: c?.name` at generateMetadata line 32 is the real problem, not the separator.

### [LOW] Sitewide credential claim "Every teacher is at least 200-hr Yoga Alliance certified" is unverifiable and unsupported by any registration number

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** https://www.myyogaclasses.fit/teachers, https://www.myyogaclasses.fit/about, /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts:33

**Evidence.** /teachers renders "Every teacher is at least 200-hr Yoga Alliance certified, with years of in-studio experience translated to live online sessions." /about repeats it twice: "Every teacher is a 200-hr Yoga Alliance certified professional. Most have 500+ hours and years of in-studio teaching." No RYT number, no E-RYT designation, no link to a Yoga Alliance directory profile appears on any of the three teacher pages. Grep for (yoga alliance|RYT|E-RYT) across the three teacher detail pages returns nothing; the claim exists only on /about and the homepage, never on the pages that would carry the proof.

**Recommendation.** Publish the actual RYT 200 or RYT 500 designation and the Yoga Alliance profile URL on each teacher page, and reference it in Person JSON-LD via hasCredential.recognizedBy plus sameAs. A specific, checkable registration number is worth far more than a blanket "every teacher" claim, which under FTC Health Products Compliance Guidance and CAP Code 3.7 is an objective claim requiring substantiation the site does not currently display. If any of the three teachers is not in fact Yoga Alliance registered, soften the sitewide claim rather than leaving it standing.

---

## technical (18)

### [HIGH] Condition-page <title> is sourced from a DB column, so the 'fix it in code' assumption is wrong -- and every internal anchor to those pages is the same bare category name

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx:32, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/legal/privacy/page.tsx:4, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/legal/terms/page.tsx:6, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/legal/refund/page.tsx:4, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/

**Evidence.** app/(marketing)/classes/[slug]/page.tsx:32 is `title: c?.name ?? "Class"` where `c` comes from `getClassCategories()` (the admin-editable class_categories table), NOT from the in-repo JSON. With the app/layout.tsx:65 template '%s · My Yoga Classes' this produces the live strings I measured: 'Diabetes · My Yoga Classes' (26 chars), 'Hypertension · My Yoga Classes', 'Prenatal &amp; Postnatal · My Yoga Classes', 'Kids Yoga · My Yoga Classes'. Anchor text audit of the homepage: all 9 links are the bare name -- /classes/diabetes => 'Diabetes', /classes/hypertension => 'Hypertension', /classes/prenatal => 'Prenatal & Postnatal', /classes/geriatric => 'Geriatric Yoga'. The repo's own standalone files are named correctly: landing-pages/yoga-for-diabetes.html, yoga-for-hypertension.html, yoga-for-prenatal.html. Three legal pages double-brand: app/(marketing)/legal/privacy/page.tsx:4 `title: "Privacy policy | My Yoga Classes"` renders live as 'Privacy policy | My Yoga Classes · My Yoga Classes' (49 chars); same at legal/terms/page.tsx:6 and legal/refund/page.tsx:4.

**Recommendation.** CORE FINDING (keep, severity high): the 9 condition-page titles are sourced from the admin-editable class_categories.name column, not from code, and carry zero query-matching keywords.

FIX, part 1 (as proposed, with one change): add `seoTitle: string` to the ConditionPage type in lib/data/condition-pages.ts and a `seoTitle` key to each of the 9 lib/data/condition-pages/*.json files, alongside the `metaDescription` field that is already there and already consumed at page.tsx:33. Then change page.tsx:32 to use an ABSOLUTE title, not the template, because on a zero-authority brand the 18-char ` · My Yoga Classes` suffix is wasted SERP pixels:

  title: rich?.seoTitle ? { absolute: rich.seoTitle } : (c?.name ?? "Class"),

Use sentence case to match the existing root title ("My Yoga Classes: Live 1:1 online yoga teacher"), not the Title Case the finding proposed:
  diabetes:        "Yoga for diabetes: live 1:1 online classes"
  hypertension:    "Yoga for high blood pressure: live 1:1 classes"
  prenatal:        "Prenatal and postnatal yoga: live 1:1 online"
  hormonal-health: "Yoga for hormonal health and PCOS: live 1:1"
  pain-relief:     "Yoga for back and joint pain relief: live 1:1"
  mental-health:   "Yoga for anxiety and stress: live 1:1 online"
  weight-loss:     "Yoga for weight loss: live 1:1 online classes"
  geriatric:       "Chair and senior yoga: live 1:1 online"
  kids-yoga:       "Kids yoga classes online: live 1:1"

FIX, part 2 (CORRECTED, the finding's version does not work): anchor text cannot be fixed by editing a string, because PracticeSection.tsx:45 and ClassGrid.tsx:64 both render `{c.name}` from the same DB column. Do it the same code-side way: add `linkLabel: string` to the ConditionPage JSON, export a `getConditionPage(slug)?.linkLabel` lookup, and render `getConditionPage(c.slug)?.linkLabel ?? c.name` in both components. Values: "Yoga for diabetes", "Yoga for high blood pressure", "Prenatal and postnatal yoga", "Yoga for hormonal health", "Yoga for pain relief", "Yoga for anxiety and stress", "Yoga for weight loss", "Chair and senior yoga", "Kids yoga". Do NOT instead rewrite class_categories.name in the admin: that column also feeds the Course JSON-LD (courseJsonLd at page.tsx:48) and the admin sessions picker (app/admin/sessions/page.tsx:37).

FIX, part 3 (severity LOW, not high): in legal/privacy/page.tsx:4, legal/terms/page.tsx:6 and legal/refund/page.tsx:4, delete the manual brand suffix so the root template supplies it once, yielding "Privacy policy · My Yoga Classes", "Terms of service · My Yoga Classes", "Refund policy · My Yoga Classes". Note the terms file uses a colon separator, not a pipe.

### [MEDIUM] Every FAQ accordion answer is missing from the server HTML on 12 of 23 indexable URLs, and the FAQPage JSON-LD that mirrors it stopped producing rich results in May 2026

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/components/ui/accordion.tsx:48-70, /Users/shalomp/YOGA_WEBSITE/components/marketing/FAQ.tsx:41, /Users/shalomp/YOGA_WEBSITE/components/marketing/condition/ConditionLanding.tsx:258, https://www.myyogaclasses.fit/faq, https://www.myyogaclasses.fit/pricing, https://www.myyogaclasses.fit/classes/diabetes

**Evidence.** components/ui/accordion.tsx:52 wraps @base-ui/react/accordion's `AccordionPrimitive.Panel` with no `keepMounted` and no `hiddenUntilFound`, so closed panels are never in the DOM. Measured on live HTML with <script> blocks stripped: https://www.myyogaclasses.fit/faq renders 195 words total; the 9 <h3> questions are present but 0 of 9 answers are ('A mat helps' in rendered body: False / in full source: True -- it exists only inside the RSC flight payload `self.__next_f.push`). Same on / (769 rendered words, 0/9 answers), /pricing (330 rendered words, 0/9 answers, aria-expanded=38) and all 9 condition pages (diabetes: 'Q in SSR: True | A in SSR: False | A in flight: True' for 5 of 5 FAQs). Hidden volume: 200 words from lib/data/faqs.ts x 3 pages, plus 991 words across lib/data/condition-pages/*.json (diabetes 149, prenatal 119, hypertension 113, mental-health 111, kids-yoga 108, hormonal-health 103, pain-relief 103, geriatric 97, weight-loss 88) = 1,191 unique words with no indexable home. The JSON-LD is not a fallback: Google's FAQPage doc now states 'The FAQ rich result feature is no longer shown in Google Search results, as announced in the changelog entry in May 2026.'

**Recommendation.** Title: FAQ accordion answers are absent from the server DOM on 12 of 23 indexable URLs; on the 9 condition pages they have no machine-readable fallback at all.

Severity: medium (not critical). Nothing is deindexed and every question heading is already in SSR. The real cost is 1,191 words of supporting copy that never reach the rendered DOM, on a site that only has 23 URLs.

Corrected evidence:
- components/ui/accordion.tsx:55-59 passes neither `keepMounted` nor `hiddenUntilFound`. Base UI 1.5.0 (node_modules/@base-ui/react/collapsible/panel/CollapsiblePanel.js) computes `shouldRender = keepMounted || hiddenUntilFound || mounted || open` and returns null otherwise, so `data-slot="accordion-content"` appears 0 times in the server HTML of /faq, /, /pricing and all 9 /classes/* pages.
- Affected: /, /faq, /pricing (via components/marketing/FAQ.tsx:41) and the 9 condition pages (via components/marketing/condition/ConditionLanding.tsx:258). Confirmed nothing else on the site uses the accordion.
- Split the impact, because the two halves are not equally bad:
  (a) /, /faq, /pricing lose 200 words of body text, but that text IS still present as plain text inside an identical 2,176-byte FAQPage JSON-LD block on each page. Degraded, not invisible.
  (b) The 9 condition pages lose 991 words with NO fallback: app/(marketing)/classes/[slug]/page.tsx:48 emits only `courseJsonLd`, and `FAQPage` does not appear in those pages' HTML at all. This is the half worth fixing first. (This also corrects first-pass audit item 7, which wrongly lists FAQPage on condition pages.)
- Worst single page is /faq at 195 rendered words, thin enough to be a quality liability on its own; the fix takes it to roughly 395.

Corrected fix (one line):
In components/ui/accordion.tsx, change `<AccordionPrimitive.Panel data-slot="accordion-content" ...>` to `<AccordionPrimitive.Panel hiddenUntilFound data-slot="accordion-content" ...>`. Do NOT also pass `keepMounted` - it is redundant (shouldRender ORs the two) and CollapsiblePanel.js warns on the keepMounted={false} combination. Note the SSR output is the boolean `hidden` attribute; useCollapsiblePanel.js:277 upgrades it to `hidden="until-found"` in a client layout effect, which is what enables Chrome's beforematch / scroll-to-text-fragment. Either way the text is in the initial DOM, which is the condition Google's own spam-policy page (updated May 2026) requires for accordion content to count.

Verify after deploy:
curl -sS https://www.myyogaclasses.fit/faq | python3 -c "import sys,re;s=sys.stdin.read();b=re.sub(r'<script.*?</script>','',s,flags=re.S);print('A mat helps' in b, b.count('accordion-content'))"
Expect True and 9 (currently False and 0). Repeat on /classes/diabetes expecting 5.

Regression check the fix needs: the panel's inner div carries `h-(--accordion-panel-height)` with `data-ending-style:h-0 data-starting-style:h-0`. Once panels are mounted while closed, screenshot /faq and one condition page to confirm all nine answers are still collapsed and the open/close keyframes still run.

Separate rider, not part of this fix: add `faqPageJsonLd(c.faqs)` to app/(marketing)/classes/[slug]/page.tsx so the condition FAQs are machine-readable too. Be explicit that this earns no rich result (Google retired FAQ rich results on 2026-05-07 and removes Rich Results Test support in June 2026); the only remaining value is AI Overviews and Bing. Also note the identical FAQPage block is currently duplicated verbatim across /, /faq and /pricing, which is worth deduping to /faq alone.

### [MEDIUM] CORRECTION to the first-pass audit: the 107-pose library is NOT unpublished -- it is already live and server-rendered; and condition pages carry NO FAQPage JSON-LD

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx:47-51, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/, /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts

**Evidence.** Established item 4 says the 107 pose entries are 'Unpublished'. They are not. Rendered text of https://www.myyogaclasses.fit/classes/diabetes contains the full pose section in SSR HTML: 'Surya Namaskar Sun salutation ... Tadasana Mountain pose & standing flow ... Setu Bandhasana Bridge pose ... Ardha Matsyendrasana Seated spinal twist ... Paschimottanasana Seated forward bend ... Mandukasana Frog pose ... Vajrasana Thunderbolt pose ... Nadi Shodhana Alternate-nostril breathing ... Bhramari Humming breath'. Verified 'Vajrasana' in SSR body: True. Repo count is 107 poses across 35 poseGroups (not 36): diabetes 4/11, geriatric 4/14, hormonal-health 4/11, hypertension 3/9, kids-yoga 4/13, mental-health 4/12, pain-relief 4/13, prenatal 4/12, weight-loss 4/12. Established item 7 says FAQPage is present on condition pages -- it is not. JSON-LD on /classes/diabetes is exactly ['Organization', 'Course']; on /faq, / and /pricing it is ['Organization', 'FAQPage']. BreadcrumbList is present only on /teachers/[slug] (confirmed on /teachers/dr-sangeeta).

**Recommendation.** Keep both factual corrections: the 107 pose entries across 35 poseGroups (not 36) are already live and server-rendered on all 9 /classes/[slug] pages, and condition pages carry only Organization + Course JSON-LD, with FAQPage present on /, /faq and /pricing and BreadcrumbList present only on /teachers/[slug].

Revise the recommendation as follows.

(1) BreadcrumbList on condition pages is the part worth doing. Import breadcrumbJsonLd alongside courseJsonLd in app/(marketing)/classes/[slug]/page.tsx and render, next to the existing courseJsonLd at line 47: breadcrumbJsonLd([{ name: "Class types", url: `${siteUrl}/classes` }, { name: c.name, url: `${siteUrl}/classes/${c.slug}` }]). Breadcrumb trails are still a live Google SERP feature, the builder at lib/seo/structuredData.ts:68 already takes exactly this {name,url}[] shape, and the teacher page at app/(marketing)/teachers/[slug]/page.tsx:44 is the pattern to copy. This is a pure addition to an existing prerendered RSC, so it does not touch ISR or the CSP.

(2) Drop FAQPage from the high-priority list. Google restricted FAQ rich results to authoritative government and health sites in August 2023 and removed them from Search entirely on 7 May 2026. Adding faqPageJsonLd(rich.faqs) will not produce any Google rich result. If added at all, add it only for Bing and LLM answer-engine parsing, treat it as low priority, and guard it so it only renders on the rich branch, since rich is null for any category without a JSON file and dynamicParams is on: {rich && <JsonLd data={faqPageJsonLd(rich.faqs)} />}. The unguarded snippet in the original finding would throw on the SimpleDetail path.

(3) Restate the pose opportunity honestly. The 107 entries deduplicate to 55 unique Sanskrit names, and the descriptions average 10 words (min 2, median 10, max 21). That is a seed, not a publishable corpus: it is enough to name and group poses, not enough to rank a standalone /yoga-poses/[slug] URL, and shipping 55 ten-word pages would be thin content. The correct framing is a two-step: first make what exists linkable by adding a stable id to each pose card in components/marketing/condition/ConditionLanding.tsx (around line 249's sibling pose loop) so poses can be deep-linked and cross-linked between the 9 condition pages, which are today reachable from only 2 internal links each (homepage grid and /classes index, not nav and footer). Only then, if the owner wants the 84-URL asana surface, commit to writing 250 to 400 words per pose (benefits, contraindications, how to do it on a 60 minute 1:1 over video, chair or prop variations) for the roughly 20 poses with real search volume, reusing the existing 10-word desc as the summary line rather than as the page.

### [MEDIUM] Quantified: every money page has exactly 2 internal inlinks, and the internal link graph has zero horizontal edges

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/components/marketing/condition/ConditionLanding.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/[slug]/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx

**Evidence.** I crawled the site from / following only same-origin <a href> outside <script> blocks (28 pages reached). Inlink counts: / 24, /about 23, /classes 23, /contact 23, /faq 23, /legal/privacy 24, /legal/refund 23, /legal/terms 24, /login 23, /pricing 23, /reviews 23, /teachers 23 -- these are the nav+footer set. Then: /classes/diabetes 2, /classes/geriatric 2, /classes/hormonal-health 2, /classes/hypertension 2, /classes/kids-yoga 2, /classes/mental-health 2, /classes/pain-relief 2, /classes/prenatal 2, /classes/weight-loss 2, /teachers/dr-hima-bindu 2, /teachers/dr-sangeeta 2, /teachers/dr-vaishnavi-mayya 2. The two are always the homepage and the hub. Outlink audit of /classes/diabetes: its only non-asset internal hrefs are ['/', '/about', '/classes', '/contact', '/faq', '/legal/privacy', '/legal/refund', '/legal/terms', '/login', '/pricing', '/reviews', '/teachers'] -- 12 links, all nav/footer, zero to any sibling condition page and zero to any teacher. /teachers/dr-sangeeta likewise links to no condition page despite its own copy saying 'I specialize in prenatal and postnatal yoga sessions'. Orphan check: 0 sitemap URLs are unlinked.

**Recommendation.** EVIDENCE (corrected): 24 unique paths reached, not 28. All inlink counts, the homepage+hub attribution, the 12-link nav/footer outlink set, the zero-horizontal-edges claim and the 0-orphan check reproduce exactly as stated. Drop the assertion that the three touch points are "pure server components": components/marketing/condition/ConditionLanding.tsx:1 is "use client". This does not threaten ISR (its Link hrefs render into the static HTML), but it means ConditionLanding must receive the category list as a prop from app/(marketing)/classes/[slug]/page.tsx, which already calls getClassCategories().

SEVERITY: medium, not high. There are 0 orphans and every page has homepage + hub inlinks, so nothing is undiscoverable. The win is anchor-text relevance, not crawl access, and on 23 URLs the equity effect is small. Keyword-bearing titles (currently "Diabetes · My Yoga Classes") and publishing the 107 unused pose entries as new URLs are both higher-leverage; drop the "single highest-leverage change available" framing.

RECOMMENDATION (1) - KEEP AS IS. Add a "Related conditions" block to ConditionLanding.tsx after the pose section, linking the other 8 slugs with "Yoga for X" anchors. 72 new edges, 8 new inlinks per page, no new copy, no DB dependency, no em-dashes, ISR-safe. This is the whole value of the finding.

RECOMMENDATIONS (2) AND (3) - REWRITE. As specified they produce 1 edge (strict intersection) or 2 (normalized), and would render an empty section on 7 of 9 condition pages, because no teacher-to-category join table exists and teachers.specialties (0002_teachers.sql:14) is free text teachers edit themselves. Do NOT ship a token-overlap matcher: the shared token "yoga" falsely links Dr Sangeeta and Dr Vaishnavi to /classes/kids-yoga and /classes/geriatric. Replace with an explicit, code-owned mapping instead of string matching:

  Add a `teacherSlugs: string[]` field to each of the 9 files in lib/data/condition-pages/*.json (or a single CONDITION_TEACHERS: Record<slug, teacherSlug[]> constant next to them), curated by hand from clinical judgement rather than inferred. That is code, not DB, so it cannot be silently broken by a profile edit, it is reviewable, and it lets Dr Vaishnavi ("Lifestyle Disorders", "Cardiovascular Health") be correctly attached to /classes/diabetes and /classes/hypertension, which no string operation can achieve. Render it on /classes/[slug] as "Teachers who work with this" cards, and render the reverse on /teachers/[slug] by inverting the same map. Gate both sections on a non-empty list so a page with no curated teacher renders nothing rather than an empty heading.

With a curated map, expect roughly 6 to 10 real bidirectional edges, all correct, versus 2 fragile ones. Combined with (1) the condition pages go from 2 inlinks to about 10 to 11 and the teacher pages from 2 to about 4 to 5.

### [MEDIUM] /pricing serves rupee prices and an 'AED and INR' meta description to the whole world, has no Offer schema, and renders only 330 words

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/pricing/page.tsx:11-15, /Users/shalomp/YOGA_WEBSITE/components/marketing/PricingTeaser.tsx, /Users/shalomp/YOGA_WEBSITE/lib/razorpay/catalog.ts:196

**Evidence.** Live https://www.myyogaclasses.fit/pricing is `x-nextjs-prerender: 1` with a single cached HTML variant. Its rendered text is: '1-Session Pack ... ₹999 ... 5-Session Pack ... ₹4,499 ... 10-Session Pack ... ₹7,999 ... Prices shown in INR . One-time payment, no subscription. Book from anywhere in the world.' Meta description from app/(marketing)/pricing/page.tsx:13 is 'Honest yoga pricing in AED and INR. One-time session packs, no subscription.' That is the snippet a Google user in the US, UK or Australia sees. JSON-LD on the page is exactly ['Organization', 'FAQPage'] -- no Product, no Offer, no AggregateOffer. The RSC flight payload leaks the whole plan_prices table including the AED rows (amount_cents 5900, 27500, 49900 = AED 59 / 275 / 499) and plan UUIDs. /api/region returned {"country":"IN","currency":"INR","locale":"en-IN"} from my location. CORRECTION to established item 12: the 5-pack is ₹4,499 / 5 = ₹899.80 per session, roughly USD 10, not '$23-24/session'. The AED 5-pack is AED 55/session, roughly USD 15. Against the stated US private-yoga rate of $60-120/hr the real gap is 4x to 12x, not 3x-5x.

**Recommendation.** CORRECTED FINDING (severity: medium)

Title: /pricing's meta description names two countries' currencies, the single prerendered variant carries INR prices only, and the page emits no Offer markup.

Evidence (all reproduced): live https://www.myyogaclasses.fit/pricing is `x-nextjs-prerender: 1` / `x-vercel-cache: HIT` with `vary` carrying no geo key, so one cached HTML serves every crawler and every first paint. It contains ₹999 / ₹4,499 / ₹7,999 and the line "Prices shown in INR." Meta description at app/(marketing)/pricing/page.tsx:13 is "Honest yoga pricing in AED and INR. One-time session packs, no subscription." JSON-LD on the page is exactly Organization + FAQPage. The page also has no page-specific openGraph or twitter metadata, so shares inherit the homepage blurb. Rendered text is 330 words.

DROP from the finding: the "5 session s included" pluralisation bug (false positive -- PricingTeaser.tsx:355 is correct; the live HTML is `5<!-- --> session<!-- -->s<!-- --> included`, which renders "5 sessions included"), and the RSC-payload "leak" (public commercial data, no SEO weight).

CORRECTED RECOMMENDATION

(1) HIGHEST VALUE, ONE LINE. Rewrite app/(marketing)/pricing/page.tsx:13 so it does not read as region-specific. Suggested, no em-dashes, no free-trial wording, no "credits":
    description: "One-time packs of live 1:1 yoga sessions with teachers in India. Buy 1, 5 or 10 sessions, no subscription, and your sessions never expire."
    While in the file, add page-specific openGraph/twitter title + description to the same metadata export so a shared /pricing link stops showing homepage copy.

(2) ADD OFFER MARKUP, INR ONLY, AND SET EXPECTATIONS HONESTLY. Build it server-side in page.tsx from the `plans` array already awaited (lib/data/landing.ts:16 -- PlanWithFeatures carries `prices`), emitted through the existing <JsonLd> component. Emit only INR, because INR is what the single indexed variant visibly shows and a structured-data price that disagrees with the visible price is the one thing Google's product data policy actually penalises. Do NOT also emit AED offers on this page.
    Three nodes, one per pack, plus a page-level AggregateOffer with lowPrice 999, highPrice 7999, priceCurrency "INR", offerCount 3. Prefer `Service` (or `Product` with `serviceType`) over bare `Product`: Google's Product documentation is written for product commerce and merchant-listing rich results are not a realistic outcome for a 1:1 session pack. The honest payoff is entity clarity for Google and for LLM answer surfaces, not a SERP price badge. Frame it that way in the ticket so nobody expects a rich result.
    pricedCurrencies() from lib/razorpay/catalog.ts:~170 is the right gate if a second currency is ever added, and importing it into the server page is ISR-safe (it reaches the DB via createSupabaseServiceClient(), never cookies()).

(3) REPLACE the "About US$10 per session" line. Do not server-render a hardcoded FX conversion: it derives a USD figure from the INR amount, which is exactly the cross-currency reading lib/razorpay/catalog.ts:17-22 exists to prevent, it drifts with the exchange rate, and checkout would still charge INR. Two better options, in order:
    a. Populate real USD/GBP/EUR rows in plan_prices for all three active plans. Migration 0036 already added the currencies; the blocker is data, not code. effectiveCurrency() then stops downgrading and the client-side swap in PricingTeaser.tsx starts showing real local prices to real visitors. The indexed variant stays INR regardless, which is fine.
    b. Until then, add a currency-neutral value line under the grid that carries no number, for example: "Teachers based in India, so a private 1:1 hour costs a fraction of a studio rate where you live."

(4) The 330-word count is not itself a defect on a transactional pricing page. Drop it as an argument; it does not support the severity.

### [MEDIUM] There is no telemetry of any kind in production -- no Search Console, no PostHog, no Sentry -- so a crawl regression would be invisible indefinitely

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/next.config.ts:14-18, /Users/shalomp/YOGA_WEBSITE/instrumentation.ts, /Users/shalomp/YOGA_WEBSITE/app/layout.tsx

**Evidence.** I fetched https://www.myyogaclasses.fit/ with a Googlebot UA and listed every non-_next script src. The complete list is four /_next/image URLs for teacher avatars plus /hero-poster.jpg. There is no posthog script, no sentry script, and no analytics origin of any kind in the document. Grep for 'google-site-verification', 'msvalidate', 'yandex' in <head> returned NONE on every page I checked. lib/analytics/events.ts and instrumentation-client.ts both no-op when NEXT_PUBLIC_POSTHOG_KEY / NEXT_PUBLIC_SENTRY_DSN are unset, and the absence of both scripts proves both env vars are unset in production. instrumentation.ts's server-side `onRequestError` RSC hook is therefore also dead, so a 500 on a prerendered marketing route (I confirmed https://www.myyogaclasses.fit/500 returns 'HTTP/2 500') is captured nowhere. The site has 23 indexable URLs, zero of which are being watched.

**Recommendation.** CORRECTED FINDING

Title: Production has no search-console property and no runtime telemetry, so the other fixes in this audit cannot be measured after they ship.

Severity: medium (observability gap, not a crawl or ranking defect).

Corrected evidence:
- No google-site-verification, msvalidate or yandex-verification meta on /, /pricing, /classes/diabetes or /teachers. app/layout.tsx:62 declares a Metadata object with no `verification` key.
- NEXT_PUBLIC_POSTHOG_KEY is unset in production. Proof: the shipped chunk containing lib/analytics/events.ts compiles the module's exports to `"initPosthog",0,t,"pausePhiCapture",0,function(){},"resumePhiCapture",0,function(){},"track",0,function(e,t={}){}`. `track` has an empty body because the key literal inlined as undefined and the minifier removed the body. Do not argue from the absence of a posthog script tag: events.ts:1-4 documents that posthog-js is a lazy dynamic import and is never in the server HTML even when configured.
- NEXT_PUBLIC_SENTRY_DSN is unset. Across all 28 homepage chunks (1,525,113 bytes) there is no DSN literal, no `ingest.sentry.io`, and no `captureRouterTransitionStart`. Consequently instrumentation.ts's `register()` returns early and its `onRequestError` RSC hook is dead.
- Side effect worth its own line: the @sentry/nextjs SDK core ships to the browser anyway (`dsnToString`, `tracesSampler`, the `SEMANTIC_ATTRIBUTE_SENTRY_*` table, across chunks of 29,734 and 233,698 bytes uncompressed). Today that is pure dead weight on the LCP path, which makes step 2 below a perf win as well as a telemetry win.
- DELETE the /500 claim entirely. https://www.myyogaclasses.fit/500 returns 500 because it is Next's prerendered static error document (`x-matched-path: /500`, `content-disposition: inline; filename="500"`, `x-vercel-cache: HIT`, `age: 3479`, body `<html id="__next_error__">`). It is a cached static asset, identical on any Next App Router deploy including a fully instrumented one. There is no observed runtime 500 on this site.

Corrected recommendation, ordered by cost:

1. Verify Google Search Console. Two CSP-free options, either works. (a) DNS TXT on myyogaclasses.fit as a Domain property, which covers apex and www in one property. (b) Simpler and version-controlled: add `verification: { google: "<token>" }` to the Metadata object at app/layout.tsx:62. That emits a meta tag, not a script, so it has no CSP interaction and survives a DNS provider change. Drop the GTM digression from the writeup: nobody verifies GSC through GTM in a Next app, and the HTML-tag method touches no script-src. Then submit https://www.myyogaclasses.fit/sitemap.xml (robots.txt already declares it) and import the property into Bing Webmaster Tools.
   The global-SEO argument is stronger than the generic one and should be stated: GSC's country breakdown is the only instrument that will show whether an INR-defaulting site with `areaServed: Worldwide` is actually reaching non-IN searchers, which is the central open question for this business. It is also the only way to see whether the 23 URLs are all indexed.

2. Set NEXT_PUBLIC_SENTRY_DSN in Vercel and redeploy. Zero code change: instrumentation.ts and instrumentation-client.ts are already written, and `https://*.ingest.sentry.io https://*.sentry.io` are already in connect-src at next.config.ts:31. This also converts ~30 KB or more of already-shipped dead SDK into something that earns its bytes.

3. Set NEXT_PUBLIC_POSTHOG_KEY. Also already CSP-allowed: the default api_host `https://us.i.posthog.com` in events.ts matches both `https://*.posthog.com` in script-src and `https://*.i.posthog.com` in connect-src, so no next.config.ts edit. It is client-only and never calls cookies(), so it cannot force the (marketing) group dynamic. The PHI guards (pausePhiCapture, maskAllInputs, maskTextSelector "[data-phi]") are already in place before session replay is enabled.

4. Replace the log-drain/cron suggestion. Vercel Log Drains are a Pro or Enterprise feature and the API exposes no per-path 404/500 aggregate below that, so as written it may not be actionable. Install `@vercel/analytics` and `@vercel/speed-insights` instead. Their script serves from same-origin /_vercel/insights/script.js (I confirmed 404 today, so neither is installed), which means `script-src 'self'` and `connect-src 'self'` already permit it with zero CSP edits. Speed Insights matters specifically here because a 23-URL site is almost certainly below the CrUX traffic threshold, so GSC's Core Web Vitals report will stay empty and field data for the 1.27 MB hero.mp4 and the 297 KB of preloaded fonts will be invisible otherwise. Only if a real 404/500 trend needs watching after that should a `cron/crawl-health` handler be added behind assertCron.

### [MEDIUM] robots.txt has no /teacher rule today, but adding the obvious one would silently deindex the public /teachers listing and all teacher profiles

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/robots.ts:5-16, /Users/shalomp/YOGA_WEBSITE/lib/supabase/middleware.ts:44-49, https://www.myyogaclasses.fit/robots.txt

**Evidence.** Live robots.txt (app/robots.ts:11) is: 'User-Agent: *\nAllow: /\nDisallow: /admin\nDisallow: /dashboard\nDisallow: /api'. There is no /teacher, /login, /onboarding or /auth rule, so no collision exists right now and nothing is wrongly blocked. The private surfaces are safe by redirect, not by robots: /teacher returns 'HTTP/2 307, location: /login?next=%2Fteacher', /teacher/documents 307 to /login?next=%2Fteacher%2Fdocuments, /dashboard and /dashboard/documents 307 to /login, /admin 307 to /login, /onboarding 307 to /login?next=%2Fonboarding with 'cache-control: private, no-cache, no-store', and /auth/callback 307 to /dashboard. The trap is that robots.txt path matching is a bare string prefix with no segment awareness -- the exact thing lib/supabase/middleware.ts:47 goes out of its way to avoid with `const inArea = (base) => path === base || path.startsWith(\`${base}/\`)`, whose comment says 'NOT a bare string prefix, or "/teacher" would also swallow the public "/teachers" marketing listing'. robots.txt has no equivalent, so `Disallow: /teacher` would block /teachers, /teachers/dr-sangeeta, /teachers/dr-hima-bindu and /teachers/dr-vaishnavi-mayya -- four indexable URLs, 17% of the site.

**Recommendation.** Leave robots.txt alone for /teacher; the 307 already prevents indexing and blocking would only stop Google reading that redirect. If someone does add a rule, it must be two lines and never the one-liner: `Disallow: /teacher$` plus `Disallow: /teacher/`. Add that warning as a comment in app/robots.ts next to the disallow array, mirroring the comment already in lib/supabase/middleware.ts:44-46, so the next person who 'tidies up robots.txt' does not deindex the teacher pages. Separately, consider `Disallow: /auth/` (the callback is a redirect-only endpoint with no value) and leave /onboarding alone since it 307s and is no-store.

### [MEDIUM] Teacher pages are 171 rendered words, carry a visible name-truncation bug on every profile, and display review counts that contradict the rest of the site

- **Verdict:** unverified | **Effort:** moderate | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/[slug]/page.tsx:28-29, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/[slug]/page.tsx:56, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/[slug]/page.tsx:126, https://www.myyogaclasses.fit/teachers/dr-sangeeta

**Evidence.** Rendered text of https://www.myyogaclasses.fit/teachers/dr-sangeeta is 171 words and reads: 'Meet Dr , a quick hello. 5.0 · 312 reviews Dr Sangeeta Yoga and Naturopathy Doctor ...' and later 'Book a 1:1 with Dr'. The cause is app/(marketing)/teachers/[slug]/page.tsx:56 and :126, both `{t.display_name.split(" ")[0]}` -- every teacher's display_name begins 'Dr', so every profile renders 'Meet Dr ,' and 'Book a 1:1 with Dr'. Meta descriptions are t.headline and are 27, 33 and 37 characters long (Dr Sangeeta, Dr Hima Bindu, Dr Vaishnavi Mayya). Social-proof numbers do not reconcile: each teacher page claims '312 reviews', the homepage trust bar claims '4.9 · 1,200+ reviews', and /reviews renders 280 words containing 12 reviews. No aggregateRating or Review node exists in any JSON-LD ('AggregateRating in LD: False', 'aggregateRating: False' on the homepage; the Person node on /teachers/dr-sangeeta has name, url, jobTitle, worksFor, knowsAbout, knowsLanguage only).

**Recommendation.** (1) Fix the name bug: add a `first_name` column or strip an honorific prefix set -- `display_name.replace(/^(Dr|Dr\.|Prof|Prof\.|Mr|Ms|Mrs)\s+/i, "").split(" ")[0]` at both call sites gives 'Sangeeta'. This is user-facing text on three indexable pages. (2) Write real 150-160 char meta descriptions per teacher: 'Dr Sangeeta is a yoga and naturopathy doctor specialising in prenatal and postnatal yoga. Book a live 60-minute 1:1 session online, in your local time.' (3) Do NOT add AggregateRating or Review schema to the current numbers. 3 teachers x 312 reviews is 936, the homepage says 1,200+, and /reviews shows 12 -- marking any of that up would be a Google structured-data policy violation (self-serving, unverifiable review counts) with a manual-action risk far larger than the rich-result upside. Reconcile the displayed numbers to what the reviews table actually holds first, then mark up the true figure. (4) Teacher profiles at 171 words cannot compete with myyogateacher.com's 116 /yoga-teachers URLs; add per-teacher sections sourced from existing DB columns (specialties, languages, years of experience, certifications) plus the teacher-linked condition pages from the internal-linking fix.

### [MEDIUM] og:locale is the invalid value 'en', there is no hreflang, and there is no web app manifest at all

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/layout.tsx:71-79, /Users/shalomp/YOGA_WEBSITE/app/layout.tsx:57, https://www.myyogaclasses.fit/manifest.webmanifest

**Evidence.** Live head on every page: '<meta property="og:locale" content="en"/>' from app/layout.tsx:76 `locale: "en"`. The Open Graph spec requires language_TERRITORY; 'en' is silently dropped by Facebook and LinkedIn. Searching every page head for 'hreflang' returned NONE and for 'rel="alternate"' returned NONE. '<html ... lang="en">' is the only language signal. Manifest: 'rel="manifest"' returned NONE in head, and /manifest.json, /manifest.webmanifest and /site.webmanifest all return 404 with the generic noindex 404 page -- there is no app/manifest.ts in the repo. Icons themselves are fine: /icon.svg 200 image/svg+xml 846 B, /apple-icon.png 200 image/png 8,535 B, /favicon.ico 200 image/vnd.microsoft.icon 2,303 B, /opengraph-image 200 image/png 45,491 B, and twitter:image resolves to https://www.myyogaclasses.fit/opengraph-image?874e901a6cbef42a with card=summary_large_image.

**Recommendation.** (1) Change app/layout.tsx:76 to `locale: "en_US"` -- for a worldwide-customer business en_US is the correct default, not en_IN. (2) Do not add hreflang yet: there is exactly one language and one URL per page, so hreflang would be self-referential noise. It becomes correct only if you ever ship /in/ or /ae/ price-localised variants; if you do, the pairs must be reciprocal and include x-default. (3) Add app/manifest.ts returning name 'My Yoga Classes', short_name 'Yoga', start_url '/', display 'standalone', background_color and theme_color '#fbf7ef' (matching the viewport themeColor already at app/layout.tsx:57), and icons referencing /icon.svg and /apple-icon.png. Next will emit /manifest.webmanifest and the <link rel="manifest"> automatically. This is a mobile-install and PWA-signal gap on a site where 75% of traffic is mobile, and it also gives the Capacitor wrapper a canonical icon/name source.

### [MEDIUM] Everything under public/ is served with max-age=0, must-revalidate -- including the 1.27 MB hero video

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/next.config.ts:54-56, /Users/shalomp/YOGA_WEBSITE/public/

**Evidence.** Header audit by asset class. Build output is correct: /_next/static/media/01e4147cff8141ee-s.p.10ked.7w885.g.woff2 returns 'cache-control: public,max-age=31536000,immutable'. Everything hand-placed in public/ is not: /hero-poster.jpg 'cache-control: public, max-age=0, must-revalidate', /hero.mp4 same, /icon.svg same (200, 846 B), /apple-icon.png same (200, 8,535 B), /favicon.ico same (2,303 B), /opengraph-image same (45,491 B). next.config.ts:54-56 has exactly one headers() rule -- `{ source: "/:path*", headers: securityHeaders }` -- and securityHeaders contains no Cache-Control, so public/ falls through to the Vercel default. HTML itself is correctly 'public, max-age=0, must-revalidate' with 'x-nextjs-stale-time: 300' and working ETags, so the HTML side of crawl efficiency is healthy (I confirmed a 304 on /classes/diabetes).

**Recommendation.** Add a second entry to the headers() array in next.config.ts, before or after the securityHeaders rule: `{ source: "/:path(hero.mp4|hero-poster.jpg|logo-email.png|icon.svg|apple-icon.png|favicon.ico)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }`, and add a query-string or filename version when you replace one of these files. hero.mp4 at 1.27 MB revalidating on every visit is the expensive one, and since it is client-mounted it does not affect LCP but does affect repeat-visit bandwidth and mobile data. The icons are small but are requested on literally every page (my crawl found /icon.svg, /apple-icon.png and /favicon.ico referenced from all 24 pages).

### [MEDIUM] The public GitHub repo describes a business that no longer exists and links to a dead 404 instead of the site

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** https://github.com/Shalom-P/yoga-website, /Users/shalomp/YOGA_WEBSITE/README.md

**Evidence.** github.com/Shalom-P/yoga-website is Public. Its description reads: 'Conversion-first yoga studio web app — Next.js 16 + Supabase + PayPal + Google Meet. AU customers, IN teachers.' PayPal was replaced by Razorpay (migrations 0020/0021, PRs #13-17) and 'AU customers' has been wrong since 2026-06-21. The About sidebar Website field is yoga-website-seven-mocha.vercel.app, which I fetched: 'HTTP/2 404', body 'The deployment could not be found on Vercel. DEPLOYMENT_NOT_FOUND'. The README body is current ('UAE + India customers, Indian teachers', 'Razorpay one-time Checkout'), so only the two metadata fields are stale -- and those two fields are exactly what Google renders as the title and snippet for a repo page. GitHub repo pages carry very high domain authority, so this page outranks the site for brand-adjacent queries while describing the wrong payment provider, the wrong market, and linking to nothing.

**Recommendation.** Three edits in GitHub repo Settings, no code change. (1) Description -> 'Live 1:1 online yoga with teachers in India. Next.js 16, Supabase, Razorpay. Source for myyogaclasses.fit.' -- drop PayPal and AU. (2) Website field -> https://www.myyogaclasses.fit (a real, followed backlink from a high-authority domain, replacing a 404). (3) Topics -> yoga, nextjs, supabase, online-yoga, telehealth. Also update the README's own 'UAE + India customers' line, since the service-area gate was removed and lib/geo/region.ts:34 now lists INR, AED, USD, GBP, EUR -- the README currently understates the market to anyone who reads it. If the repo does not need to be public, making it private removes the competing result entirely, but the backlink is worth more than the confusion once the description is fixed.

### [LOW] /login is fully indexable with 23 internal inlinks, and it canonicalizes to the homepage -- exposing a root-layout canonical landmine for every future page

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/layout.tsx:68, /Users/shalomp/YOGA_WEBSITE/app/(auth)/login/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/robots.ts:11

**Evidence.** curl https://www.myyogaclasses.fit/login returns 'HTTP/2 200', 'x-nextjs-prerender: 1', 'x-vercel-cache: HIT', '<title>Log in · My Yoga Classes</title>', no `<meta name="robots">`, and 41 rendered words. Its canonical is '<link rel="canonical" href="https://www.myyogaclasses.fit"/>' -- the homepage -- because the (auth) login page sets no `alternates` and inherits app/layout.tsx:68 `alternates: { canonical: "/" }`. robots.txt (app/robots.ts:11) disallows only ['/admin','/dashboard','/api'], so /login is crawlable, and my link crawl found it linked from 23 pages (the header 'Log in' and every CTA). It is the only indexable HTML URL reachable on the site that is not in sitemap.xml. The inherited-canonical mechanism is the real risk: any new (marketing) page that forgets `alternates.canonical` will silently declare the homepage as its canonical and be dropped from the index with no build error -- the same failure class as the cookies()/ISR trap already documented in CLAUDE.md.

**Recommendation.** Title: /login and its 4 query-string variants are crawlable and inherit a canonical pointing at the homepage, a root-layout foot-gun for future (marketing) pages

Severity: LOW. No current ranking or revenue loss. I verified all 23 sitemap URLs return self-referential canonicals (23/23 OK, 0 bad) and all 12 (marketing) metadata files already set alternates.canonical explicitly. The risk is entirely prospective.

Corrected evidence:
- curl https://www.myyogaclasses.fit/login returns HTTP/2 200, x-nextjs-prerender: 1, x-vercel-cache: HIT, <title>Log in · My Yoga Classes</title>, no <meta name="robots">, canonical https://www.myyogaclasses.fit (the homepage), and 35 rendered words (not 41; the LoginForm is behind Suspense so its text is absent from the static HTML).
- The canonical is inherited from app/layout.tsx:71 (not :68). robots.ts disallows at app/robots.ts:12 (not :11).
- Not 23 inlinks to one URL: all 23 sitemap pages link /login AND /login?next=/dashboard/book, and the 3 teacher pages add /login?next=%2Fdashboard%2Fbook%2F<slug>. Five distinct crawlable prerendered URLs, all serving the same homepage canonical (verified: /login?next=%2Fdashboard returns 200, x-nextjs-prerender: 1, canonical https://www.myyogaclasses.fit).
- app/(marketing)/page.tsx exports NO metadata object at all, only `export const revalidate = 60`.

Corrected recommendation (ship both steps in the same commit, they are not independent):
1. In app/(auth)/login/page.tsx:6, change the existing export to `export const metadata = { title: "Log in", robots: { index: false } };`. The title is already there; only `robots` is new. Drop the `follow: true` rationale: Google degrades long-term noindex,follow to nofollow, and /login's only outlinks (/, /legal/terms, /legal/privacy) are already footer-linked sitewide, so there is no equity to preserve. Do not add Disallow: /login to robots.txt, since a blocked URL cannot be read for its noindex.
2. Remove `alternates: { canonical: "/" }` from app/layout.tsx:71 and add a metadata export to app/(marketing)/page.tsx carrying `alternates: { canonical: "/" }`. This is required, not optional: leaving the root canonical in place would pair a noindex with a cross-page canonical, the exact combination Google advises against. After the move, a page that forgets its canonical emits none, and Google self-canonicalizes.
3. Replace the proposed vitest with an ESLint rule or a build-time check. A filesystem-globbing test conflicts with the stated convention in CLAUDE.md that coverage is limited to pure, dependency-free helpers, and it would fail immediately on app/(marketing)/page.tsx, which exports no metadata.

None of this moves revenue. Treat it as 15 minutes of hygiene, not a priority item against the 23-URL content gap.

### [LOW] Apex-to-www is a 307 temporary redirect, and http://myyogaclasses.fit is a two-hop chain

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** medium
- **Locations:** https://myyogaclasses.fit/, /Users/shalomp/YOGA_WEBSITE/next.config.ts:37

**Evidence.** curl -D- https://myyogaclasses.fit/ returns 'HTTP/2 307' with 'location: https://www.myyogaclasses.fit/'. Same for https://myyogaclasses.fit/pricing -> 'HTTP/2 307' -> https://www.myyogaclasses.fit/pricing. And http://myyogaclasses.fit/ measures 'chain: 2 redirects' -- 'HTTP/1.0 308 Permanent Redirect, Location: https://myyogaclasses.fit/' then the 307 to www. Everything else is clean: http://www -> 1 hop 308; https://www.myyogaclasses.fit/pricing/ -> 'HTTP/2 308, location: /pricing'; /Pricing, /PRICING and /classes/Diabetes all return 404 (no case-insensitive duplicates); /index.html 404s. next.config.ts declares no `redirects()`, so the apex rule is a Vercel project domain redirect.

**Recommendation.** Title: Apex-to-www is a 307 temporary redirect (weak canonicalization signal)
Severity: low

Evidence (verified 2026-09-16): `https://myyogaclasses.fit/` and `/pricing` both return `HTTP/2 307` with `location: https://www.myyogaclasses.fit/...` and `server: Vercel`. `http://myyogaclasses.fit/` is a 2-hop chain (`HTTP/1.0 308` to https apex, then the 307 to www). `http://www` is a clean 1-hop 308. next.config.ts declares no `redirects()` (only `headers()` at line 54), so the rule lives in Vercel project domain settings. Everything else is clean: `/pricing/` -> 308 -> `/pricing`; `/Pricing`, `/PRICING`, `/classes/Diabetes`, `/index.html` all 404.

Recommendation:
1. In Vercel, Project > Settings > Domains, change the myyogaclasses.fit -> www.myyogaclasses.fit redirect status from 307 to 308. Vercel supports a custom status code on domain redirects. Google treats 301/308 as a strong canonicalization signal and 302/303/307 as weak, so this makes any apex-pointing link consolidate onto the www canonical properly. Thirty seconds, no deploy, no risk.
2. DROP the HSTS preload advice as written. It is wrong. The apex 307 serves only `strict-transport-security: max-age=63072000`, with no `includeSubDomains` and no `preload`. The full header quoted in the original finding is what www serves (next.config.ts:39) and it never reaches the apex, because the apex redirect terminates at Vercel's edge before the Next app runs. hstspreload.org's API returns two blocking errors for this domain today (`header.preloadable.include_sub_domains.missing`, `header.preloadable.preload.missing`), so a submission would be rejected. Preload is not achievable from the repo at all here; it would require Vercel to emit the full directive set on the apex redirect response. Do not spend time on it, and do not expect it to collapse the http-apex two-hop chain.
3. The 2-hop http-apex chain is correctly described as uncollapsible at the Vercel domain layer (the automatic HTTP-to-HTTPS 308 fires before the domain redirect) and is genuinely not worth effort.

Framing: treat this as hygiene, not a ranking problem. The www canonical is already consistent across the canonical tag, all 23 sitemap `<loc>` entries and robots.txt, so the current downside is limited to weak consolidation of apex backlinks the site does not yet have.

### [LOW] sitemap.xml lastmod is the serverless instance's cold-start time, not a content timestamp -- and Google only honours lastmod it can verify

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/sitemap.ts:11-66, https://www.myyogaclasses.fit/sitemap.xml

**Evidence.** app/sitemap.ts:11-66 defines STATIC_ROUTES as a MODULE-LEVEL const with `lastModified: new Date()` on all 11 entries. `new Date()` therefore evaluates once per lambda cold start and freezes for that instance's lifetime -- it is not per-generation as assumed, it is per-instance. Proof: three consecutive fetches at 10:11:48, 10:11:51 and 10:11:55 GMT all returned '<lastmod>2026-09-16T10:08:49.816Z</lastmod>' with 'x-vercel-cache: MISS' and 'age: 0' on each, i.e. dynamically rendered every time yet reporting a timestamp from ~3 minutes earlier (my first request of the session, which cold-started the instance). Different regions and instances will therefore report different lastmod values for identical, unchanged content -- /legal/privacy and /legal/terms have not changed in months but claim to have changed minutes ago. The 12 DB-driven rows are correct by contrast: /classes/* all carry 2026-06-21T13:09:36.778Z and /teachers/dr-sangeeta carries 2026-08-02T08:16:42.780Z, from `updated_at`. Google's sitemap documentation states: 'Google uses the <lastmod> value if it's consistently and verifiably (for example by comparing to the last modification of the page) accurate.' An always-moving lastmod on pages whose bytes never change is exactly the inconsistency that makes Google discard the signal for the whole sitemap, including the 12 honest rows.

**Recommendation.** CORRECTED FINDING

Title: sitemap.xml reports a runtime timestamp as lastmod for 11 static pages whose content has not changed, which invites Google to distrust lastmod across the whole sitemap.

Severity: low (crawl-hint hygiene on a 23-URL site, not a ranking or revenue issue).

Evidence (reproduced 2026-09-16): app/sitemap.ts:7-74 sets `lastModified: new Date()` on all 11 STATIC_ROUTES entries at module scope. Because lib/supabase/server.ts:6 calls `cookies()`, the route is dynamic and re-renders per request (`x-vercel-cache: MISS`, `age: 0` on five consecutive fetches), yet every fetch between 11:09:01 and 11:09:53 GMT returned the same `2026-09-16T11:04:48.517Z`. Last commit is 2026-09-13, so this is serverless-instance init time, not build time. A probe an hour earlier saw 2026-09-17... (10:08:49.816Z), a different value. /legal/privacy, /legal/terms and /legal/refund therefore claim to have changed minutes ago, on every crawl, forever. The 12 DB-driven rows are honest: 9 /classes/* at 2026-06-21T13:09:36.778Z, dr-vaishnavi-mayya 2026-06-17T16:48:10.484Z, dr-sangeeta 2026-08-02T08:16:42.780Z, dr-hima-bindu 2026-08-02T08:48:05.049Z.

Note the defect is the use of `new Date()` at all, not its placement. Moving it inside the function makes it per-request, which is worse.

Recommendation (corrected):

1. Do NOT use VERCEL_GIT_COMMIT_AUTHOR_DATE. It does not exist. Vercel's system env vars expose no commit or deploy timestamp (verified against the full VERCEL_GIT_* list). If you want a build constant you must inject it yourself in the Build Command, e.g. `NEXT_PUBLIC_BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) next build`. Even then, a deploy-stamped lastmod on /legal/privacy is still inaccurate: Google's own guidance says lastmod should reflect significant content changes, not every rebuild. So skip this option.

2. For the 8 rarely-changing pages (/about, /faq, /contact, /legal/privacy, /legal/terms, /legal/refund, and /classes and /teachers index pages), hand-maintain a route to ISO-date map in app/sitemap.ts, bumped when the copy actually changes, with each /legal/* pinned to the date that policy was last revised. Concretely: replace `lastModified: new Date()` with a literal such as `lastModified: new Date("2026-06-17")`.

3. For the 3 genuinely DB-driven pages, derive real timestamps. The route already awaits a Supabase client at app/sitemap.ts:80, and all three tables are anon-readable with an updated_at column, so this adds one batched query and no new privileges:
   - `/` and `/reviews`: MAX(updated_at) from admin_settings (0005:59 column, 0005:62 `using (true)` policy) and from reviews where is_approved = true (0005:23).
   - `/pricing`: MAX(updated_at) from plan_prices (0022:43 column, 0022:50 active-plan read policy).
   Use the existing `catch {}` at line 117 so a failed query degrades to omitting lastmod rather than to `new Date()`.

4. Optional and free: drop `changeFrequency` and `priority` from all 23 entries. Google's sitemap docs state plainly that it ignores both.

5. If step 2 is not worth the maintenance, the acceptable fallback per Illyes (July 2026) is to omit lastmod on the 11 static rows entirely and keep it only on the 12 DB-driven rows, where it is verifiably true.

No project constraint is affected: app/sitemap.ts sits at the app root rather than in (marketing), so ISR is untouched; no third-party origin is added, so the CSP in next.config.ts needs no edit; no user-facing copy changes.

### [LOW] changeFrequency and priority in app/sitemap.ts are dead bytes in 2026 -- Google ignores both, and the values here are self-contradictory anyway

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** low
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/sitemap.ts:11-120

**Evidence.** Google's 'Build and submit a sitemap' documentation is explicit: 'Google ignores <priority> values.' and 'Google ignores <changefreq> values.' Bing has stated the same for over a decade. The live sitemap ships 23 <changefreq> and 23 <priority> elements (app/sitemap.ts assigns daily/1.0 to /, weekly/0.9 to /classes /pricing /teachers, weekly/0.7 to /reviews, monthly/0.6 to /faq /contact, yearly/0.3 to /legal/*, monthly/0.7 to all 12 dynamic rows). Beyond being ignored, the values contradict the observed reality: / is declared 'daily' but the homepage is `x-nextjs-prerender: 1` with `x-nextjs-stale-time: 300` and its copy is admin_settings-driven and rarely edited, while /classes/* are declared 'monthly' and are the pages the business should actually be updating. The one element Google does read, lastmod, is the one that is wrong (see the separate finding). Note the values are harmless -- there is no penalty -- so this is a clarity issue, not a ranking one.

**Recommendation.** TITLE: app/sitemap.ts stamps a render-time lastmod on all 11 static URLs; the changeFrequency and priority values alongside it are inert but harmless.

EVIDENCE (corrected): The live sitemap is 4,027 bytes with 23 URLs, 23 <changefreq> and 23 <priority>. Google's docs say verbatim 'Google ignores <priority> and <changefreq> values'; Bing ignores both and has driven crawl scheduling off lastmod since June 2023. The declared values are NOT self-contradictory: /classes/* all carry lastmod 2026-06-21T13:09:36.778Z (~3 months static, so 'monthly' is generous), and / is DB-driven with a 300s ISR stale time, so 'daily' is defensible. The full value set is / daily/1.0; /about monthly/0.8 (omitted by the original finding); /classes /pricing /teachers weekly/0.9; /reviews weekly/0.7; /faq /contact monthly/0.6; /legal/* yearly/0.3; 12 dynamic rows monthly/0.7. Deleting both fields saves 1,323 raw bytes but only 75 bytes gzipped, not 1.4 KB.

RECOMMENDATION (corrected): Do NOT spend a PR on deleting changeFrequency and priority. They are standards-valid, cost 75 compressed bytes, and Yandex's webmaster docs still describe using sitemap data for crawl planning, which matters for a worldwide brief. If they are removed at all, do it incidentally while fixing the line that actually matters, in the same file.

THE REAL EDIT, same lines: replace lastModified: new Date() at app/sitemap.ts:12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72. Because createSupabaseServerClient() calls cookies(), the route renders per request (live: x-vercel-cache: MISS, cache-control: public, max-age=0, must-revalidate), so every static URL advertises 'modified seconds ago' on every crawl. All 11 reported 2026-09-16T11:04:48.517Z, including /legal/privacy, /legal/terms and /legal/refund. Google only uses lastmod when it is 'consistently and verifiably accurate', so this teaches both engines to discard the one signal they read. Concrete fix: give each static route a hardcoded ISO date constant reflecting its last real content edit (git log --format=%aI -1 -- <route file> is the source), and for / derive it from the max updated_at across the admin_settings, plan_features and reviews rows that feed it, matching the pattern already used correctly for the teacher and category rows at app/sitemap.ts:102 and :113. This touches no user-facing copy, adds no third-party origin, and does not change the (marketing) group's ISR, since app/sitemap.ts is already outside that group and already dynamic.

### [LOW] Googlebot and Bingbot are not blocked anywhere, and there is no cloaking -- confirmed byte-for-byte

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** low
- **Locations:** /Users/shalomp/YOGA_WEBSITE/next.config.ts:54-56

**Evidence.** Googlebot desktop UA on / returned 'HTTP/2 200', size=151354 bytes -- byte-identical to the default UA fetch of the same URL (151354). Headers to Googlebot were the same as to a browser: 'cache-control: public, max-age=0, must-revalidate', 'x-nextjs-prerender: 1', 'x-vercel-cache: HIT'. Bingbot UA on /pricing: code=200, size=93405 -- identical to the browser fetch. Googlebot-Smartphone UA on /classes/diabetes: code=200, size=90549 -- identical. Googlebot on /robots.txt: 200. CSP is irrelevant to crawlers (they do not enforce it) and in any case next.config.ts:14 only constrains script/connect/frame hosts. There is no Vercel deployment protection, no WAF challenge, no x-robots-tag header on any response I fetched, and no bot-specific edge rule. Conditional GET works: If-None-Match with the /classes/diabetes ETag "xlemmvhf9b1xur" returned 'HTTP/2 304' with 'x-vercel-cache: HIT', so recrawls cost near-zero bandwidth. Brotli is negotiated (content-encoding: br; / is 23,747 B brotli vs 151,354 raw; /classes/diabetes 15,402 B vs 90,549).

**Recommendation.** No action on bot access. One header nit worth fixing: `vary` is 'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch' and does NOT include Accept-Encoding, even though content-encoding: br is negotiated (a request with an empty Accept-Encoding got an uncompressed 90,549-byte body from the same URL). Vercel's own CDN keys on encoding internally so this is safe today, but any intermediate proxy could serve a brotli body to a client that did not ask for it. Add Accept-Encoding to the Vary list in the next.config.ts headers() block alongside the existing securityHeaders.

### [LOW] The 9 standalone landing-pages/*.html are confirmed NOT deployed, and the Capacitor wrapper leaks no indexable artifacts

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** low
- **Locations:** /Users/shalomp/YOGA_WEBSITE/landing-pages/, /Users/shalomp/YOGA_WEBSITE/public/, https://www.myyogaclasses.fit/landing-pages/diabetes.html

**Evidence.** Direct probes all 404: /landing-pages/diabetes.html (404, 25,994 B generic 404 page), /diabetes.html (404), /landing-pages/ (308 then 404). The files live at /Users/shalomp/YOGA_WEBSITE/landing-pages/ (yoga-for-diabetes.html, yoga-for-geriatric.html, yoga-for-hormonal-health.html, yoga-for-hypertension.html, yoga-for-kids.html, yoga-for-mental-health.html, yoga-for-pain-relief.html, yoga-for-prenatal.html, yoga-for-weight-loss.html, REVISION-PLAN.md) and public/ contains only assets, hero-poster.jpg, hero.mp4, logo-email.png -- so nothing static-serves them and there is no duplicate-content exposure against /classes/[slug]. Capacitor probes are equally clean: /.well-known/apple-app-site-association 404, /.well-known/assetlinks.json 404, /capacitor.config.json 404. The generic 404 correctly carries '<meta name="robots" content="noindex">' and '<title>Page not found · My Yoga Classes</title>'. The known-dead Vercel preview alias from the GitHub About sidebar, https://yoga-website-seven-mocha.vercel.app/, returns 404 DEPLOYMENT_NOT_FOUND, so no preview origin is competing either -- and app/layout.tsx:61 `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit")` means any future preview alias would still emit canonicals pointing at www.

**Recommendation.** No fix needed, but two notes. If Universal Links are ever enabled for the iOS wrapper, /.well-known/apple-app-site-association must be served as application/json and should be left crawlable (it is not indexable content); do not add it to robots.txt disallows. And the filenames in landing-pages/ are the keyword-correct slugs the live site lacks ('yoga-for-diabetes' vs the live '/classes/diabetes'): if you ever restructure URLs, that naming is the target, with 308 redirects from /classes/[slug].

### [LOW] Crawl verification summary: 23/23 sitemap URLs are 200 and self-canonical, zero orphans, and the only non-sitemap indexable URL is /login

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** low
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/sitemap.ts:14, https://www.myyogaclasses.fit/sitemap.xml

**Evidence.** I fetched all 23 <loc> values. Every one returned 'HTTP/2 200' with 'x-nextjs-prerender: 1', 'x-nextjs-stale-time: 300', 'cache-control: public, max-age=0, must-revalidate', an ETag, and a self-referential canonical. The single string mismatch is the homepage: sitemap declares 'https://www.myyogaclasses.fit/' while the page declares 'canonical=https://www.myyogaclasses.fit' (no trailing slash) -- Google normalises an empty path to '/', so this is cosmetic. Independent link crawl from / reached 28 paths; set difference against the sitemap gives reachable-but-not-listed = ['/login', '/icon.svg', '/apple-icon.png', '/favicon.ico', '/hero-poster.jpg'] (only /login is HTML), and listed-but-never-linked = [] (no orphans). Rendered word counts across the whole indexable site: /legal/terms 1448, /classes/diabetes 978, / 769, /classes 402, /pricing 330, /reviews 280, /about 246, /faq 195, /teachers 180, /teachers/dr-sangeeta 171, /contact 111, /login 41. Excluding the three legal pages, the entire commercial site is roughly 4,500 rendered words across 20 URLs.

**Recommendation.** Add `alternates: { canonical: "/" }`'s counterpart consistency by changing the sitemap's first entry from `${BASE_URL}/` to `${BASE_URL}` in app/sitemap.ts:14 so the two strings match exactly -- zero functional impact, but it removes the one discrepancy a crawl tool will flag. The substantive number here is the word count: 4,500 words of commercial content against myyogateacher.com's 613 URLs (241 /articles, 116 /yoga-teachers, 84 /yoga-asana, 46 /types-of-yoga, 97 /group-classes) and patanjaleeyoga.com's 417. The technical crawl surface is clean and there is nothing left to fix there; the constraint is now entirely content volume and internal link topology, which is where the remaining budget should go.

---

## performance (19)

### [HIGH] Prioritized savings ledger: 469,743 B removable from the critical path of all 23 URLs without any visual change

- **Verdict:** unverified | **Effort:** substantial | **Impact:** high
- **Locations:** components/marketing/Hero.tsx, app/layout.tsx, app/globals.css, components/marketing/TeacherGrid.tsx, next.config.ts, lib/auth/useViewer.ts, components/shared/NativeBridge.tsx, app/api/region/route.ts

**Evidence.** All figures measured, not estimated. Fonts: Fraunces 120,724 + Inter 48,432 + Geist Mono 23,108 = 192,264 B of 304,008 B preloaded (63.2%), all three proven unused via `document.fonts` status `unloaded`. JS: supabase-js chunk 64,489 B brotli / 241,808 B parsed, plus up to 16,519 B brotli of Capacitor, against a real modern-browser baseline of 445,844 B brotli / 1,412,945 B parsed across 27 files. Images: below-fold priority avatar 114,480 B; hero poster 49,915 B to ~20,028 B as a 900 px portrait WebP. Desktop-only: hero.mp4 1,295,397 B to 566,771 B (AV1) or 588,972 B (H.264 CRF 30). Latency: /api/region 297-327 ms measured, ~250 ms of it function round trip to iad1.

**Recommendation.** Ship in this order. (1) Hero opacity:0 to a CSS keyframe, quick-win, unblocks the headline and CTA from a ~446 KB JS hydration gate, the single largest perceived-speed and conversion fix. (2) Drop Inter + Fraunces + Geist Mono, quick-win, -192,264 B on every page. (3) Remove `priority` from TeacherGrid.tsx:87, quick-win, -114,480 B from the pre-LCP window on /. (4) Add `formats: ['image/avif','image/webp']` and the immutable cache headers to next.config.ts, quick-win, -30 to -45 KB per photo plus one RTT off repeat LCP. (5) Re-encode hero-poster as a 900 px portrait WebP, -29,887 B on the LCP resource itself and it stops being blurry. (6) Drop supabase-js from the marketing bundle, moderate, -64,489 B brotli / -241,808 B parsed and the biggest single cut to the hydration window that gates item 1. (7) Dynamic-import Capacitor, quick-win, up to -16,519 B. (8) Move /api/region to the edge runtime, moderate, -200 to -250 ms before prices render for every non-US visitor. (9) Re-encode hero.mp4, -706,425 B desktop-only. (10) Android fallback metrics for Cormorant Garamond, moderate, protects CLS on the condition pages where it is the LCP element. Items 1 through 5 and 7 are all quick wins and together remove 469,743 B from the critical path of all 23 indexable URLs.

### [MEDIUM] 169,156 bytes of fonts (Inter + Fraunces) are preloaded on every one of the 23 pages and render zero visible glyphs anywhere on the site

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** app/layout.tsx, app/globals.css, https://www.myyogaclasses.fit/, https://www.myyogaclasses.fit/classes/diabetes, https://www.myyogaclasses.fit/pricing

**Evidence.** Six `<link rel=preload as=font>` tags at HTML byte offsets 415-1207, before the stylesheets at 3359/3452. Measured latin-subset sizes: Fraunces `b67966e0b83b2cd0-s.p.04y9-s23ppywx.woff2` = 120,724 B; Inter `83afe278b6a6bb3c-s.p.0q-301v4kxxnr.woff2` = 48,432 B; Cormorant roman `01e4147c…` = 37,776 B; Cormorant italic `8bd76523…` = 39,304 B; Hanken `c47649aa…` = 34,664 B; Geist Mono `797e433a…` = 23,108 B. Total 304,008 B. app/globals.css:10 and :12 set `--font-sans: var(--font-inter)` and `--font-heading: var(--font-fraunces)` at `:root`, but globals.css:173-174 overrides BOTH inside `.myc-theme, .myc-app`, and every route group applies one of those: app/(marketing)/layout.tsx:30, app/(auth)/layout.tsx:6, app/(dashboard)/layout.tsx:23, app/admin/layout.tsx:11, app/(teacher)/layout.tsx:24 and :44, app/error.tsx:24, app/not-found.tsx:9. Live proof on /classes/diabetes: `[...document.fonts].map(f=>f.family+' '+f.status)` returned `"Inter unloaded"`, `"Fraunces unloaded"`, `"Geist Mono unloaded"` against `"Cormorant Garamond loaded"`, `"Hanken Grotesk loaded"`. The 88 elements whose computed font-family contains "Inter" are all non-rendering nodes: HTML, HEAD, META, LINK, TITLE, STYLE, SCRIPT.

**Recommendation.** CORRECTED FINDING
Title: Five font families are preloaded on all 23 pages; Inter (48,432 B) renders nothing anywhere, Fraunces (120,724 B) renders nothing on any indexable page, and Geist Mono (23,108 B) renders on /pricing only.

Corrected evidence: keep the byte counts and offsets verbatim, they are exact. Replace "render zero visible glyphs anywhere on the site" with: Inter renders zero glyphs site-wide (verified: sonner's toaster, the only body-level portal outside the `.myc-theme` wrapper, ships its own hardcoded system stack). Fraunces renders zero glyphs on all 23 indexable pages, but DOES render on logged-in surfaces, because the compiled CSS baked `.font-heading{font-family:var(--font-fraunces), Georgia, serif}` and `.myc-theme` cannot override a baked utility. Live probe inside `.myc-theme` computes `Fraunces, "Fraunces Fallback", Georgia, serif`. Applied by components/ui/card.tsx:41, dialog.tsx:129, sheet.tsx:111, drawer.tsx:103. Also note globals.css:10/12 are inside `@theme inline`, not `:root`.

Corrected severity: medium, not critical. display:swap + same-origin + immutable caching means nothing is render-blocked; this is first-visit bandwidth contention ahead of the /hero-poster.jpg LCP preload. Realistic LCP delta 150-850 ms depending on connection. Real and free to fix, but not a ranking-critical defect.

Corrected recommendation:
1. Delete the Inter import from app/layout.tsx lines 17-21 and drop `${inter.variable}` from line 122. Change app/globals.css:10 to `--font-sans: var(--font-hanken), system-ui, -apple-system, sans-serif;`. Zero visual change, verified. Saves 48,432 B on all 23 pages.
2. For Fraunces, delete lines 23-28 (NOT 17-27, which leaves a dangling `});`), drop `${fraunces.variable}` from line 122, and change app/globals.css:12 to `--font-heading: var(--font-cormorant), Georgia, serif;`. Recompiling `.font-heading` to Cormorant actually FIXES a live inconsistency: today an admin CardTitle renders Fraunces while the `<h2>` beside it renders Cormorant. Flag this as an intentional typography change on /dashboard, /admin, /teacher and BankTransferDialog, not as "zero visual change". If the team wants to keep Fraunces on those surfaces, the conservative alternative is `preload: false` on the Fraunces import, which removes the preload tag from all 23 pages while leaving the face available.
3. Add `preload: false` to the Geist_Mono import (app/layout.tsx:30-34). It renders only in the /pricing promo-code input and will still load on demand there.
Total removed from the critical path: 169,156 B on /pricing, 192,264 B (63.2%) on the other 22 URLs.
Verify after deploy with `[...document.fonts].map(f=>f.family+' '+f.status)` on /classes/diabetes AND with a `<div class="font-heading">` probe injected inside `.myc-theme` on an /admin page.

### [MEDIUM] A below-fold teacher avatar is marked priority, so 114,480 B of WebP is preloaded at High priority and races the LCP image and the render-blocking CSS

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** components/marketing/TeacherGrid.tsx, https://www.myyogaclasses.fit/

**Evidence.** components/marketing/TeacherGrid.tsx:87 `priority={i === 0}` causes Next to emit `<link rel="preload" as="image" imageSrcSet="…" imageSizes="(max-width: 640px) 100vw, …">` at HTML byte offset 1263, ahead of the stylesheets at 3359. Fetching the w=750 variant with an AVIF-capable Accept header returns `content-type: image/webp`, `content-length: 114480`. The teacher grid sits several viewports below the hero on /, so this image is never in the first viewport on mobile. It is preloaded ahead of `/hero-poster.jpg` (49,915 B), which is the actual LCP element.

**Recommendation.** CORRECTED FINDING (severity: medium)

Title: The first teacher avatar on / is marked priority, so 114,480 B (DPR 2) to 289,698 B (DPR 3) of below-fold WebP is eagerly preloaded and competes for bandwidth with the 49,915 B LCP poster.

Evidence: components/marketing/TeacherGrid.tsx:87 `priority={i === 0}` makes Next emit `<link rel="preload" as="image" imageSrcSet="…" imageSizes="(max-width: 640px) 100vw, (max-width: 1200px) 33vw, 280px"/>` at HTML byte 1263, and suppresses the `loading="lazy"` that cards 2 and 3 get. Measured at 375x812: `#teachers` top = 3359.7 px = 4.14 viewports below the hero, card renders 325x434 CSS px, currentSrc = the w=750 variant, transferSize 114480 (content-type image/webp). At DPR 3 the same `sizes` selects w=1200 = 289,698 B. Note the preload carries no fetchpriority, so it is Low priority in Chrome, and `/hero-poster.jpg` (49,915 B) is preloaded ahead of it at byte 1207, not behind it. The cost is bandwidth contention on slow mobile plus pure wasted data, not preload-queue displacement.

Recommendation:
1. Add an opt-in prop rather than flipping the flag globally, because the same component is above the fold on /teachers (first card top = 590 px, inside the first viewport). In TeacherGrid.tsx add `priorityFirst = false` to TeacherGridProps, change line 87 to `priority={priorityFirst && i === 0}`, pass `priorityFirst` from app/(marketing)/teachers/page.tsx:30 and leave app/(marketing)/page.tsx:59 as is. No `loading="lazy"` needed: next/image emits it automatically once priority is false.
2. Fix `sizes` for the real one-column phone layout, do not use 50vw. The grid is `repeat(auto-fill,minmax(240px,1fr))` inside `px-6`, so the card is 100vw minus 48 px. Use `sizes="(max-width: 640px) calc(100vw - 48px), (max-width: 1200px) 33vw, 280px"`, which selects w=640 (80,522 B) instead of w=750 at DPR 2, saving a further 33,958 B, and keeps the /teachers above-fold card sharp.
3. Higher-value adjacent fix the original finding missed: /hero-poster.jpg is served from /public as a 49,915 B JPEG with `cache-control: public, max-age=0, must-revalidate`. Route the real LCP image through next/image (or give it an immutable hashed filename) so it is WebP/AVIF and cacheable. That moves LCP more than the avatar change does.

All three are code-only changes in the (marketing) group. None touch DB-driven copy, the CSP allow-list, cookies()/ISR, or any user-facing string.

### [MEDIUM] @supabase/supabase-js (64,489 B brotli / 241,808 B parsed) ships to every marketing visitor purely to decide whether the nav says "Sign in"

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** lib/auth/useViewer.ts, components/marketing/MarketingNav.tsx, components/marketing/StickyMobileCTA.tsx

**Evidence.** Chunk `/_next/static/chunks/0rug-8xigz9co.js` measures 64,489 B brotli / 241,808 B identity and contains 100 matches for `supabase|GoTrueClient|PostgrestClient|RealtimeClient` and nothing else identifiable. It is loaded on the homepage. The cause is lib/auth/useViewer.ts calling `createSupabaseBrowserClient()`, consumed by components/marketing/MarketingNav.tsx:10 and components/marketing/StickyMobileCTA.tsx:8. Both files document it as display-only: "Display only. Every real gate is middleware plus the server guards." It is the largest single chunk after the React DOM runtime (`0nwvf~lp322dq.js`, 74,388 B br).

**Recommendation.** CORRECTED FINDING

Title: @supabase/supabase-js (64,489 B brotli / 241,808 B parsed) ships to every marketing visitor through THREE separate static imports, for a nav label, a CTA href and a sign-out call.

Evidence: Chunk /_next/static/chunks/0rug-8xigz9co.js measures 64,489 B brotli / 241,808 B identity, contains exactly 100 matches for supabase|GoTrueClient|PostgrestClient|RealtimeClient and no other identifiable library, and is loaded as `<script async>` on /, /faq, /teachers and /classes/diabetes. It is the 2nd largest of the 28 homepage chunks. Three static import chains pull it in:
  1. lib/auth/useViewer.ts:4 -> components/marketing/MarketingNav.tsx:10 (in app/(marketing)/layout.tsx:37, so all 23 URLs) and components/marketing/StickyMobileCTA.tsx:7 (homepage only).
  2. components/shared/SignOutButton.tsx:6 -> components/marketing/AccountMenu.tsx:18 -> MarketingNav.tsx:9. Also all 23 URLs.
  3. components/marketing/PricingTeaser.tsx:17, rendered on / (page.tsx:60) and /pricing (page.tsx:27).
This is TBT/INP cost, not LCP: the script is async, the H1 "Find your 1:1 yoga teacher." is in the server HTML, and /hero-poster.jpg is preloaded as an image, so the hero does not wait on hydration.

Corrected recommendation: all three chains must go in the same change or the byte saving is zero.
  1. useViewer.ts: replace createSupabaseBrowserClient() with a document.cookie read. Derive the ref from NEXT_PUBLIC_SUPABASE_URL rather than hard-coding fjwffujcnpltkpfrgpdx. Reassemble the chunked cookies sb-<ref>-auth-token, sb-<ref>-auth-token.0, .1 in index order, strip the leading `base64-` prefix, base64url-decode the JWT payload for sub/email/exp, and treat signedIn as true only while exp is in the future. Fetch the role with a bare fetch to `${url}/rest/v1/profiles?select=role&id=eq.${sub}` carrying apikey and Authorization headers. connect-src already allows https://*.supabase.co, so no CSP edit is needed. Replace onAuthStateChange with a `storage` event listener or a visibilitychange re-read to keep cross-tab sign-out working.
  2. AccountMenu.tsx: change `import { performSignOut }` to a dynamic `await import("@/components/shared/SignOutButton")` inside the click handler, so the SDK loads only when someone actually signs out.
  3. PricingTeaser.tsx: drop the SDK entirely. startBuy() only needs user.id/user.email, which the same cookie helper already yields, so the auth.getUser() call at line 176 can read from the shared helper and the import at line 17 can be deleted.
Net effect: the SDK is code-split out of the (marketing) group and stays in (auth) and (dashboard) where refresh and realtime are genuinely needed. Expected saving ~64 KB brotli / ~242 KB parse on all 23 indexable URLs, improving INP and TBT. It will not move LCP.

### [MEDIUM] The LCP image is served with cache-control: max-age=0, must-revalidate and is the wrong aspect ratio and format for the viewport it fills

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** public/hero-poster.jpg, components/marketing/HeroVideo.tsx, next.config.ts

**Evidence.** `curl -I https://www.myyogaclasses.fit/hero-poster.jpg` returns `cache-control: public, max-age=0, must-revalidate`, `content-type: image/jpeg`, `content-length: 49915`. `sips` reports the source is 1280x720 landscape. Live at 375x812 the element measures 457.5 x 1198.05 CSS px (`object-cover scale-[1.22]` inside a full-bleed hero), so a 720 px-tall source is stretched to 1198 CSS px and, at DPR 2-3, to 2396-3594 device px. It is the LCP element on mobile: it is the only above-fold image, it is `rel=preload as=image`, and the H1 is excluded from LCP candidacy by `opacity:0`. Re-encodes I ran: WebP q70 = 33,884 B (-32%), WebP q62 = 30,846 B (-38%), and a 900 px-wide portrait crop at WebP q65 = 20,028 B (-60%).

**Recommendation.** CORRECTED FINDING (severity: medium)

Title: The LCP poster is an unoptimized 49,915 B JPEG served with max-age=0, bypassing the image optimizer that already serves it as a 29,020 B WebP.

Evidence: `curl -sI https://www.myyogaclasses.fit/hero-poster.jpg` → `cache-control: public, max-age=0, must-revalidate`, `content-type: image/jpeg`, `content-length: 49915`. Source is 1280x720 (sips). Rendered at 375x812 it measures 457.5 x 1198.05 CSS px (object-cover scale 1.664, i.e. upscaled). It is the mobile LCP element: preloaded (`<link rel="preload" as="image" href="/hero-poster.jpg">`, resource initiatorType "link"), the only above-fold image, and the H1 is SSR'd inside `<div style="opacity:0;...">` so it is not a first-paint candidate. The optimizer already handles this file: `/_next/image?url=%2Fhero-poster.jpg&w=1080&q=75` returns `content-type: image/webp`, `content-length: 29020`. HeroVideo.tsx:13 documents a "~30 KB poster" budget the shipped 49,915 B file exceeds by 66%.

RECOMMENDATION (one change, not three):

In components/marketing/HeroVideo.tsx, replace the raw `<img>` at line 118 and delete the now-stale eslint-disable at line 117:

  import Image from "next/image";
  import posterSrc from "@/public/hero-poster.jpg";
  ...
  <Image src={posterSrc} alt="" aria-hidden priority quality={75} sizes="100vw" className={className} />

Keep `const POSTER_SRC = "/hero-poster.jpg"` only if the `<video poster>` attribute at line 128 still needs a string; otherwise use `posterSrc.src`.

This single edit does all four jobs the original recommendation split across three files:
(a) Cache. The static import emits the file to `/_next/static/media/<buildhash>.jpg`, which this deployment already serves with `cache-control: public,max-age=31536000,immutable` (verified on a font asset). No next.config.ts headers() entry, no manual content hash. This also fixes the optimizer's own cache-control, which currently inherits max-age=0 from the unhashed upstream.
(b) Format. AVIF/WebP negotiation via /_next/image. Measured 29,020 B at w=1080&q=75, better than the hand-encoded q70 (33,884 B) and q62 (30,846 B).
(c) Responsive sizes. `sizes="100vw"` picks a 384/640/750 candidate on a 375 px viewport instead of always shipping the full 1280 px source.
(d) Preload. `priority` emits `<link rel="preload" as="image" imageSrcSet imageSizes>` correctly, matching what the browser will actually fetch. A hand-rolled `<picture>` would leave the framework preloading the JPEG fallback while the browser fetches the WebP source, a double download and an LCP regression.

Caveat verified on the live site: Next 16 restricts allowed `q` values. `q=70` and `q=100` both return `HTTP 400 INVALID_IMAGE_OPTIMIZE_REQUEST`; `q=75` returns 200. Use `quality={75}` or add the value to `images.qualities` in next.config.ts.

No CSP change is needed: `img-src 'self'` already covers `/_next/image` and `/_next/static`. No ISR impact. No copy change, so no DB-driven-copy or em-dash concern.

DROP the portrait-crop step. My own 900 px portrait crop at q65 came to 23,204 B, not the claimed 20,028 B, a ~6 KB gain over the 29,020 B optimizer output, and the poster sits under a 78-92% scrim on mobile (Hero.tsx:94-101) so the sharpness argument is cosmetic. Not worth a second asset plus a hand-rolled preload.

Expected impact: LCP byte cost 49,915 B → ~29,020 B (or lower at 640-750 px candidates), plus one saved conditional RTT per repeat visit. Roughly 110 ms of LCP at 1.5 Mbps. Worth doing as cheap hygiene; it is not a ranking lever next to the 23-URL index footprint.

### [MEDIUM] Capacitor native-shell code is bundled into the web build via a static import in the root layout

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** components/shared/NativeBridge.tsx, app/layout.tsx, lib/native/capacitor.ts

**Evidence.** components/shared/NativeBridge.tsx:4 does a top-level `import { setupNativeApp } from "@/lib/native/capacitor"`, and NativeBridge is rendered unconditionally in app/layout.tsx:137, so it is on every page including all 23 marketing URLs. Chunk `/_next/static/chunks/0zz_bgmv-k_p3.js` is 16,519 B brotli / 51,467 B identity and contains 12 matches for `Capacitor`, alongside lucide icons. package.json lists six `@capacitor/*` runtime dependencies (app, browser, camera, push-notifications, splash-screen, status-bar). The component's own docstring says it "no-ops on the web", but the no-op happens at runtime, after the bytes have been downloaded and parsed.

**Recommendation.** Make the import dynamic so the bundler can split it out: in NativeBridge.tsx replace the top-level import with `useEffect(() => { if (!(window as any).Capacitor?.isNativePlatform?.()) return; void import("@/lib/native/capacitor").then(m => m.setupNativeApp()); }, [])`. The `window.Capacitor` global only exists inside the native shell, so web visitors never issue the dynamic import. Recovers most of that 16,519 B brotli / 51,467 B parse on every web page view, and keeps the iOS bridge behaviour identical.

### [MEDIUM] AVIF is not enabled, so every teacher photo is served as WebP at roughly 30-40% more bytes than necessary

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** next.config.ts, https://www.myyogaclasses.fit/teachers

**Evidence.** next.config.ts `images` block sets only `remotePatterns` and never sets `formats`, so Next 16's default of `['image/webp']` applies. Requesting the homepage teacher avatar with `Accept: image/avif,image/webp,image/*,*/*` returns `content-type: image/webp`, `content-length: 114480` for the w=750 variant, i.e. the optimizer never offers AVIF even to a browser that advertises it. Three `/_next/image` URLs on the homepage, and the /teachers listing and every /teachers/[slug] detail page are photo-led.

**Recommendation.** Add `formats: ["image/avif", "image/webp"]` to the `images` block in next.config.ts. Next serves AVIF only to browsers that send it in Accept and falls back to WebP otherwise, so there is no compatibility risk. At equal visual quality AVIF is typically 25-45% smaller than WebP for photographic content, so the w=750 avatar drops from 114,480 B to roughly 65,000-85,000 B. This compounds with removing `priority` from the first avatar and matters most on /teachers, where the grid is above the fold and the images are the LCP element. Note that the AVIF encode is slower on a cold miss, which is fine here because `x-vercel-cache` was already HIT and these are ISR pages with a 300 s stale window.

### [MEDIUM] INP risk is real but is dominated by hydration, not by Lenis: Lenis leaves touch scrolling native while running a permanent rAF loop on mobile

- **Verdict:** unverified | **Effort:** moderate | **Impact:** medium
- **Locations:** components/shared/LenisProvider.tsx, components/marketing/MarketingNav.tsx, components/marketing/StickyMobileCTA.tsx

**Evidence.** Live at 375x812, `document.documentElement.className` ends in `lenis light`, so Lenis is active on mobile, not just desktop. components/shared/LenisProvider.tsx configures `{lerp: 0.2, wheelMultiplier: 1.2, autoRaf: true}` and does not set `syncTouch`, which defaults to false in lenis ^1.1.20, so touch scrolling stays native and is not driven off the main thread's rAF. The provider does correctly skip Lenis entirely under `prefers-reduced-motion: reduce`. Two separate components attach their own scroll listeners that call setState: MarketingNav.tsx:36-39 (`setScrolled(window.scrollY > 12)`) and StickyMobileCTA.tsx:18-21 (`setShow(window.scrollY > 600)`), both correctly `{passive: true}` and both boolean-guarded. Against that, 27 async chunks totalling 1,412,945 B of parsed JS all execute during hydration on one main thread.

**Recommendation.** Do not remove Lenis for INP reasons on mobile: it is not intercepting touch, and `autoRaf` costs roughly 0.2-0.5 ms per frame. The INP lever that matters is shrinking the hydration window, which the Supabase, Capacitor and font cuts above do directly. Two cheap additions: (1) add `if (!window.matchMedia('(min-width: 768px)').matches) return;` to the LenisProvider effect so phones, where Lenis smooths nothing because touch is native anyway, never pay the rAF loop or the ~10 KB brotli; (2) merge the two scroll listeners into one shared `useSyncExternalStore` scroll store so a single passive listener feeds both the nav and the sticky CTA instead of two listeners each re-rendering their own subtree.

### [MEDIUM] One 142,842 B render-blocking stylesheet is shared across marketing, dashboard and admin, so every public visitor downloads the admin table CSS

- **Verdict:** unverified | **Effort:** moderate | **Impact:** medium
- **Locations:** app/globals.css, app/(dashboard)/layout.tsx, app/admin/layout.tsx, https://www.myyogaclasses.fit/

**Evidence.** Two render-blocking `<link rel=stylesheet data-precedence="next">` tags on the homepage: `/_next/static/chunks/0cs7r0nbk1f.m.css` at 22,672 B brotli / 142,842 B identity, and `/_next/static/chunks/0dc_ubdc1aud9.css` at 2,013 B brotli / 22,426 B identity, 24,685 B brotli / 165,268 B identity combined. The large file contains the full `@font-face` set for all five families plus the `.myc-pill-*` status-pill tokens that globals.css documents as "dense tables in dashboard + admin" (globals.css:180-189) and the `.myc-app` skin, none of which any of the 23 public URLs use. It is the only resource between HTML and first paint, and it is queued at byte offset 3359, behind all six font preloads.

**Recommendation.** Two steps, in order. First, cutting Inter, Fraunces and Geist Mono removes roughly 20 of the 60-odd `@font-face` rules in that file, which is a meaningful slice of it. Second, if you want the rest, move the `.myc-app`-only blocks (the status pills at globals.css:180-189, `.myc-sharp`, and the dashboard table rules) out of app/globals.css into a `app/(dashboard)/app-skin.css` imported from the dashboard and admin layouts, so Turbopack emits them as a separate stylesheet that public routes never request. Also note the ordering problem independent of size: the six font preloads at byte offsets 415-1207 are High priority and are discovered by the preload scanner BEFORE the stylesheets at 3359, so on a constrained mobile link 304,008 B of fonts contend with the 24,685 B of CSS that actually blocks first paint. Removing 192,264 B of that font weight fixes the ordering problem without needing to reorder anything.

### [MEDIUM] Static assets under /public are served with max-age=0, forcing a conditional request for the LCP image and the 1.27 MB hero video on every repeat view

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** next.config.ts, public/hero-poster.jpg, public/hero.mp4, public/logo-email.png, public/assets/logo-banner.png

**Evidence.** `/hero-poster.jpg` returns `cache-control: public, max-age=0, must-revalidate` (49,915 B) and `/hero.mp4` returns the same (1,295,397 B). Compare `/_next/static/chunks/turbopack-0rk6640gqtwnr.js`, which returns `cache-control: public,max-age=31536000,immutable`, and the optimized `/_next/image` output, which returns `public, max-age=14400, must-revalidate`. next.config.ts's `headers()` currently returns a single `{source: "/:path*", headers: securityHeaders}` rule and sets no caching directives at all, so /public falls through to the Next default. Two of the three files in /public are the hero poster and the hero video, and the poster is the LCP element on mobile.

**Recommendation.** Content-hash the two hero assets (e.g. `hero-poster.4f3a1c.webp`, `hero.4f3a1c.av1.mp4`) and add a second entry to the `headers()` array in next.config.ts: `{source:'/hero-:slug*',headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]}`. Saves a full RTT before LCP on every repeat mobile visit (~30 ms from the US, ~90 ms from the EU, ~250 ms from India) and removes a 1.27 MB revalidation from every desktop repeat visit. Also worth noting for completeness: public/logo-email.png (78,871 B) and public/assets/logo-banner.png (81,920 B) have zero references anywhere in app, components, lib or emails, so they are 160,791 B of dead weight in the deploy. No browser fetches them, so this is housekeeping rather than a perf win, but they should go or be documented.

### [LOW] Hero headline, subhead and the primary CTA are server-rendered at opacity:0 and stay invisible until ~446 KB of JS hydrates

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** components/marketing/Hero.tsx, app/globals.css, https://www.myyogaclasses.fit/

**Evidence.** Server HTML at https://www.myyogaclasses.fit/ contains `<div style="opacity:0;transform:translateY(24px)">` wrapping the H1, the subhead and both buttons (source: components/marketing/Hero.tsx:110-114, `<motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }}>`). Live Chromium at 375x812: `getComputedStyle(document.querySelector('h1').parentElement).opacity` returned `"0"` on one sample and `"0.167654"` with `transform: matrix(1,0,0,1,0,19.98)` on a later sample, i.e. the fade only begins after hydration and then takes 900 ms. A screenshot taken during that window shows a dark teal image with no readable headline and no CTA. The gate is 27 modern-browser JS chunks totalling 445,844 B brotli / 1,412,945 B raw, all `async`.

**Recommendation.** CORRECTED FINDING
Title: Hero H1, subhead and both CTAs are server-rendered at opacity:0 and stay invisible until Motion hydrates. No Core Web Vitals impact, but the primary CTA is blank for the first frames.
Severity: low (as an SEO/performance item). Worth fixing on conversion grounds, since CLAUDE.md states the above-fold CTA "must be visible in viewport 1 on every device", but it should not displace sitemap/content/internal-linking work.

CORRECTED EVIDENCE
- Server HTML at https://www.myyogaclasses.fit/ contains `<div style="opacity:0;transform:translateY(24px)">` wrapping the badge, `<h1>Find your 1:1 yoga teacher.</h1>`, the subhead and both buttons. Source: components/marketing/Hero.tsx:113-117 (not 110-114); a second identical wrapper is at :180-212.
- 20 `opacity:0` reveal wrappers total in the homepage HTML.
- JS gate: 29 chunk requests, 470,529 B encoded / 1,577,787 B decoded (measured live, higher than the 27 / 445,844 / 1,412,945 originally claimed).
- Do NOT cite the getComputedStyle samples or the dark-teal screenshot as evidence. They were taken with `document.visibilityState === "hidden"`, where Chrome throttles rAF and emits no paint or LCP entries at all, so they measure the harness, not the site.

WHAT MUST BE STRUCK
Delete the sentence "This also removes the risk that Chrome picks the H1 as the LCP element on narrow/short viewports and timestamps LCP at hydration." It is false. `/hero-poster.jpg` (49,915 B, `<link rel="preload" as="image">`, in the server HTML, outside every opacity wrapper, opacity 1 all the way up the ancestor chain) is `absolute inset-0` inside a `min-h-[100svh]` section, so it occupies 100% of viewport 1 at every size. Measured at 375x812: poster 304,500 px2 vs H1 33,395 px2, a 9.1x margin, at 0.73 bpp (far above the 0.05 bpp low-entropy cutoff). It is the LCP element and it paints at ~200 ms with no JS. LCP, FCP and CLS are all unaffected by the hydration gate. The hero text is also fully present in the raw HTML, so indexing is unaffected.

RECOMMENDATION (keep as written, it is correct and idiomatic)
Replace the `motion.div` at components/marketing/Hero.tsx:113 with `<div className="myc-hero-reveal">` and add to app/globals.css, alongside the existing `myc-*` keyframes:
@keyframes myc-hero-in{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
.myc-hero-reveal{animation:myc-hero-in .9s cubic-bezier(.2,.7,.2,1) both}
@media (prefers-reduced-motion:reduce){.myc-hero-reveal{animation:none}}
`both` reproduces the initial state without JS and the animation starts at first style resolution instead of at hydration. This is also a genuine accessibility improvement: the current Motion wrapper ignores `prefers-reduced-motion`, while globals.css lines 356-363 and 633-636 already honour it for every other hero animation. Apply the same treatment to the second wrapper at :180. Keep Motion for the below-fold `whileInView` reveals. Expected measurable gain: none in Core Web Vitals; the gain is that the "Book a 1:1 session" button is painted and clickable from first paint rather than after 470 KB of JS.

### [LOW] Geist Mono (23,108 B) is preloaded sitewide for a single promo-code input's letterforms

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** components/marketing/PricingTeaser.tsx, app/layout.tsx, app/globals.css

**Evidence.** `797e433ab948586e-s.p.08e28id.o-okb.woff2` = 23,108 B, preloaded on / and on /classes/diabetes. `grep -rn 'font-mono' app components lib` returns exactly one marketing hit: components/marketing/PricingTeaser.tsx:258, `"text-center font-mono uppercase tracking-wide"` on the optional promo-code `<Input>`. The other five hits are admin-only (TeacherEditPanel.tsx:114, PaymentsAdmin.tsx:98, DiscountsAdmin.tsx:207 and :257) plus BankTransferDialog.tsx:80. Live on /classes/diabetes, the count of elements computing to a Geist font family is 0, and `document.fonts` reports `"Geist Mono unloaded"`.

**Recommendation.** Title: Geist Mono (23,108 B) is preloaded on every page but only renders on / and /pricing

Severity: low.

Corrected evidence: `797e433ab948586e-s.p.08e28id.o-okb.woff2` = 23,108 B, confirmed "Geist Mono Regular" from its name table, preloaded on /, /pricing and /classes/diabetes. It is the smallest of six preloaded faces totalling 304,008 B, and 1.14% of the homepage's 2,030,065 B of decoded resources. Live on /classes/diabetes: 0 elements compute to a Geist family and all six Geist Mono faces report `unloaded`, with the preload link as the sole fetch initiator. Live on /, exactly one element uses it, `INPUT#promo-code` (components/marketing/PricingTeaser.tsx:258), and one face reports `loaded`. It is also used by components/shared/BankTransferDialog.tsx:80, which is customer-facing, not admin.

Corrected recommendation: in app/layout.tsx, add `preload: false` to the existing `Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" })` call. Verified against this repo's Next 16.2.6: `preload` defaults to true in @next/font's validate-google-font-function-call.js and is what gates the emitted preload link. This drops 23,108 B from the critical path on all 23 indexable URLs including every condition page, and lets the font download lazily only where the promo input or the bank-transfer dialog actually renders. Do NOT change PricingTeaser.tsx:258 from `font-mono` to `tracking-[0.18em]`: monospaced letterforms on a hand-typed promo-code field are a legibility affordance (0 vs O, 1 vs l), and they are not worth trading away for bytes that `preload: false` already reclaims. Leave app/globals.css:11 alone; note that if anyone does remove the Geist_Mono import, that line must be deleted in the same change, because `--font-mono: var(--font-geist-mono)` has no fallback stack and would resolve to nothing.

Expected saving from this item alone: 23,108 B off the critical path per cold page load, 7.6% of the font budget. Do not attribute the 63.2% figure to this finding; that belongs to the separate Inter/Fraunces cut.

### [LOW] hero.mp4 is under-compressed by more than half: 1,295,397 B of H.264 where 566,771 B of AV1 or 588,972 B of H.264 CRF 30 is equivalent

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** medium
- **Locations:** public/hero.mp4, components/marketing/HeroVideo.tsx, next.config.ts

**Evidence.** `ffprobe`: h264, 1280x720, 24 fps, 10.000 s, 1,033,326 bps, file 1,295,397 B, served with `cache-control: public, max-age=0, must-revalidate`. Real re-encodes I ran on the actual file: SVT-AV1 preset 9 CRF 36 at 720p = 566,771 B (-56.2%); SVT-AV1 preset 9 CRF 38 at 960x544 = 421,320 B (-67.5%); plain libx264 preset slow CRF 30 at 720p = 588,972 B (-54.5%). This is a decorative loop behind a scrim that also carries a `mix-blend-mode` colour grade, so it is not quality-critical.

**Recommendation.** Corrected finding (severity: low, performance/egress, not a ranking issue):

TITLE: hero.mp4 ships 1,295,397 B of H.264 where AV1 holds the same quality in ~812 KB. Desktop-only, post-hydration, so no Core Web Vitals impact.

EVIDENCE: `ffprobe` → h264, 1280x720, 24 fps, 10.000 s, 1,033,326 bps, 1,295,397 B, no audio track. Served with `cache-control: public, max-age=0, must-revalidate`. The file is absent from server HTML (0 occurrences), is not preloaded, and mounts only after hydration behind HeroVideo.tsx:33's `matchMedia('(min-width: 768px)')` plus saveData/2g-3g guards, so it never competes with the preloaded `/hero-poster.jpg` LCP candidate and is never fetched on mobile.

CONTEXT THE ORIGINAL FINDING MISSED: commit 45dff3e (2026-09-12) deliberately raised this file from 339,799 B to its current size, titled "sharpen the hero video", after explicitly rejecting a 960px high-CRF encode as one that "reads soft". Any recommendation must preserve that quality decision, not reverse it.

MEASURED OPTIONS (SSIM vs the current file, all encodes run on the real asset):
- SVT-AV1 preset 6 CRF 26 → 1,027,537 B (-20.7%), SSIM 0.9912
- SVT-AV1 preset 6 CRF 30 → 812,650 B (-37.3%), SSIM 0.9903  ← recommended
- SVT-AV1 preset 9 CRF 36 → 582,027 B (-55.1%), SSIM 0.9858
- libx264 slow CRF 30 → 588,972 B (-54.6%), SSIM 0.9829  ← do not use, lowest quality of the set

RECOMMENDATION: add `/hero.av1.mp4` at SVT-AV1 preset 6 CRF 30 (812,650 B, SSIM 0.9903, a 482,747 B saving that is visually indistinguishable and so does not undo 45dff3e). Do not ship the CRF 36 or the x264 CRF 30 variants, and do not reintroduce a 960px downscale.

To wire it up, the `src` attribute must be REMOVED, because a `<video>` with `src` ignores `<source>` children. Change HeroVideo.tsx:120-133 from a self-closing element with `src={VIDEO_SRC}` to:

  <video ref={videoRef} autoPlay muted loop playsInline preload="auto" poster={POSTER_SRC} aria-hidden="true" tabIndex={-1} className={className} style={{ filter: "var(--myc-vid-filter)" }}>
    <source src={VIDEO_AV1_SRC} type='video/mp4; codecs="av01.0.05M.08"' />
    <source src={VIDEO_SRC} type="video/mp4" />
  </video>

Verify the codec string against the actual encode (`ffprobe -show_entries stream=profile,level`) rather than hardcoding it; a wrong string fails safe to the H.264 source but silently wastes the AV1 file. No CSP change is required, since `media-src 'self'` in next.config.ts already covers a same-origin file.

CACHING: correct the original claim. A repeat view today returns HTTP 304 with an empty body, not 1.27 MB, so the current cost is one round trip, not a re-download. Improving it is optional. If you do, do NOT apply `immutable` to the unhashed `/hero.mp4` path, since the bytes get replaced in place; give the file a content-hashed name first, then add a `source: "/hero.:hash.mp4"` entry alongside `securityHeaders` in next.config.ts:54.

### [LOW] /api/region runs on the Node runtime as force-dynamic with no-store, costing a measured 297-327 ms before any price renders

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** app/api/region/route.ts, components/marketing/PricingTeaser.tsx, lib/razorpay/catalog.ts

**Evidence.** app/api/region/route.ts:8-10 declares `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`, and returns `Cache-Control: private, no-store`. Four timed calls: ttfb=0.3079, 0.3228, 0.2973, 0.3270 s against tls=0.0566 s, so ~250 ms of pure function round trip. `x-vercel-id: bom1::iad1::…` on every call versus `bom1::…` alone on static assets, which is how I located the function region as iad1. components/marketing/PricingTeaser.tsx:88-96 fetches it on mount on / and /pricing, and the component renders DEFAULT_CURRENCY (INR) on the server, swaps to a timezone guess after mount, then swaps again when this resolves: two post-load currency swaps inside a flow-layout grid.

**Recommendation.** Corrected finding: "/api/region is a Node function pinned to iad1 while the site is served from the bom1 PoP, adding ~180 ms to a currency correction that affects only UAE visitors."

Corrected evidence: /api/region measures ttfb 0.2953-0.3244 s against tls 0.0563 s, versus /pricing at 0.1138-0.1279 s with `x-nextjs-prerender: 1`. `x-vercel-id: bom1::iad1::…` on the route versus `bom1::…` alone on /_next/static assets locates the function in iad1. The delta is ~180 ms of geography, not DB work: lib/razorpay/catalog.ts:138-141 caches pricedCurrencies() for 60 s in process. The prerendered /pricing HTML already contains ₹999, ₹4,499, ₹7,999, so nothing waits on this call to show a price. The RSC payload carries only INR and AED plan_prices rows, and PricingTeaser.tsx:160-162 falls back to INR for any currency not priced across every pack, so USD/GBP/EUR visitors never see a swap at all.

Corrected severity: low. No crawler exposure (robots.txt `Disallow: /api`), no LCP or CLS effect for non-AED visitors, no effect on rendered content.

Corrected recommendation: do not change the runtime and do not hardcode the priced-currency set. Fix the geography instead, which is a one-line change that touches no billing logic: add `export const preferredRegion = "bom1";` to app/api/region/route.ts (Next 16 supports it on Route Handlers), or set the Vercel project's default function region to bom1 so it sits next to Supabase and the teachers. Keep `runtime = "nodejs"`, keep `dynamic = "force-dynamic"`, keep `Cache-Control: private, no-store`, and keep the effectiveCurrency() call so an admin repricing in /admin/plans still takes effect within 60 s. Apply the same preferredRegion to the other Node API routes while you are there. Separately, and independently of this route, reserve the price line's height in PricingTeaser so the single AED correction cannot shift the grid: that is the only real layout risk and it is cheap.

### [LOW] The brief's "origin region is Mumbai/bom1" is wrong: the function region is iad1 and prerendered pages are genuinely edge-cached globally

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** low
- **Locations:** https://www.myyogaclasses.fit/, https://www.myyogaclasses.fit/api/region

**Evidence.** `bom1` is the Vercel PoP nearest my measuring vantage, and my vantage is India: Supabase returned `cf-ray: a3bf154a2f7f58c9-MAA` (Chennai) and /api/region resolved my request to `{"country":"IN","currency":"INR","locale":"en-IN"}`. From that vantage, immutable static assets return `x-vercel-id: bom1::…` (single segment, served locally, ttfb 0.0896-0.1075 s against tls 0.0573 s, so ~30 ms post-TLS), while dynamic responses return `bom1::iad1::…` and cost ~250 ms post-TLS. The homepage returns `x-vercel-cache: HIT` with `age` incrementing 13, 13, 13, 13, 14, 14, 14, 14 across eight consecutive requests, plus `x-nextjs-prerender: 1` and `x-nextjs-stale-time: 300`, at ~58 ms post-TLS. A genuine Mumbai-to-Virginia hop is physically ~125 ms RTT minimum, so the HTML is not travelling to iad1 per request.

**Recommendation.** Corrected finding: The brief's "origin region is Mumbai/bom1" is wrong. The Vercel function region is iad1 (Washington DC), and prerendered marketing HTML is served from the local PoP, not fetched from iad1 per request.

Corrected evidence (measured from Bengaluru, IN; ipinfo.io 49.205.39.22 ACT broadband, Cloudflare colo=MAA):
- bom1 is the Vercel PoP nearest this vantage. Raw edge RTT is low: dig resolves www.myyogaclasses.fit to 64.29.17.1, ping min 3.4 ms / avg 13.0 ms.
- Immutable static assets: /_next/static/chunks/074prxct1iqr1.js returns cache-control: public,max-age=31536000,immutable, x-vercel-cache: HIT, x-vercel-id: bom1::rd972-... , ttfb 0.0899 against tls 0.0569, so 33 ms post-TLS. A second chunk measured 50 ms.
- Prerendered HTML: / returns x-vercel-cache: HIT, x-nextjs-prerender: 1, ttfb 0.1096-0.1267 against tls 0.0558-0.0587, so 53-68 ms post-TLS. /classes/diabetes behaves identically at 53-83 ms post-TLS over 5 samples.
- Dynamic: /api/region returns x-vercel-cache: MISS, x-vercel-id: bom1::iad1::... , five samples at ttfb 0.2959-0.3191 against tls ~0.058, so 237-261 ms post-TLS.
- The ~190 ms gap between the prerendered HIT and the dynamic route is the India-to-Virginia round trip. The HTML does not pay it, so it is not travelling to iad1 per request.

Correction to the original evidence, important to record so nobody re-derives the wrong conclusion later: x-vercel-id segment count does NOT distinguish "served locally" from "went to iad1". The prerendered homepage returns bom1::iad1::... on every sample, as does /classes/diabetes. Only _next/static and /public assets return a single-segment bom1::. The proof that the HTML is edge-served is the timing, not the header shape.

Correction to the TTL reading: sampling age every 3 seconds gave 41, 44, 47, 50, 53, 56, then x-vercel-cache: STALE at age 60, then a reset to age 1. The CDN revalidation window on the homepage is 60 s, matching the documented revalidate: 60 on admin_settings. x-nextjs-stale-time: 300 is the client router cache hint and is a different number.

Caveat on the 250 ms dynamic figure: it is a best case. effectiveCurrency() in lib/razorpay/catalog.ts returns early with "if (candidate === DEFAULT_CURRENCY) return candidate;", and this vantage resolves to INR, so the measured request did no database work. Forcing the AED path with ?tz=Asia/Dubai correctly still returned INR, since GeoIP outranks the client timezone by design, so the non-INR cost stays unmeasured but is strictly higher than 250 ms.

Caveat on "globally": verified from one Indian vantage only. An 8-country check-host probe (CY, ES, FR, HK, IR, NL, RO, RU) returned HTTP 200 from every node, but its 1.1-4.0 s totals are dominated by those nodes' own links and do not isolate TTFB.

Corrected recommendation: No action needed on the CDN. Do not move the origin closer to the US and do not add a second region for the marketing pages. Record that the Vercel function region is iad1, so US visitors get the best dynamic-route latency, EU visitors pay roughly 80-90 ms, and India and UAE pay roughly 250 ms. The two exposures worth fixing are named separately in this report: /api/region on the Node runtime (confirmed at app/api/region/route.ts, which sets runtime = "nodejs" and dynamic = "force-dynamic"), and cache-control: public, max-age=0, must-revalidate on /public assets (confirmed on /hero-poster.jpg).

If Indian and UAE dynamic-route latency is ever worth optimising, there are two levers, not one, and the finding named only the first:
1. The Vercel function region. vercel.json at the repo root holds only a git key, with no regions and no functions block, so this is set in the Vercel project dashboard (or could be added to vercel.json as "regions": ["bom1"]).
2. The Supabase region, which is the larger lever and is currently the bigger problem. .env points SUPABASE_DB_URL at aws-0-ap-southeast-2.pooler.supabase.com, meaning the database still sits in Sydney, a leftover from the retired Australia era that the currency migration in June never touched. Every DB-touching dynamic route pays an iad1-to-Sydney hop today, and would still pay a bom1-to-Sydney hop after a function-region move. Moving functions to bom1 without also moving the database would capture only part of the win. Treat the Sydney database as its own item worth scoping, since it also affects checkout and booking latency for the India and UAE customers who make up most of the paying base.

### [LOW] The brief's CLS premise is wrong: next/font does emit fallback metrics. The real risk is that they resolve via local(Arial) and local(Times New Roman), neither of which exists on Android

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** medium
- **Locations:** app/layout.tsx, app/globals.css, https://www.myyogaclasses.fit/classes/diabetes

**Evidence.** The shipped stylesheet /_next/static/chunks/0cs7r0nbk1f.m.css contains a metric-matched fallback face for all five families, e.g. `@font-face{font-family:Hanken Grotesk Fallback;src:local(Arial);ascent-override:99.07%;descent-override:30.02%;line-gap-override:0.0%;size-adjust:100.94%}` and `@font-face{font-family:Cormorant Garamond Fallback;src:local(Times New Roman);ascent-override:95.27%;descent-override:29.59%;size-adjust:96.98%}`. The variables include them: `.cormorant_garamond_…__variable{--font-cormorant:"Cormorant Garamond", "Cormorant Garamond Fallback"}`, and live on /classes/diabetes the H1 computes to `"Cormorant Garamond", "Cormorant Garamond Fallback", Georgia, serif`. Neither Arial nor Times New Roman ships on Android, so on the majority of this site's 75%-mobile traffic the `local()` source fails, the adjusted face never activates, and the stack falls through to Georgia (also absent) and then bare `serif` (Noto Serif) with no override. On /classes/diabetes the LCP element is exactly that H1: live measurement of above-fold candidates returned `{tag:"H1", area:47850, font:"Cormorant Garamond", fontSize:"44px"}`, with no image above the fold at all.

**Recommendation.** Keep the factual correction to the brief (next/font DOES emit metric-matched fallback faces, and they resolve via local(Arial) / local(Times New Roman), neither of which exists on Android). Drop the CLS consequence and the severity.

Corrected finding, severity LOW: on Android the generated `Cormorant Garamond Fallback` and `Hanken Grotesk Fallback` faces never activate, so the metric overrides are dead weight. Measured impact on /classes/diabetes is nil: the H1 is `leading-[1.08]` (computed line-height 50.16px), and the headline holds 3 lines and 150.5px across Cormorant (644.1px advance), the Fallback face (653.4px), Times (673.7px) and Georgia (739.6px), only breaking to 4 lines past ~760px. Forced to the generic Android stack the H1 and first paragraph both move 0.0px; the only shifts over 1px sit at y=1235px, below the fold. Body text is unaffected regardless because the Hanken stack falls through to `system-ui`, which resolves to Roboto on Android.

Corrected recommendation, one line, no refactor: in app/layout.tsx add `fallback: ["Noto Serif", "Georgia", "serif"]` to Cormorant_Garamond and `fallback: ["Roboto", "system-ui", "sans-serif"]` to Hanken_Grotesk. Omit `adjustFontFallback: true` (already the default). Do NOT self-host Cormorant or hand-write a `Cormorant Fallback Android` face with an invented size-adjust:88%: that leaves next/font's subsetting, hashing and preloading behind to fix a shift that measures 0.0px.

REPLACE the priority with the real performance finding on this dimension. app/layout.tsx:122 puts all five font variables on <html>, so next/font preloads all five woff2 subsets on every route. On /classes/diabetes, elements by primary family are Cormorant 57, Hanken 191, Inter 2, Fraunces 0, Geist Mono 0, yet the head preloads Fraunces latin (120,724 bytes) and Geist Mono latin (23,108 bytes) at high priority ahead of the 24,685 bytes of render-blocking CSS. Fix: `Fraunces({..., preload: false})` and `Geist_Mono({..., preload: false})` in app/layout.tsx. The @font-face rules stay available for the dashboard/admin surfaces that use --font-fraunces, they just stop being preloaded, cutting 140.5 KB of high-priority contention from every marketing page and letting the Cormorant subset the LCP element actually needs arrive sooner. Consider `preload: false` on Inter too (2 elements). This touches only app/layout.tsx: no DB-driven copy, no CSP origin, no cookies(), so ISR in the (marketing) group is unaffected.

### [LOW] 41,343 B brotli of the reported JS total is a noModule legacy polyfill that modern browsers never download

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** low
- **Locations:** https://www.myyogaclasses.fit/

**Evidence.** `/_next/static/chunks/03~yq9q893hmn.js` is 41,343 B brotli / 112,594 B identity and is emitted as `<script src="…" noModule>` at HTML byte offset 7535. Its first bytes are a core-js style preamble: `!function(){var t="undefined"!=typeof globalThis?globalThis:…`. My full measurement of the homepage is 30 assets: 28 JS at 487,187 B brotli / 1,525,539 B identity, plus 2 CSS at 24,685 B brotli / 165,268 B identity, 511,872 B brotli in total.

**Recommendation.** Correct the working baseline: a modern browser downloads 445,844 B brotli across 27 JS files, not 476 KB across 28. Use that as the denominator when judging the wins below, because it changes the arithmetic materially: the Supabase chunk alone is 14.5% of real JS, and Supabase plus the unused fonts plus the priority-avatar preload together remove 469,743 B from the critical path of every page. No code change is needed for the polyfill chunk itself.

### [LOW] GSAP is a dead dependency: zero imports in the repo and zero bytes in any shipped chunk, contradicting CLAUDE.md

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** low
- **Locations:** package.json, CLAUDE.md

**Evidence.** `grep -rn "gsap\|ScrollTrigger" app components lib` returns nothing. I downloaded all 28 homepage JS chunks and grepped each for `gsap|ScrollTrigger`: zero matches in any file. `package.json` nonetheless lists `"gsap": "^3.12.5"` as a runtime dependency, and CLAUDE.md states "GSAP ScrollTrigger when timeline scrubbing is needed". The libraries that are actually shipped, by chunk: `0rug-8xigz9co.js` 64,489 B br = supabase-js; `0nwvf~lp322dq.js` 74,388 B br = React DOM; `0pops.0psf_pw.js` 40,245 B br = Motion; `0dg~0kx2kmkxd.js` 22,770 B br = Motion + Lenis; `0~fu71y~cahh7.js` 12,547 B br and `0.xi-a.i1py7v.js` 13,123 B br = Lenis + Razorpay; `0zz_bgmv-k_p3.js` 16,519 B br = lucide + Capacitor; `10ihu1spchu~5.js` 10,723 B br = Sentry; `15uu87secwpz5.js` 8,946 B br = date-fns.

**Recommendation.** Run `npm uninstall gsap` and delete the GSAP sentence from the Animation bullet in CLAUDE.md's "Conventions worth knowing before editing" section. Zero runtime effect (it was already tree-shaken out), but it removes a stale premise that will otherwise keep sending future performance work down a dead end. On the load-bearing question you asked: Motion IS load-bearing for the design, since MotionConfig `reducedMotion="user"` in app/(marketing)/layout.tsx:26 and the `whileInView` section reveals are the site's visual identity; Lenis is aesthetic only and is the one you could drop for a pure CWV win.

### [LOW] LCP elements identified: hero poster image on / (both viewports), H1 text in Cormorant Garamond on /classes/diabetes (no image above the fold)

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** https://www.myyogaclasses.fit/, https://www.myyogaclasses.fit/classes/diabetes, components/marketing/Hero.tsx, components/marketing/HeroVideo.tsx

**Evidence.** Homepage mobile (375x812, live): `/hero-poster.jpg` renders at 457.5 x 1198.05 CSS px = 548,085 px2, filling the viewport, at 1.21 bits per pixel (49,915 B x 8 / 329,160 viewport px2), well above Chrome's 0.05 bpp low-entropy exclusion. The H1 is excluded as an LCP candidate by the inherited `opacity:0`. Homepage desktop: the plate is inset to `md:left-[38%]` (components/marketing/Hero.tsx:42) so the poster still covers ~62% of viewport width at full height, larger than the H1 block at its `clamp(...,5.6rem)` maximum. /classes/diabetes has no above-fold image at all (`[...document.querySelectorAll('img')].filter(above fold)` returned `[]`); the largest text candidate is `{tag:"H1", area:47850, font:"Cormorant Garamond", fontSize:"44px", opacity:"1"}` versus the subhead paragraph at 44,660 px2 in Hanken Grotesk, and neither is opacity-gated.

**Recommendation.** Treat the two page types differently. On /, LCP is image-bound: the wins are the poster re-encode and crop, dropping the below-fold avatar's `priority`, and the cache header, in that order. On the nine condition pages (the site's strongest content), LCP is text-bound and therefore gated only on HTML plus the 24,685 B of render-blocking CSS, so LCP there should already be fast; the wins are cutting the 192,264 B of unused font preloads that contend with that CSS, and fixing the Android fallback metrics for Cormorant Garamond, since the LCP element is set in it. Do not add a hero image to the condition pages: they are currently the fastest template on the site and an above-fold image would make LCP image-bound for no content benefit.

---

## onpage (27)

### [HIGH] The 9 condition titles are the raw DB category name, must be keyed off slug, not name

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx

**Evidence.** app/(marketing)/classes/[slug]/page.tsx:32 reads `title: c?.name ?? "Class"`. Live titles and exact lengths including the 18-char " · My Yoga Classes" suffix: "Diabetes · My Yoga Classes" (26), "Geriatric Yoga · My Yoga Classes" (32), "Hypertension · My Yoga Classes" (30), "Prenatal & Postnatal · My Yoga Classes" (38), "Hormonal Health · My Yoga Classes" (33), "Pain Relief · My Yoga Classes" (29), "Mental Health · My Yoga Classes" (31), "Weight Loss · My Yoga Classes" (29), "Kids Yoga · My Yoga Classes" (27). Every one is under 40 chars, none contains "yoga" except geriatric and kids, and the strings are inconsistent because they come from `class_categories.name` which an admin can edit at any time.

**Recommendation.** Severity: high, not critical.

Placement: do NOT add a literal map to page.tsx. Add `metaTitle: string` to the `ConditionPage` type in /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages.ts (beside the existing `metaDescription`), and a `"metaTitle"` key to each of the nine files in /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/. The type makes it impossible to add a tenth condition file without one.

Then in /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx, replace the whole return of generateMetadata (lines 31-35) with:

  const title = rich?.metaTitle ?? (c ? `1:1 online yoga: ${c.name}` : "Online yoga class");
  const description = rich?.metaDescription ?? c?.long_description ?? c?.description ?? undefined;
  return {
    title,
    description,
    alternates: { canonical: `/classes/${slug}` },
    openGraph: { title, description, url: `/classes/${slug}` },
  };

The openGraph block fixes a defect the finding missed: all nine pages currently inherit the homepage og:title and og:description verbatim (verified live on /classes/diabetes). The `??` branch keeps a new admin-added category from shipping a bare one-word title.

Corrected metaTitle values, sentence case to match site voice, each staying inside the medically-reviewed vocabulary of its own page. Full lengths with the 18-char suffix in brackets, all inside 50-60:

  diabetes:        "Online yoga for diabetes: live 1:1"      [52]
  hypertension:    "Yoga for high blood pressure: 1:1 online" [58]  (supported, hypertension.json metaDescription already says "high blood pressure")
  prenatal:        "Online prenatal & postnatal yoga: 1:1"    [55]  (restores postnatal)
  hormonal-health: "Yoga for hormonal health: 1:1 online"     [54]  ("health", not "balance", matching the page's own H1)
  pain-relief:     "Yoga for back and neck pain: 1:1 online"  [57]
  mental-health:   "Online yoga for stress: live 1:1 classes" [58]  ("stress" appears 4x in the file; "anxiety" appears 0x -- do not use it)
  weight-loss:     "Yoga for an active routine: 1:1 online"   [56]  (matches the page's own H1 and metaDescription)
  geriatric:       "Chair yoga for older adults: 1:1 online"  [57]  (chair is supported, 20 mentions; "older adults" is the page's own term, not "seniors")
  kids-yoga:       "Online kids yoga: live 1:1 classes"       [52]

Flag for the owner, do not decide silently: weight-loss and mental-health are a genuine SEO-versus-compliance tradeoff. "yoga for weight loss" and "yoga for anxiety" are the high-volume queries, but the 0024 reframe deliberately removed both promises from the reviewed copy. Shipping the safe titles above forgoes that demand. If the owner wants the query, the claim has to be re-cleared for UAE/India ad rules and the page body updated to match, not just the title tag -- a title that promises what the body does not deliver invites a Google rewrite anyway.

No em-dashes, no free-trial wording, "1:1" framing kept, static strings so ISR is untouched, no new origin so the CSP is untouched.

### [HIGH] CORRECTION: condition pages have NO FAQPage JSON-LD, despite rendering 45 Q&As

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx, /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts

**Evidence.** The first-pass audit states FAQPage is present on "/ /faq /pricing and condition pages". Parsing every ld+json block on all 23 live pages returns: / [Organization, FAQPage], /pricing [Organization, FAQPage], /faq [Organization, FAQPage], and every /classes/* page [Organization, Course] only. Yet each condition page renders 5 questions as H3s under the visible heading "Questions people ask first." (verified in lib/data/condition-pages/*.json: `faqs` length is exactly 5 in all 9 files, 45 Q&As total). ConditionLanding.tsx:246-249 renders `d.faqH2` and `d.faqs.map(...)` with no JsonLd call. These are the highest-intent long-tail questions on the site ("Can yoga replace my diabetes medication?", "Is it safe to do yoga while pregnant?", "Are there poses I should avoid with high blood pressure?") and none is eligible for a rich result.

**Recommendation.** The builder already exists and is typed. In /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx, inside ClassDetailPage next to the existing `<JsonLd data={courseJsonLd(...)} />`, add:

{rich ? <JsonLd data={faqPageJsonLd(rich.faqs.map((f) => ({ q: f.q, a: f.a })))} /> : null}

importing `faqPageJsonLd` from @/lib/seo/structuredData. Confirm the condition JSON field names match the `Faq` type in lib/data/faqs.ts and map if they differ. This is server-rendered inside an ISR page, touches no cookies, and cannot force the route dynamic.

### [HIGH] /pricing has no Product or Offer markup, so three real prices are invisible to Google Shopping and price-annotated snippets

- **Verdict:** unverified | **Effort:** moderate | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/pricing/page.tsx, /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts

**Evidence.** Live JSON-LD on /pricing is exactly [Organization, FAQPage]. The page renders three concrete, purchasable SKUs: 1-Session Pack ₹999, 5-Session Pack ₹4,499, 10-Session Pack ₹7,999, each with a "Get this pack" button. No Product, Offer, AggregateOffer or Service node exists anywhere on the page.

**Recommendation.** Add to /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts a `packOffersJsonLd(plans, currency)` builder emitting one Product with an AggregateOffer and three Offer nodes, and render it from app/(marketing)/pricing/page.tsx. Shape:

{"@context":"https://schema.org","@type":"Product",
 "name":"Live 1:1 Online Yoga Session Packs",
 "description":"Prepaid packs of 60-minute live 1:1 online yoga sessions with a certified teacher. No subscription and no expiry.",
 "brand":{"@type":"Brand","name":"My Yoga Classes"},
 "offers":{"@type":"AggregateOffer","priceCurrency":"INR","lowPrice":"999","highPrice":"7999","offerCount":3,"availability":"https://schema.org/InStock",
   "offers":[
     {"@type":"Offer","name":"1-Session Pack","price":"999","priceCurrency":"INR","url":"https://www.myyogaclasses.fit/pricing","availability":"https://schema.org/InStock"},
     {"@type":"Offer","name":"5-Session Pack","price":"4499","priceCurrency":"INR","url":"https://www.myyogaclasses.fit/pricing","availability":"https://schema.org/InStock"},
     {"@type":"Offer","name":"10-Session Pack","price":"7999","priceCurrency":"INR","url":"https://www.myyogaclasses.fit/pricing","availability":"https://schema.org/InStock"}]}}

Derive the prices and priceCurrency from the same server-resolved plan data the grid renders (never hardcode) so the markup can never disagree with the visible price, which is a manual-action trigger. Do NOT attach an aggregateRating node to this Product: see the review-count finding below.

### [HIGH] CORRECTION: the 107 pose entries ARE published live, and are the site's single biggest unexploited URL asset

- **Verdict:** unverified | **Effort:** substantial | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/components/marketing/condition/ConditionLanding.tsx, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx

**Evidence.** The first-pass audit records the 107 pose entries across 36 poseGroups as "Unpublished". They are live. Rendered visible text on https://www.myyogaclasses.fit/classes/diabetes includes: "Surya Namaskar Sun salutation A flowing sequence, paced to you... Tadasana Mountain pose & standing flow... Setu Bandhasana Bridge pose... Ardha Matsyendrasana Seated spinal twist... Paschimottanasana Seated forward bend... Mandukasana Frog pose... Vajrasana Thunderbolt pose... Nadi Shodhana Alternate-nostril breathing... Bhramari Humming breath...". Exact per-page pose counts from the JSON: diabetes 11, geriatric 14, hormonal-health 11, hypertension 9, kids-yoga 13, mental-health 12, pain-relief 13, prenatal 12, weight-loss 12 = 107 across 36 groups. But each pose name renders as `<div class="font-[family-name:var(--font-heading)] text-lg">Surya Namaskar</div>`, a plain div, so it carries no heading weight and no URL of its own. myyogateacher.com fields 84 /yoga-asana URLs against this.

**Recommendation.** Two moves. Short term, promote the pose names from div to <h3> inside the poseGroups renderer in /Users/shalomp/YOGA_WEBSITE/components/marketing/condition/ConditionLanding.tsx (around the posesH2 block at line 138), with the group tag as the <h3> and the pose name as an <h4>, so 107 Sanskrit and English pose names gain heading weight immediately. Medium term, build /yoga-poses and /yoga-poses/[slug] from the SAME lib/data/condition-pages JSON by deduplicating on the `sa` field: roughly 60 to 70 unique poses after dedupe, each with Sanskrit name, English name and a condition-specific description, cross-linked to every condition page that uses it. That is the reciprocal internal-linking fix for the condition-page dead ends and the only realistic path from 23 URLs toward a competitive footprint. Set `export const revalidate = 300` and `generateStaticParams()` exactly as classes/[slug] does, and never call cookies() in the new segment.

### [HIGH] Condition pages link out only to nav and footer; no cross-links between the nine, and no teacher links

- **Verdict:** unverified | **Effort:** moderate | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/components/marketing/condition/ConditionLanding.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/[slug]/page.tsx, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/

**Evidence.** Non-asset internal links on /classes/diabetes are exactly: /, /about, /classes, /contact, /faq, /legal/privacy, /legal/refund, /legal/terms, /login, /pricing, /reviews, /teachers. That set is byte-identical on all nine condition pages and on all three teacher pages, which confirms it is entirely chrome. Zero links from /classes/diabetes to any other condition page, zero to any teacher, and zero from any teacher page to a condition page, despite Dr Sangeeta's live bio reading "I specialize in prenatal and postnatal yoga sessions" and Dr Vaishnavi's listing "Cardiovascular Health" among her specialties. PageRank flows in and stops.

**Recommendation.** Three additions, all server-rendered inside the existing ISR pages so none forces a dynamic route. (1) In components/marketing/condition/ConditionLanding.tsx, above the FinalCTA, render a "Related conditions" block linking 3 hand-picked sibling slugs per page (diabetes -> hypertension, weight-loss, hormonal-health; prenatal -> hormonal-health, pain-relief; mental-health -> hypertension, pain-relief; geriatric -> pain-relief, hypertension; kids-yoga -> mental-health, pain-relief). Add the slug list as a `related: string[]` field in each condition JSON so the pairing is data, not logic. (2) On each condition page, surface the teachers whose `specialties` overlap the condition, linking to /teachers/[slug]: this is the highest-value link on the page because it moves a reader from problem to person. (3) On each teacher page, link their specialties to the matching /classes/[slug]. Together this turns 12 orphan pages into a connected cluster and is a prerequisite for the /yoga-poses hub to distribute any equity at all.

### [MEDIUM] All 23 pages emit the homepage og:title and og:description because app/layout.tsx sets them literally

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/layout.tsx, https://www.myyogaclasses.fit/ (all 23 URLs)

**Evidence.** app/layout.tsx:72-79 sets `openGraph: { type, siteName, locale: "en", title: "My Yoga Classes: Live 1:1 online yoga teacher", description: "Find your 1:1 yoga teacher. 60-minute personalised session..." }`. `grep -rn openGraph app/ components/` returns exactly one hit: app/layout.tsx:72. No page overrides it. Live /classes/diabetes serves: `<meta property="og:title" content="My Yoga Classes: Live 1:1 online yoga teacher">`, `<meta property="og:description" content="Find your 1:1 yoga teacher. 60-minute personalised session. Pick your teacher. Pick your time. Meets live online.">`, `<meta name="twitter:title" content="My Yoga Classes: Live 1:1 online yoga teacher">`. Identical on /pricing and every other page checked.

**Recommendation.** Severity: MEDIUM, not critical. Restated finding: all 23 sitemap URLs emit an identical homepage og:title, og:description, twitter:title and twitter:description because app/layout.tsx:76-78 hard-codes them. Per-page <title> and <meta name="description"> are already correct and unique on all 23, so search snippets and rankings are unaffected; the damage is confined to social and chat link previews and og-reading crawlers. It is a one-line fix with a modest payoff, which is exactly why it should be done, but it belongs below the thin-content and title-keyword work in priority order.

Corrected recommendation (three edits, not one):

1. In /Users/shalomp/YOGA_WEBSITE/app/layout.tsx delete lines 76-78 (the `title:` and `description:` keys), leaving `openGraph: { type: "website", siteName: "My Yoga Classes", locale: "en_US" }`. Note this also fixes the invalid `og:locale` "en" flagged separately as item 8, since OG requires language_TERRITORY.

2. Do NOT drop the homepage social copy on the floor. Deleting line 78 silently regresses the homepage og:description from "Find your 1:1 yoga teacher. 60-minute personalised session. Pick your teacher. Pick your time. Meets live online." to the generic root description, on the single page most likely to be shared. Either promote that punchy string to the root `description` field (line 68-69), or set an `openGraph: { description: "..." }` on the homepage segment only.

3. Lengthen the three teacher meta descriptions before shipping this. Live values are "MD in Clinical Yoga &amp; Naturopathy", "Yoga and Naturopathy Doctor" and "Medical Yogic Sciences · 8 years". Once og:description inherits from them, /teachers/dr-sangeeta gets a 27-character social card. Aim for 140-160 chars each, name plus credential plus what they teach.

Sequencing note: after this fix og:title becomes the templated per-page title, so /classes/diabetes gets "Diabetes · My Yoga Classes". That inherits the bare-category-name problem already flagged as item 2. Fix the condition-page titles first and this change becomes free upside rather than propagating a weak title into the social cards.

Verification command as given is correct: curl -s https://www.myyogaclasses.fit/classes/diabetes | grep 'og:title'

### [MEDIUM] Condition meta descriptions omit "online" and have no click trigger; 9 rewrites

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/diabetes.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/hypertension.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/prenatal.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/hormonal-health.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/pain-relief.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/mental-health.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/weight-loss.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/geriatric.json

**Evidence.** app/(marketing)/classes/[slug]/page.tsx:33 falls to `rich?.metaDescription` from lib/data/condition-pages/*.json. Live lengths: diabetes 146, geriatric 140, hypertension 140, prenatal 137, hormonal-health 149, pain-relief 136, mental-health 136, weight-loss 137, kids-yoga 141. All are under the 150 floor, none contains the word "online", and none ends in a CTA. Example live string, /classes/pain-relief (136): "Gentle 1:1 yoga for everyday back, neck, and joint tension: easy stretching, mobility, and posture work kept inside a comfortable range."

**Recommendation.** Revised finding: "Condition meta descriptions omit 'online', the one query token that matters for a global online-yoga business, and have no click trigger. 9 rewrites." Severity: MEDIUM, not high. Drop the "under the 150 floor" rationale entirely — there is no minimum length and Google truncates by pixel width, not characters. The real defect is the missing "online" token plus a flat, non-differentiated close, not the character count.

Revised recommendation:
1. Ship 8 of the 9 proposed strings as written. They front-load "Live 1:1 online yoga for {condition}" inside the first ~50 characters, which is the part that survives the ~680px mobile cutoff. Treat "Book a 60-minute session." as a desktop-only bonus clause, not the payload, and do not lengthen further chasing 160.

2. Replace the mental-health.json proposal. "anxiety" appears nowhere in mental-health.json, and Google rewrites descriptions using words absent from the body. Use instead (157 chars, no em-dash):
"Live 1:1 online yoga for stress and a busy mind: calming movement, breathwork and meditation with a teacher who adapts to your day. Book a 60-minute session."
If "anxiety" is wanted for query coverage, add it to the page body first so the description is supported.

3. Do the titles in the same commit — higher expected value than the descriptions, same 9 pages. Live titles are bare category nouns ("Diabetes · My Yoga Classes"). Titles are ranking-relevant; descriptions are not. app/layout.tsx template "%s · My Yoga Classes" adds 18 chars, so pass roughly 40-42 chars per page, e.g. "Online Yoga for Diabetes, Live 1:1", "Online Yoga for High Blood Pressure, 1:1", "Online Prenatal Yoga, Live 1:1 Classes", "Online Yoga for PCOS and Menopause", "Online Yoga for Back and Joint Pain", "Online Yoga for Stress Relief, Live 1:1", "Online Yoga for Weight Loss, Live 1:1", "Online Chair Yoga for Seniors", "Online Yoga for Kids, Live 1:1". Source these from the same JSON by adding a `metaTitle` field and reading it at page.tsx:33 alongside metaDescription, so title and description stay in one file per condition.

### [MEDIUM] Six pages carry one-word titles; six rewrites at 50-60 chars

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/about/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/pricing/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/reviews/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/faq/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/contact/page.tsx

**Evidence.** Live titles with exact lengths: "About · My Yoga Classes" (23), "Class types · My Yoga Classes" (29), "Pricing · My Yoga Classes" (25), "Teachers · My Yoga Classes" (26), "Reviews · My Yoga Classes" (25), "FAQ · My Yoga Classes" (21), "Contact · My Yoga Classes" (25). Every one wastes 25-39 characters of SERP width and none carries a modifier a global searcher types.

**Recommendation.** Severity: medium (cheap, correct, but CTR/relevance on 7 navigational hub URLs; not a ranking unlock on its own).

Corrected finding: SEVEN pages carry keyword-free titles, six of them a single word ("Class types" is two words). Live lengths 21-29 chars. The defect is not wasted SERP width, it is that none of the seven carries a modifier a global searcher types, and the H1 fallback Google would rewrite to is worse still (e.g. /about H1 is "Old practice. New room. No bullsh*t." which is a live SERP-snippet risk).

Keep all seven title rewrites exactly as proposed. They verify at 50, 52, 56, 59, 57, 51, 54 chars with the template applied, are claim-safe, and violate no project constraint. One caveat: "Contact Us: Online Yoga Support Team" is padding around an entity nobody searches and invents a "Support Team". Prefer the shorter, honest "Contact My Yoga Classes" (title.absolute) or keep "Contact" and instead lean on the existing meta description ("We reply within 1 business day"), which is the real differentiator. Contact pages have negligible search demand; do not lengthen it just to hit 50 chars.

ADD the missed fix, which is a single edit and larger in blast radius than any one title. In app/layout.tsx, delete the literal `title:` and `description:` keys from the root `openGraph` object (lines 71-75). Next.js then falls back to the resolved page `metadata.title` / `metadata.description` for og:title and og:description, so each of the seven pages gets its own social title through the same template, and the root page keeps "My Yoga Classes: Live 1:1 online yoga teacher" via `title.default`. Keep `type`, `siteName` and `locale`. While in that object, `locale: "en"` is invalid and should be `en_US` (separately established).

### [MEDIUM] Five static descriptions are far outside 150-160; rewrites for /, /about, /classes, /reviews, /faq, /contact

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/layout.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/about/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/reviews/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/faq/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/contact/page.tsx

**Evidence.** Live lengths: / 118, /about 44 ("Why My Yoga Classes exists, and how we work."), /classes 166 (over, will truncate), /teachers 139, /reviews 47 ("What our students say about practising with us."), /faq 91, /contact 119. /about and /reviews at 44 and 47 chars give Google almost nothing to render and it will substitute page text.

**Recommendation.** Keep the finding but downgrade to MEDIUM (CTR-only, ~37% render rate, 23 URLs) and retitle: "Two static descriptions are stubs (/about 44, /reviews 47), one overruns (/classes 166), /pricing is thin and currency-narrow."

ACCEPT AS WRITTEN (verified exact length, no em-dash, no free-trial copy, not DB-driven):
- app/layout.tsx:69 (155)
- app/(marketing)/about/page.tsx:6 (151)
- app/(marketing)/teachers/page.tsx:9 (154)
- app/(marketing)/reviews/page.tsx:9 (154)
- app/(marketing)/faq/page.tsx:11 (154)
- app/(marketing)/contact/page.tsx:7 (153)

REJECT the /classes rewrite. It strips the exact condition terms the nine condition pages target. Use instead, which keeps every keyword and fits at 158 chars with no em-dash:
app/(marketing)/classes/page.tsx:9 -> "Yoga built around what your body is working on: diabetes, hypertension, prenatal, pain relief, mental health, weight loss, seniors and kids. Live 1:1, 60 min."

ADD the page the finding missed, 156 chars, grounded in the live pack prices ₹999 / ₹4,499 / ₹7,999 and using "prepaid 1:1 sessions" never "credits":
app/(marketing)/pricing/page.tsx:13 -> "One-time yoga session packs, no subscription and no monthly fee. Buy 1, 5 or 10 prepaid 1:1 sessions of 60 minutes each and book them whenever you are free."
This also removes "in AED and INR", which reads as a regional restriction to the worldwide audience the site actually serves (no service-area gate). Do not replace it with a USD/GBP/EUR claim: effectiveCurrency() still downgrades to INR until plan_prices rows exist, so naming unpriced currencies in a snippet would promise a price the checkout will not honour.

ALSO update app/layout.tsx:77 openGraph.description in the same commit, otherwise the OG snippet keeps the old 112-char string and diverges from the new meta text on every page (verified live: /about serves the layout og:description, not its own).

Sequence this AFTER the title-template work on the condition pages, which is the higher-value on-page item: titles do influence ranking and are not rewritten at anything close to a 63-71% rate.

### [MEDIUM] Teacher meta descriptions are the raw headline field: 33, 27 and 32 characters

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/[slug]/page.tsx

**Evidence.** app/(marketing)/teachers/[slug]/page.tsx:29 reads `description: t?.headline ?? undefined`. Live output: /teachers/dr-vaishnavi-mayya "MD in Clinical Yoga & Naturopathy" (33), /teachers/dr-sangeeta "Yoga and Naturopathy Doctor" (27), /teachers/dr-hima-bindu "Medical Yogic Sciences · 8 years" (32). No verb, no service, no location, no CTA. Google will discard all three and synthesise from body text.

**Recommendation.** Severity: medium (not high). Meta description is not a ranking factor and Google rewrites 63-71% of descriptions anyway; this affects 3 of 23 URLs whose only queries are branded teacher names. Fix it as cheap snippet-control and title hygiene, not as a ranking issue. Drop the claim that Google discarding the description is itself the harm; the harm is losing control of the snippet.

Corrected recommendation for /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/[slug]/page.tsx, replacing lines 24-32. Adds a clamp (headline is unbounded `text` and admin-editable with no maxLength) and fixes the missing per-teacher Open Graph:

const MAX_DESC = 160;
const TEACHER_BODY = " Teaches live 1:1 online yoga to students worldwide, 60 minutes a session.";
const TEACHER_CTAS = [
  " Check the calendar and book a time in your own zone.",
  " Book a time in your own time zone.",
  " Pick a time that suits you.",
  " Book a session.",
];

function teacherDescription(name: string, headline: string | null) {
  // headline is unbounded free text (0002_teachers.sql:9; the admin input has
  // no maxLength), so clamp it before it can push the snippet past 160.
  const room = MAX_DESC - `${name}: .`.length - TEACHER_BODY.length;
  const clean = headline?.trim().replace(/\s+/g, " ") ?? "";
  const h = clean.length > room ? `${clean.slice(0, room - 1).trimEnd()}…` : clean;
  const base =
    (h ? `${name}: ${h}.` : `${name}, certified yoga teacher in India.`) + TEACHER_BODY;
  for (const cta of TEACHER_CTAS) if ((base + cta).length <= MAX_DESC) return base + cta;
  return base;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTeacherBySlug(slug);
  if (!t) return { title: "Teacher", alternates: { canonical: `/teachers/${slug}` } };
  const title = `${t.display_name}: Online Yoga Teacher`;
  const description = teacherDescription(t.display_name, t.headline);
  return {
    title,
    description,
    alternates: { canonical: `/teachers/${slug}` },
    // Without this the page inherits the root openGraph, so all three teacher
    // pages currently share one generic title and description when shared.
    openGraph: {
      title,
      description,
      url: `/teachers/${slug}`,
      type: "profile",
      ...(t.avatar_url ? { images: [{ url: t.avatar_url, alt: t.display_name }] } : {}),
    },
  };
}

Verified outputs (I ran this exact logic):
- Dr Vaishnavi Mayya, 156: "Dr Vaishnavi Mayya: MD in Clinical Yoga & Naturopathy. Teaches live 1:1 online yoga to students worldwide, 60 minutes a session. Pick a time that suits you."
- Dr Sangeeta, 150: "Dr Sangeeta: Yoga and Naturopathy Doctor. Teaches live 1:1 online yoga to students worldwide, 60 minutes a session. Book a time in your own time zone."
- Dr Hima Bindu, 157: "Dr Hima Bindu: Medical Yogic Sciences · 8 years. Teaches live 1:1 online yoga to students worldwide, 60 minutes a session. Book a time in your own time zone."
- 95-char headline stress case, 160 (was 192 without the clamp).
- Null headline, 152: "Dr Nobody, certified yoga teacher in India. Teaches live 1:1 online yoga to students worldwide, 60 minutes a session. Book a time in your own time zone."
Titles with the layout's " · My Yoga Classes" suffix: 57 / 50 / 52, all inside 50-60. No em-dashes, no free-trial wording, no "credits", no new origin, no cookies() so ISR is unaffected.

### [MEDIUM] "online yoga" appears zero times in the body of all 9 condition pages, and never in the first 100 words

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/diabetes.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/hypertension.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/prenatal.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/hormonal-health.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/pain-relief.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/mental-health.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/weight-loss.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/geriatric.json

**Evidence.** Counted over the stripped visible text of all 9 live condition pages: `online yoga` = 0 on every page; `yoga teacher` = 0 on every page; `online` = 2 (both from the chip "60 min · 1:1 · live online" and the footer); `yoga class` = 3 (all three are the brand string "My Yoga Classes"). First 100 body words on /classes/diabetes read: "Gentle intensity, for diabetes. Yoga for diabetes, shaped around you. Gentle 1:1 sessions of easy movement, breathwork, and rest, built around your body, your routine, and how you feel each day..." The condition term is present at word 5, but the commercial modifier is absent entirely.

**Recommendation.** Severity: medium, not high. Restate as: "The site's own head term 'online yoga' appears zero times in the body of ANY page, including the homepage whose title tag targets it." Evidence fix: the two `online` hits per condition page are the hero chip "60 min · 1:1 · live online" and step-3 prose "The same teacher every time, online, adjusting each session to how you feel and what your week has been like" — not the footer. Drop the "first 100 words" rationale (tool heuristic, not a Google ranking factor) and justify it instead as exact-phrase coverage for long-tail compounds such as "online yoga for diabetes". Keep the nine heroLead edits exactly as written, they are verbatim-accurate and each file contains "1:1 sessions" exactly once. Add two things the finding omitted: (1) also land "online yoga" in the homepage body, since its title already promises the term and the body has zero instances; (2) fix the now-false header comment at lib/data/condition-pages.ts:1-6 which declares landing-pages/*.html the source of truth and the JSON "extracted verbatim" — the JSON already diverges (landing-pages/yoga-for-diabetes.html still reads "rest — built around your bod…" with an em-dash the JSON dropped), so either update the nine landing-pages/*.html leads in the same commit or amend the comment to say the JSON is authoritative for the app route. Note that on these pages the larger on-page lever is the bare title tag ("Diabetes · My Yoga Classes"), already tracked as audit item 2; this one-word body edit should be filed as a free quick win, not as the priority fix.

### [MEDIUM] Condition pages have no BreadcrumbList, though teacher pages do

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx

**Evidence.** Live JSON-LD on /teachers/dr-sangeeta: [Organization, Person, BreadcrumbList]. Live JSON-LD on all 9 /classes/* pages: [Organization, Course]. teachers/[slug]/page.tsx:44-49 calls breadcrumbJsonLd; classes/[slug]/page.tsx has no equivalent. Google renders the breadcrumb trail in place of the raw URL in the SERP, and /classes/hormonal-health is a long, unhelpful URL to display.

**Recommendation.** In /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx, mirror the teacher page:

<JsonLd data={breadcrumbJsonLd([
  { name: "Classes", url: `${siteUrl}/classes` },
  { name: c.name, url: `${siteUrl}/classes/${c.slug}` },
])} />

importing `breadcrumbJsonLd` from @/lib/seo/structuredData. Consider a third leading node { name: "Online yoga", url: siteUrl } so the rendered trail reads "myyogaclasses.fit > Classes > Diabetes".

### [MEDIUM] Course JSON-LD has no offers and a self-referential provider.sameAs, so it is ineligible for the Course rich result

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts

**Evidence.** Live Course node on /classes/diabetes: {"@type":"Course","name":"1:1 Yoga: Diabetes focus","description":"...","url":"https://www.myyogaclasses.fit/classes/diabetes","provider":{"@type":"Organization","name":"My Yoga Classes","sameAs":"https://www.myyogaclasses.fit/classes/diabetes"},"hasCourseInstance":{"@type":"CourseInstance","courseMode":"Online","courseWorkload":"PT60M"}}. Two problems: `provider.sameAs` points at the course page itself rather than the organization homepage (lib/seo/structuredData.ts:58 passes `url`), and there is no `offers`, which Google's Course Info guidance requires alongside provider for carousel eligibility.

**Recommendation.** In /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts:51-66, change `provider.sameAs` from the passed `url` to the site root constant, and add to hasCourseInstance:
  "courseSchedule": { "@type": "Schedule", "repeatFrequency": "Weekly", "repeatCount": 1 },
  "offers": { "@type": "Offer", "category": "Paid", "price": "999", "priceCurrency": "INR", "url": "https://www.myyogaclasses.fit/pricing" }
and at the Course level add "educationalLevel": "Beginner" plus "inLanguage": "en". Pull the price from the resolved single-session pack rather than a literal.

### [MEDIUM] Every homepage H2 is pure brand voice; seven rewrites that keep the tone and add the head terms

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/components/marketing/HowItWorks.tsx, /Users/shalomp/YOGA_WEBSITE/components/marketing/PracticeSection.tsx, /Users/shalomp/YOGA_WEBSITE/components/marketing/TeacherGrid.tsx, /Users/shalomp/YOGA_WEBSITE/components/marketing/PricingTeaser.tsx, /Users/shalomp/YOGA_WEBSITE/components/marketing/TestimonialWall.tsx, /Users/shalomp/YOGA_WEBSITE/components/marketing/FAQ.tsx, /Users/shalomp/YOGA_WEBSITE/lib/data/landing.ts

**Evidence.** Live H2s on / in document order: "From sign-up to savasana in three steps." (components/marketing/HowItWorks.tsx:47), "Yoga shaped around whatever your body needs." (PracticeSection.tsx:34), "Real teachers. Real adjustments." (TeacherGrid.tsx:48), "Pay as you go. No lock-ins." (PricingTeaser.tsx:234), "Real practice, one mat at a time." (TestimonialWall.tsx:30), "Before you book." (FAQ.tsx:27), "Book your 1:1 session today." (DB-driven via admin_settings key landing.final_headline; code default at lib/data/landing.ts:290). Of seven, only one contains the word "yoga" and none contains "online", "1:1 teacher" or "session pack".

**Recommendation.** Edits, brand cadence preserved, no em-dashes:

HowItWorks.tsx:47 -> "From sign-up to savasana: how online 1:1 yoga works."  (keeps the savasana flourish, adds the head term)
PracticeSection.tsx:34 -> "Online yoga classes shaped around what your body needs."
TeacherGrid.tsx:48 -> "Real yoga teachers. Real adjustments. Live 1:1."
PricingTeaser.tsx:234 -> "1:1 yoga session packs. Pay as you go, no lock-ins."
TestimonialWall.tsx:30 -> "Online yoga reviews, one mat at a time."
FAQ.tsx:27 -> "Online yoga questions, answered before you book."
landing.final_headline -> "Book your live 1:1 online yoga session today."

IMPORTANT: the last one is DB-driven. Editing lib/data/landing.ts:290 changes only the zero-env mock path. The live string must be changed at /admin/settings, Landing copy, key `landing.final_headline`. Also note TestimonialWall.tsx:30 and FAQ.tsx:27 are shared components: the TestimonialWall edit also changes /reviews, and the FAQ edit also changes /pricing and /faq. That is the desired outcome in all three cases, since "Before you book." is currently the only H2 above the fold on /faq.

### [MEDIUM] Secondary-page H2s are FinalCTA headlines only; five rewrites

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/about/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/reviews/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/pricing/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/faq/page.tsx

**Evidence.** Live H2 inventory: /about has 2 ("How we work" at about/page.tsx:35, "Meet a teacher who learns your name." at about/page.tsx:44); /classes has exactly 1 ("Find the class type that fits you." at classes/page.tsx:23, a FinalCTA prop, for a 396-word page); /teachers has exactly 1 ("Book a 1:1 with any teacher above." at teachers/page.tsx:33) for a 175-word page; /reviews has 2; /faq has 2. On /classes and /teachers the only H2 on the page is the closing call to action, so the entire body of a category-hub page sits under the H1 with no subheading structure at all.

**Recommendation.** Replace the FinalCTA headline props and the /about H2:

app/(marketing)/about/page.tsx:35 -> <h2 ...>How our online 1:1 yoga sessions work</h2>
app/(marketing)/about/page.tsx:44 -> <FinalCTA headline="Meet an online yoga teacher who learns your name." />
app/(marketing)/classes/page.tsx:23 -> <FinalCTA headline="Find the online yoga class that fits your goal." />
app/(marketing)/teachers/page.tsx:33 -> <FinalCTA headline="Book a live 1:1 online yoga session with any teacher." />
app/(marketing)/reviews/page.tsx:22 -> <FinalCTA headline="Add your own online yoga review after your first session." />
app/(marketing)/pricing/page.tsx:29 and app/(marketing)/faq/page.tsx:26 -> <FinalCTA headline="Book your first live 1:1 yoga session." />

Separately, /classes and /teachers each need one real structural H2 above the grid, not just a closing CTA. In components/marketing/ClassGrid.tsx add "Online yoga classes by condition" and in components/marketing/TeacherGrid.tsx the /teachers instance should read "Certified online yoga teachers, live 1:1".

### [MEDIUM] Teacher pages and /contact have zero H2 elements

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/[slug]/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/contact/page.tsx

**Evidence.** Parsing <h2> across all 23 live pages: /teachers/dr-vaishnavi-mayya, /teachers/dr-sangeeta and /teachers/dr-hima-bindu each return an empty H2 list, as does /contact. The teacher pages render Specialties, Languages and a bio (171, 163 and 201 words respectively) entirely in unlabelled divs. /contact is 106 words with one H1.

**Recommendation.** In /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/[slug]/page.tsx promote the existing section labels to real headings:
  <h2>About {t.display_name}</h2>  above the bio
  <h2>What {firstName(t.display_name)} teaches</h2>  above the specialties row
  <h2>Book a live 1:1 online yoga session with {t.display_name}</h2>  above the CTA block at line ~126
In /Users/shalomp/YOGA_WEBSITE/app/(marketing)/contact/page.tsx add <h2>Contact our online yoga team</h2> above the form and <h2>What we can help with</h2> above the intro copy. These pages are thin (106 to 201 words) and heading structure is the cheapest signal available on them.

### [MEDIUM] All three teacher pages render the literal string "Dr" where a first name belongs

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/[slug]/page.tsx

**Evidence.** app/(marketing)/teachers/[slug]/page.tsx:56 `Meet {t.display_name.split(" ")[0]}, a quick hello.` and :126 `Book a 1:1 with {t.display_name.split(" ")[0]}`. Every display_name in the DB begins with the honorific: "Dr Vaishnavi Mayya", "Dr Sangeeta", "Dr Hima Bindu". Raw live HTML on /teachers/dr-vaishnavi-mayya contains `Book a 1:1 with <!-- -->Dr`. The rendered text is "Meet Dr, a quick hello." and the primary CTA button reads "Book a 1:1 with Dr" on all three pages.

**Recommendation.** In /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/[slug]/page.tsx add a helper above the component and use it at lines 56 and 126:

const HONORIFICS = new Set(["dr", "dr.", "mr", "mr.", "mrs", "mrs.", "ms", "ms.", "prof", "prof."]);
function firstName(displayName: string) {
  const parts = displayName.trim().split(/\s+/);
  return (HONORIFICS.has(parts[0].toLowerCase()) && parts[1]) ? parts[1] : parts[0];
}

This yields "Meet Vaishnavi, a quick hello." and "Book a 1:1 with Sangeeta". The CTA button label is the highest-conversion string on a teacher page and it currently reads as broken, which also undercuts the E-E-A-T signal these pages exist to carry.

### [MEDIUM] og:locale is the invalid value "en" on all 23 pages and there is no hreflang

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** low
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/layout.tsx

**Evidence.** app/layout.tsx:75 `locale: "en"`. Verified identical on /, /pricing and /classes/diabetes: `<meta property="og:locale" content="en">`. The Open Graph spec requires language_TERRITORY (en_US, en_GB), so "en" is dropped by Facebook and LinkedIn. No `alternates.languages` is set anywhere in the repo.

**Recommendation.** Change app/layout.tsx:75 to `locale: "en_US"`. On hreflang: do NOT add it yet. hreflang is only meaningful with genuinely distinct per-locale URLs, and there is exactly one English URL set. The correct global signal for this site is already in place (Organization.areaServed "Worldwide" at app/layout.tsx) plus explicit x-default behaviour by default. Revisit hreflang only if and when per-currency or per-region landing URLs ship. Adding `alternates.languages` pointing multiple hreflang values at the same URL would be a self-inflicted duplicate-signal problem.

### [MEDIUM] /login is indexable and declares the homepage as its canonical, because the root layout sets alternates.canonical to "/"

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(auth)/login/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/robots.ts, /Users/shalomp/YOGA_WEBSITE/app/layout.tsx

**Evidence.** `curl -s -o /dev/null -w "%{http_code}" https://www.myyogaclasses.fit/login` returns 200. robots.txt disallows only /admin, /dashboard and /api, so /login is crawlable. Its head contains `<title>Log in · My Yoga Classes</title>` and `<link rel="canonical" href="https://www.myyogaclasses.fit"/>`. The canonical comes from app/layout.tsx:71 `alternates: { canonical: "/" }`, which every segment that does not set its own canonical inherits. /login is not in sitemap.xml, so Google will crawl it, see it canonicalised to the homepage, and treat the homepage as having a duplicate: a wasted crawl path into an auth wall. /teacher and /dashboard correctly 307 away.

**Recommendation.** Two edits. (1) In /Users/shalomp/YOGA_WEBSITE/app/(auth)/login/page.tsx (or the (auth) layout) export `metadata = { robots: { index: false, follow: false }, alternates: { canonical: "/login" } }` so the page stops claiming to be the homepage. (2) Add `Disallow: /login` and `Disallow: /onboarding` to the robots rules alongside the existing three. Leave app/layout.tsx's `alternates: { canonical: "/" }` alone: it is correct for the homepage and every marketing page already overrides it, but audit any new route group for the same inherited-canonical trap.

### [MEDIUM] CORRECTION: /reviews renders 6 reviews, not 12, and every one is from the Gulf or India

- **Verdict:** unverified | **Effort:** moderate | **Impact:** medium
- **Locations:** https://www.myyogaclasses.fit/reviews, /Users/shalomp/YOGA_WEBSITE/components/marketing/TestimonialWall.tsx, /Users/shalomp/YOGA_WEBSITE/lib/data/landing.ts

**Evidence.** Full visible text of https://www.myyogaclasses.fit/reviews contains exactly six testimonials: Emma R. (Dubai, AE), James P. (Abu Dhabi, AE), Fatima H. (Abu Dhabi, AE), Noor S. (Sharjah, AE), Mohammed A. (Dubai, AE), Priya N. (Bengaluru, IN). Page word count is 275. Meanwhile the homepage trust bar serves `"4.9","trustCount":"1,200+ reviews"` while the teachers payload on the same page carries rating_count values of 98, 312 and 0, summing to 410. A US or UK searcher who lands on /reviews sees zero reviewers from their market and a 6-row page behind a "1,200+ reviews" promise.

**Recommendation.** Do NOT emit aggregateRating structured data anywhere until the visible count and the claimed count reconcile: marking up 1,200 reviews against 6 visible rows is a documented Google manual-action trigger and would put the new /pricing Product markup at risk. Concretely: (a) change the homepage trust bar to a defensible figure derived from the real rating_count sum, or drop the count and keep the average; (b) prioritise collecting and publishing reviews from US, UK, EU, Canada and Australia students, and surface the reviewer country on each card as it already does, so the /reviews page visibly supports the "students worldwide" positioning the Organization schema claims; (c) only once /reviews shows a real, countable set should you add Review and aggregateRating nodes, attached to the Product on /pricing rather than to Person (schema.org Person has no aggregateRating, as lib/seo/structuredData.ts:34-35 already correctly notes).

### [MEDIUM] No Google Search Console verification, so none of the above can be measured

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/layout.tsx, /Users/shalomp/YOGA_WEBSITE/next.config.ts

**Evidence.** `grep -io 'google-site-verification' ` over the live homepage HTML returns nothing, and no `verification` key exists in the Metadata export at app/layout.tsx:64-81. Next.js supports this natively and it is currently unused.

**Recommendation.** Add to the Metadata object in /Users/shalomp/YOGA_WEBSITE/app/layout.tsx:
  verification: { google: "<token from Search Console>", other: { "msvalidate.01": "<Bing token>" } },
This emits the meta tags server-side on every page with no CSP implication, since it adds no origin. Do NOT reach for Google Tag Manager or a third-party schema tool to solve any finding in this audit: next.config.ts ships a hand-maintained CSP whose script-src is 'self' 'unsafe-inline' https://checkout.razorpay.com https://*.posthog.com, so any new origin fails silently in production only. Once verified, submit sitemap.xml and watch the 9 condition URLs specifically.

### [LOW] /pricing description says "in AED and INR" while the live page renders INR only and reads "Prices shown in INR"

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/pricing/page.tsx, https://www.myyogaclasses.fit/pricing

**Evidence.** app/(marketing)/pricing/page.tsx:13: `description: "Honest yoga pricing in AED and INR. One-time session packs, no subscription."` (76 chars). An uncredentialed curl of https://www.myyogaclasses.fit/pricing renders exactly three prices: ₹999, ₹4,499, ₹7,999, and the footer line "Prices shown in INR . One-time payment, no subscription. Book from anywhere in the world." So the description promises two currencies, the page shows one, and neither is the searcher's. This also corrects established fact 12: ₹4,499 / 5 = ₹900 per session, roughly USD 10.20 at 88 INR, not the stated $23-24 (that was the AED figure, and AED does not render to an unlocated crawler). effectiveCurrency() in lib/razorpay/catalog.ts is doing exactly what 0036_international_currencies.sql documents: no plan_prices row for USD/GBP/EUR, so everyone downgrades to INR.

**Recommendation.** CORRECTED FINDING (severity: low, dimension: onpage)

Title: /pricing meta description spends its first five words on two currencies (AED, INR) that most of a worldwide audience does not use, and describes the billing rail instead of the product.

Corrected evidence: app/(marketing)/pricing/page.tsx:13 reads `description: "Honest yoga pricing in AED and INR. One-time session packs, no subscription."` (76 chars, using only half the ~155-char snippet budget). The description is ACCURATE, not contradictory: PricingTeaser.tsx is a client component that fetches /api/region after mount and swaps the rendered currency, and migration 0031 prices all three active packs in AED, so a UAE visitor genuinely sees AED while everyone else sees INR. The real defect is relevance, not truth. The prerendered snapshot a crawler indexes shows ₹999 / ₹4,499 / ₹7,999 and "Prices shown in INR", so the indexed version of this page leads with a currency symbol that is foreign to the US, UK and EU searchers the site wants. The description compounds that by naming two currencies rather than the product (live 1:1, 60 minutes, teacher-matched, no subscription, no expiry).

Corrected per-session math (replaces established fact 12, which is wrong): INR 5-pack = ₹899.80/session = $9.37 at the 2026-09-15 rate of 96.07 INR/USD. INR 10-pack = ₹799.90/session = $8.33. AED 5-pack = AED 55/session = $14.97. The audit's "$23-24/session" came from the AED 435 pack-5 price in migration 0022, which migration 0031 superseded with AED 275. Against the $60-120/hr US private-yoga rate the site is roughly 6-13x cheaper, not 3-5x. That is a bigger conversion story than the audit credited, which strengthens the case for surfacing it in copy.

Corrected recommendation:
(1) KEEP AS PROPOSED. Replace lines 12-13 of app/(marketing)/pricing/page.tsx with:
  title: "Online Yoga Pricing: 1:1 Session Packs"   (38 chars, 56 with the layout suffix)
  description: "Prepaid packs of live 1:1 yoga, priced per session with no subscription and no expiry date. Every session runs 60 minutes with your own teacher. See the packs."   (159 chars)
Verified compliant: code-owned metadata (not the DB-driven copy surfaces), no em-dash, no free-trial wording, keeps "1:1", no new CSP origin, no cookies() so the (marketing) ISR group is untouched. Rationale correction: avoid naming a currency not because the page cannot vary, but because the page varies only after hydration and a crawler indexes the pre-swap INR snapshot, so any currency in the static metadata will be wrong for most of the audience.
(2) REWRITE. Do NOT ship USD/GBP/EUR plan_prices rows as a no-code-change SEO lever. app/api/payments/intent/route.ts:101 sends every non-AED currency to Razorpay create-order, and Razorpay International is not enabled on the account (that is why AED runs on a manual SWIFT rail and why 0036 inserted no prices). Pricing in USD today would show $ on the card and then fail or mis-settle at checkout, breaking catalog.ts's grid-equals-checkout invariant. Correct sequence: (a) get Razorpay International acceptance, or extend the bank-transfer rail past its `preferred !== "AED"` guard; (b) then price all three active packs in USD/GBP/EUR at /admin/plans, all-or-nothing per currency since pricedCurrencies() requires full coverage; (c) only then does effectiveCurrency() stop downgrading.
(3) ADD (the real SEO win the finding missed). The indexed snapshot is INR-only regardless of what the description says, so put the global price story in server-rendered text that does not depend on hydration: a currency-neutral per-session line and a converted range in the PageHeader subhead or the footnote under the grid, plus Product/Offer or AggregateOffer JSON-LD on /pricing with `priceCurrency: "INR"` and the three real amounts (99900, 449900, 799900 paise). /pricing is the one money page with FAQPage schema but no Offer markup, which is a concrete, shippable gap the original finding did not raise.

### [LOW] All three legal pages emit the brand name twice because their title already contains it

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/legal/privacy/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/legal/terms/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/legal/refund/page.tsx

**Evidence.** Live: "Privacy policy | My Yoga Classes · My Yoga Classes" (50 chars), "Terms of service: My Yoga Classes · My Yoga Classes" (51), "Refund policy | My Yoga Classes · My Yoga Classes" (49). Source: app/(marketing)/legal/privacy/page.tsx:4 `title: "Privacy policy | My Yoga Classes"`, legal/terms/page.tsx:5 `title: "Terms of service: My Yoga Classes"`, legal/refund/page.tsx:4 `title: "Refund policy | My Yoga Classes"`. The `%s · My Yoga Classes` template in app/layout.tsx:66 appends the brand a second time. Separately, the privacy description is 258 chars and will be cut at roughly 160.

**Recommendation.** CORRECTED FINDING
Title: Three legal-page titles emit the brand twice, and two of them tell a global audience the service is UAE/India only
Severity: low (cosmetic SERP defect on three zero-intent pages; Google likely collapses the repeat itself). The jurisdiction wording in the descriptions is the part actually worth fixing for a worldwide audience.

Evidence (reproduced): as claimed — 50/51/49-char rendered titles, privacy description 258 chars, sources at app/(marketing)/legal/privacy/page.tsx:4, app/(marketing)/legal/terms/page.tsx:6 (not :5), app/(marketing)/legal/refund/page.tsx:4, template at app/layout.tsx:66. Confined to these three files; all other pages render the brand once.

CORRECTED RECOMMENDATION — sentence case to match the rest of the site, and no claim the page does not support:

app/(marketing)/legal/privacy/page.tsx:4
  title: "Privacy policy and your data rights"        (renders 53)
  description: "How My Yoga Classes collects, uses and protects your personal information, and how you can access, correct or delete your data at any time."  (139)

app/(marketing)/legal/terms/page.tsx:6
  title: "Terms of service for 1:1 yoga bookings"     (renders 56)
  description: "The terms covering your use of My Yoga Classes: accounts, bookings, prepaid session packs, cancellations, health disclaimers and your consumer rights."  (150)

app/(marketing)/legal/refund/page.tsx:4
  title: "Refund policy for prepaid session packs"    (renders 57)
  description: "When a prepaid session pack can be refunded, how to cancel a booked session, what happens after a technical failure, and how to request a refund."  (145)

Rejected from the original: "Privacy Policy and Health Data Handling" and "your personal and health information" — the privacy page contains zero mentions of health or medical data, so both overpromise. Do not ship them until the policy itself covers the medical-documents feature.

Kept from the original, and promoted to the headline reason: drop "under UAE and Indian law" / "under UAE and Indian consumer law" from the terms and refund descriptions. Consumer-rights language can stay; the country lock-in cannot.

All three edits are static metadata exports, so no ISR, CSP, DB-driven-copy, free-trial-copy or em-dash constraint is touched.

### [LOW] Four of the five H2s on each condition page are byte-identical across all nine pages

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/, /Users/shalomp/YOGA_WEBSITE/components/marketing/condition/ConditionLanding.tsx

**Evidence.** Counted across lib/data/condition-pages/*.json: `posesH2` "The poses we focus on, and why." appears on 8 of 9 (kids-yoga has "The poses we play with, and why."); `howH2` "How we work with you to get there." appears on all 9; `faqH2` "Questions people ask first." appears on all 9; and the FinalCTA headline is hardcoded in ConditionLanding.tsx:284 as `<FinalCTA headline="Book your 1:1 session today." />`, identical on all 9. Only `helpsH2` varies ("How yoga can support diabetes." etc.). So on the site's nine highest-value pages, 4 of 5 H2s carry zero page-specific signal.

**Recommendation.** CORRECTED FINDING
Title: Section-label H2s on the nine condition pages are page-invariant, wasting two keyword surfaces.
Severity: low (cheap, zero-risk, incremental; no duplicate-content or indexation risk).

Corrected evidence: each /classes/{slug} page renders exactly five H2s. helpsH2 is condition-specific; posesH2 is identical on 8 of 9 ("The poses we focus on, and why.", kids-yoga has "The poses we play with, and why.", so near-identical not byte-identical); howH2 and faqH2 are byte-identical on 9 of 9; the fifth H2 is the FinalCTA headline hardcoded at ConditionLanding.tsx:284. This is roughly 20 words of a 795-979 word page (~2%). Bodies are ~72% unique between diabetes and hypertension, and FAQ question text is near-fully unique, so there is no duplicate-content exposure. This copy is in repo JSON, not admin_settings, so a code edit does reach production.

Corrected recommendation, in priority order:
1. DO change posesH2 per file. This is the whole value of the finding: it creates the only on-page heading targeting the "yoga poses for X" cluster, which the 107 existing structured pose entries already back. Use the finding's proposed strings verbatim, they are on-brand and em-dash-free.
2. DO change faqH2 per file, same proposed strings. Lower value than posesH2 but free, and it puts the condition term adjacent to the FAQ block.
3. SKIP or deprioritize howH2. "How your 1:1 online sessions for diabetes work." is still template boilerplate with a swapped noun and targets no query. Leave it, or fold the condition term into the existing line only if you are already editing the file.
4. SKIP the ctaHeadline field and the ConditionLanding.tsx:284 change as an SEO measure. A bottom-of-page CTA H2 carries negligible ranking weight and /pricing and /faq already deliberately share "Book your first 1:1 session." If you want it for copy reasons, adding `ctaHeadline: string` to the ConditionPage type and passing `d.ctaHeadline` is safe (FinalCTA already requires a `headline` prop and every other call site passes one), but do not book it as an SEO win.

Also note for triage: the far larger on-page problem on these same nine pages is the title tag. app/(marketing)/classes/[slug]/page.tsx:31 sets `title: c?.name`, sourced from the class_categories DB row, producing "Diabetes · My Yoga Classes" with no keyword. That is DB-driven for the name portion, so unlike the H2s it cannot be fixed by editing JSON alone. Fix that before spending effort on H2 labels.

### [LOW] Homepage canonical omits the trailing slash that sitemap.xml declares

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** low
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/sitemap.ts, /Users/shalomp/YOGA_WEBSITE/app/layout.tsx

**Evidence.** Live homepage head: `<link rel="canonical" href="https://www.myyogaclasses.fit"/>`. app/sitemap.ts:10 emits `url: `${BASE_URL}/`` which renders `<loc>https://www.myyogaclasses.fit/</loc>`. The two disagree by one character. The site also serves 308 trailing-slash redirects, so both resolve, but a sitemap URL that is not byte-identical to the canonical it points at is a known cause of "Alternate page with proper canonical tag" noise in Search Console.

**Recommendation.** Make them match. Simplest fix is app/sitemap.ts:10, change `url: `${BASE_URL}/`` to `url: BASE_URL`. Alternatively set the homepage canonical to "/" explicitly with a trailing slash in app/layout.tsx. Pick one and keep the 22 other sitemap entries consistent (they are already slash-free and match their canonicals).

### [LOW] An em-dash reaches live user-facing copy on /classes and inside the Course JSON-LD on /classes/geriatric

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** low
- **Locations:** https://www.myyogaclasses.fit/classes, /Users/shalomp/YOGA_WEBSITE/lib/data/landing.ts, /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts

**Evidence.** Stripping tags from the live /classes HTML yields exactly one U+2014 in the visible body: "...to help with everyday mobility, balance, and confidence — with chair options as needed." It originates from `class_categories.description` for the geriatric row (visible in the RSC payload as `"name":"Geriatric Yoga","description":"Slow, supportive yoga for older adults to help with everyday mobility, balance, and confidence — with chair options as needed."`). Because courseJsonLd passes `cat.description` straight through, the same em-dash is also inside the structured data. The project standard in CLAUDE.md is no em-dashes in user-facing copy, and the earlier 323-instance sweep missed it because the string lives in the DB, not the repo.

**Recommendation.** This is DB-driven and cannot be fixed in code. Edit the geriatric row's `description` at /admin (class categories) to: "Slow, supportive yoga for older adults to help with everyday mobility, balance and confidence, with chair options as needed." Then run a one-off audit query for the rest of the admin-editable surface, since scrubRetiredCopy() in lib/data/landing.ts strips retired phrases but not punctuation:
  select 'class_categories' t, slug, description from class_categories where description like '%' || chr(8212) || '%'
  union all select 'class_categories_long', slug, long_description from class_categories where long_description like '%' || chr(8212) || '%'
  union all select 'teachers', slug, headline from teachers where headline like '%' || chr(8212) || '%'
  union all select 'teachers_bio', slug, bio from teachers where bio like '%' || chr(8212) || '%';
Optionally extend scrubRetiredCopy() to replace U+2014 with a comma at render time, which would catch future admin edits automatically.

### [LOW] /classes description is 166 chars and will truncate mid-list in the SERP

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** low
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/page.tsx

**Evidence.** app/(marketing)/classes/page.tsx:9-10 is 166 characters: "Diabetes, hypertension, prenatal, hormonal health, pain relief, mental health, weight loss, geriatric, kids: find the 1:1 yoga that fits what your body is working on." Google's desktop pixel budget cuts this at roughly "...weight loss, geriatric, kids: find the 1:1 yoga that fits...", so the CTA clause is the part lost.

**Recommendation.** Replace with the 151-char version that front-loads the benefit and keeps the condition list scannable: "Pick yoga built around what your body is working on: diabetes, blood pressure, pregnancy, pain, stress, weight, seniors and kids. Live 1:1, 60 minutes." Note this also swaps the clinical category labels ("hypertension", "hormonal health", "geriatric") for the words searchers actually type ("blood pressure", "pregnancy", "seniors"), which matters more on a hub page than internal naming consistency.

---

## schema (17)

### [MEDIUM] CORRECTION to the established audit: /reviews serves 6 fabricated testimonials, not 12 real ones, because the production reviews table is empty. This blocks all aggregateRating markup.

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** /reviews, /, lib/data/landing.ts:274, lib/data/landing.ts:376, lib/data/landing.ts:384, supabase/seed.sql:37, lib/seo/structuredData.ts

**Evidence.** lib/data/landing.ts:376 `if (!isSupabaseConfigured) return MOCK_REVIEWS;` then :384 `if (!data || data.length === 0) return MOCK_REVIEWS;`. The live /reviews RSC flight payload contains exactly 6 objects, all matching MOCK_REVIEWS at lib/data/landing.ts:274+ verbatim: `{"id":"r1","customer_id":"","teacher_id":"t1",...,"display_name_override":"Emma R.","display_location":"Dubai, AE","created_at":""}` through r6. Empty customer_id and empty created_at prove these are code constants, not DB rows. The `.eq("is_featured",true).eq("is_approved",true)` query therefore returns 0 rows in production. Separately, the homepage trust bar renders from admin_settings: `"trustRating":"4.9","trustCount":"1,200+ reviews"`. Teacher ratings are seeded too: supabase/seed.sql:37 inserts rating_avg/rating_count, and live values are 4.85/98 (Dr Vaishnavi Mayya), 4.95/312 (Dr Sangeeta), 5/0 (Dr Hima Bindu). Net: zero real reviews exist anywhere in production.

**Recommendation.** Corrected finding (severity: medium on the schema dimension; the trust/advertising exposure is separate and higher).

CORRECTED CLAIM: The production `reviews` table returns zero rows, so lib/data/landing.ts:384 silently substitutes the 6-entry MOCK_REVIEWS array on both / and /reviews. Proof is not the count of 6 (TestimonialWall.tsx:34 slices to 6 regardless of a `.limit(9)` query) but the payload fields: the live /reviews flight data carries `customer_id\":\"\"` and `created_at\":\"\"` six times and the bodies match lib/data/landing.ts:274+ verbatim. Separately and more seriously, seeded teacher ratings render as VISIBLE star ratings on two public templates: /teachers/dr-sangeeta serves `<span class="font-medium">5.0</span><span>· 312 reviews</span>` from app/(marketing)/teachers/[slug]/page.tsx:89-93, and /teachers does the same from components/marketing/TeacherGrid.tsx:93-98, both gated only on `rating_count > 0` (live values 4.85/98, 4.95/312, 5/0). The homepage trust bar adds "4.9 · 1,200+ reviews" from admin_settings. No aggregateRating markup exists anywhere (verified live on /pricing, /classes/diabetes, /teachers/[slug]), so there is no current rich-result defect. The cost today is fabricated visible content on indexed URLs and a blocked future enhancement.

CORRECTED RECOMMENDATION, four steps in this order:

1. DB first, because it is the only visible star rating and code cannot reach it. Run on the live DB: `update public.teachers set rating_count = 0, rating_avg = 0;`. The `rating_count > 0` gates then hide the widget on /teachers and /teachers/[slug] with no code change. Follow with `POST /api/admin/revalidate` to bust ISR on /, /teachers, /teachers/[slug].

2. Then the mock fallback, paired with a noindex so the page does not become thin content. Change lib/data/landing.ts:384 to `if (!data) return [];` (keep the `!isSupabaseConfigured` guard at :376 for the zero-env preview story). Because TestimonialWall.tsx:9 returns null on an empty array rather than rendering an empty state, /reviews would otherwise be PageHeader + FinalCTA only while still listed at app/sitemap.ts:39. So in the same change: delete the /reviews entry from app/sitemap.ts and add `robots: { index: false, follow: true }` to the metadata export in app/(marketing)/reviews/page.tsx. Restore both when a real corpus exists. The homepage section self-hides, which is correct.

3. Then admin_settings at /admin/settings → Landing copy: clear `landing.trust_rating` and replace `landing.trust_count` with a defensible non-rating proof point, for example "Certified teachers, live 1:1". Code cannot touch these.

4. Ship the guarded builder, correctly scoped. The code in the original finding is fine, with two labels corrected: RATING_FLOOR = 10 is a house evidence floor, not a Google requirement, and `reviewCount` is right only while every row has a body (`ratingCount` if bare stars are ever accepted). Note that /pricing currently emits no Product node at all (verified: only Organization + FAQPage), so wiring it there is contingent on adding Product/AggregateOffer first, which is a separate item. The eligible-carrier analysis is correct as stated and verified against Google's live review-snippet doc: Course on /classes/[slug] and Product on /pricing are the only two legitimate carriers here; Organization and LocalBusiness are permanently ineligible for a first-party site, and Service is not an eligible type.

### [MEDIUM] The site emits 23 anonymous, unlinkable Organization nodes. No @id anywhere means Person.worksFor, Course.provider and any future Offer.seller are separate entities Google must reconcile by string matching.

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** app/layout.tsx:85, lib/seo/structuredData.ts:41, lib/seo/structuredData.ts:56, lib/seo/structuredData.ts

**Evidence.** Parsed all 23 sitemap URLs. Every one carries the identical 566-byte Organization block from app/layout.tsx:85 with no @id. /teachers/dr-vaishnavi-mayya carries a second, different Organization inside Person.worksFor: `"worksFor":{"@type":"Organization","name":"My Yoga Classes"}` (no url, no @id) from lib/seo/structuredData.ts:41. /classes/diabetes carries a third inside Course.provider. Three distinct Organization nodes on the site describing one company, joined only by the literal string "My Yoga Classes".

**Recommendation.** Corrected finding (medium, not high):

Title: Course.provider emits a false sameAs on all 9 condition pages, and the site's Organization node is duplicated on every route with no @id.

Evidence: lib/seo/structuredData.ts:56 builds provider as {"@type":"Organization","name":"My Yoga Classes","sameAs":url}, reusing the page url. Live on /classes/diabetes, /classes/hypertension and /classes/kids-yoga, provider.sameAs is the class page URL, which asserts the company and the landing page are one entity. Separately, app/layout.tsx:85 emits an identical 566-byte Organization with no @id on every route (confirmed on /login, which is not in the sitemap), and structuredData.ts:41 nests a second anonymous Organization in Person.worksFor.

Fix, in priority order:

1. Delete the wrong sameAs. This is the only part with a documented signal at stake. In courseJsonLd, provider becomes {"@type":"Organization","name":ORG_NAME,"url":SITE_URL}. One line, ships today.

2. Add @id refs. Worth doing as cheap hygiene, not as a headline item. Export SITE_URL and ORG_ID = `${SITE_URL}/#organization` from lib/seo/structuredData.ts, add "@id": ORG_ID to the layout's orgJsonLd, and set worksFor and provider to {"@id": ORG_ID}. Do NOT add WEBSITE_ID or SERVICE_ID: the site emits no WebSite and no Service node, so those exports would be dead code.

3. Optional, defer: the full pageGraph(@graph) refactor. It touches five call sites to save about 70 bytes per page (0.08% of a 90 KB page, pre-brotli). Byte saving is not a valid justification. Do it only if a later finding adds enough nodes per page to make one script tag genuinely tidier.

Drop from the recommendation: the "highest-leverage change in the audit" framing, and the claim that @id drives Knowledge Graph entity resolution in markets without citations. Google's Organization doc lists no required properties and does not mention @id. The real leverage for a global 23-URL site is URL count and internal linking, not node identifiers.

Related, file separately: Organization is emitted sitewide from the root layout, contrary to Google's guidance to place it on the home page or a single about page. Harmless but redundant on 20-plus routes.

Also correct established item 7: condition pages carry only Organization and Course. They have no FAQPage.

### [MEDIUM] /pricing has zero commerce markup. Design: co-typed Product+Service with two Offer nodes per pack, one for INR and one for AED only.

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** /pricing, app/(marketing)/pricing/page.tsx:18, lib/seo/structuredData.ts, lib/razorpay/catalog.ts

**Evidence.** Live /pricing (93,405 bytes) carries exactly two JSON-LD blocks: Organization and FAQPage. No Product, no Offer, no Service. The real prices are already in the server payload the page renders (app/(marketing)/pricing/page.tsx:18 `const plans = await getPlansWithFeatures()`), verified from the flight data: pack-1 "1-Session Pack" price_base_cents 99900 with plan_prices INR 99900 and AED 5900; pack-5 "5-Session Pack" 449900 with INR 449900 and AED 27500; pack-10 "10-Session Pack" 799900 with INR 799900 and AED 49900. Exactly two currencies have plan_prices rows. This also CORRECTS established-audit item 12: the 5-pack is INR 4,499 for 5 sessions = INR 899.80/session (roughly USD 10) or AED 275 = AED 55/session (roughly USD 15), not USD 23-24/session.

**Recommendation.** CORRECTED FINDING

/pricing carries no commerce markup at all: exactly two JSON-LD blocks, Organization and FAQPage (verified live, 93,405 bytes, zero Product/Offer/Service). The pack data is already in the server payload at app/(marketing)/pricing/page.tsx:18, so this is a pure emit-what-you-already-have fix. Severity MEDIUM, not high: Google's product-snippet guidance states product rich results "only support pages that focus on a single product" and recommends against marking up "pages that list products or a category of products", so a three-pack pricing page will very likely not earn a price snippet. Ship it for AI and entity systems (Gemini, ChatGPT, Perplexity reading machine-readable pricing), and treat a Google product snippet as an upside, not the justification.

FOUR FIXES TO THE RECOMMENDATION.

1. Add the Organization @id FIRST. In app/layout.tsx:85, add `"@id": \`${siteUrl}/#organization\`` to orgJsonLd. Without it, brand/provider/seller point at a node that does not exist.

2. Do NOT restrict the INR offer to India. Verified: region.ts maps US/GB/EU to USD/GBP/EUR, and effectiveCurrency downgrades every one to INR because only INR and AED are priced, so INR is what every non-AE customer on earth actually pays. Correct shape:
   - AED offer: `"eligibleRegion": {"@type": "Country", "name": "AE"}`
   - INR offer: NO eligibleRegion at all (it is the worldwide default price). Adding `"name": "IN"` would announce that the pack is unavailable outside India, which contradicts the no-service-area-gate fact and the global-SEO goal.

3. Use the DB description, not a hardcoded string. `description: plan.description` (already scrubbed by scrubRetiredCopy at lib/data/landing.ts:366). Same for `name: plan.name`, `eligibleQuantity.value: plan.session_credits`, and `"@id": \`${siteUrl}/pricing#${plan.slug}\``. Nothing in the node should be hand-typed except serviceType, category, areaServed and availableChannel.

4. Wrap the three nodes in an ItemList. Since Google will not serve a product snippet from a list page anyway, emit one `ItemList` whose `itemListElement` carries the three co-typed `["Product","Service"]` nodes in sort_order. That is the honest description of the page and is what entity systems parse cleanly, instead of three orphan Product nodes competing to be "the" product.

Corrected pack-5 node (values derived, never hardcoded):

{
  "@type": ["Product", "Service"],
  "@id": "https://www.myyogaclasses.fit/pricing#pack-5",
  "name": "5-Session Pack",
  "description": "Five personalised 1:1 sessions - your flexible way in.",
  "serviceType": "Private 1:1 online yoga instruction",
  "category": "Online yoga instruction",
  "url": "https://www.myyogaclasses.fit/pricing",
  "image": "https://www.myyogaclasses.fit/opengraph-image",
  "brand":    { "@id": "https://www.myyogaclasses.fit/#organization" },
  "provider": { "@id": "https://www.myyogaclasses.fit/#organization" },
  "areaServed": { "@type": "AdministrativeArea", "name": "Worldwide" },
  "availableChannel": {
    "@type": "ServiceChannel",
    "serviceUrl": "https://www.myyogaclasses.fit/pricing",
    "availableLanguage": ["English", "Hindi", "Kannada"]
  },
  "offers": [
    {
      "@type": "Offer",
      "price": "4499.00",
      "priceCurrency": "INR",
      "availability": "https://schema.org/InStock",
      "url": "https://www.myyogaclasses.fit/pricing",
      "seller": { "@id": "https://www.myyogaclasses.fit/#organization" },
      "eligibleQuantity": { "@type": "QuantitativeValue", "value": 5, "unitText": "session" }
    },
    {
      "@type": "Offer",
      "price": "275.00",
      "priceCurrency": "AED",
      "availability": "https://schema.org/InStock",
      "url": "https://www.myyogaclasses.fit/pricing",
      "seller": { "@id": "https://www.myyogaclasses.fit/#organization" },
      "eligibleRegion": { "@type": "Country", "name": "AE" },
      "eligibleQuantity": { "@type": "QuantitativeValue", "value": 5, "unitText": "session" }
    }
  ]
}

pack-1: 999.00 INR / 59.00 AED, eligibleQuantity 1. pack-10: 7999.00 INR / 499.00 AED, eligibleQuantity 10.

Unchanged and correct from the original: two Offer nodes rather than AggregateOffer (lowPrice/highPrice take a single priceCurrency, so an INR/AED AggregateOffer is malformed); emit nothing for USD/GBP/EUR; derive price as (amount_cents / 100).toFixed(2) from the plan_prices rows; never fall back to plans.price_base_cents for a non-INR offer; omit priceValidUntil; no prices in name; aggregateRating only if a real rating floor is met. Also unchanged: this adds no fetch, no cookies(), and keeps /pricing on revalidate=60, so ISR in the (marketing) group is untouched, and it introduces no third-party origin so the CSP in next.config.ts needs no edit.

Separately, the finding's correction to established-audit item 12 is confirmed and should be adopted: the 5-pack is INR 899.80/session (roughly USD 10) or AED 55/session (roughly USD 15), not USD 23-24/session. Item 12 as written is wrong by roughly 2x, which matters because it understates how far below the USD 60-120 US private-yoga rate this site actually sits.

### [MEDIUM] Course markup cannot win a rich result as built: Course info was removed from Search 2025-06-12, and the surviving Course list carousel needs an ItemList on /classes, which carries no structured data at all

- **Verdict:** partially-correct | **Effort:** substantial | **Impact:** medium
- **Locations:** /classes, /classes/diabetes, lib/seo/structuredData.ts:51, app/(marketing)/classes/page.tsx, app/(marketing)/classes/[slug]/page.tsx:48

**Evidence.** Google removed Course info rich results from Search on 2025-06-12 and dropped them from Search Console reporting, the Rich Results Test and the appearance filters on 2025-09-09. The surviving feature is the Course list carousel, whose docs require carousel (ItemList) markup on a summary page or an all-in-one page, a minimum of three courses, and per-Course `name` plus `description` (60-character display limit). Live /classes (82,278 bytes) emits exactly ONE JSON-LD block: Organization. No ItemList, no Course nodes. Meanwhile the current courseJsonLd output (lib/seo/structuredData.ts:51-66) carries name, description, url, provider (with the broken sameAs above) and a hasCourseInstance of only `courseMode: "Online"` and `courseWorkload: "PT60M"`. Missing versus the recommended set: provider.url, offers, image, inLanguage, about, teaches, educationalLevel, courseSchedule, instructor, aggregateRating, hasCourseInstance.location. Google's Course content guidelines exclude "single short videos", "content lacking explicit educational outcomes" and "courses without instructor leadership and student roster" — instructor-led 1:1 sessions clear all three, so the type is legitimate here.

**Recommendation.** SEVERITY: medium, not high.

EVIDENCE, corrected: 2025-06-12 was the deprecation BANNER ("Added banners ... to indicate upcoming changes"), not the removal from Search. 2025-09-09 is when Google "Removed documentation" and the types became "no longer shown in Google Search results." Do not claim the changelog documents a Search Console / Rich Results Test / appearance-filter removal on that date; it does not say so. Also correct the count: /classes emits one JSON-LD block (Organization), confirmed at exactly 82,278 bytes.

DO SHIP part (1), unchanged in shape. Add `courseListJsonLd(categories, siteUrl)` and render it on app/(marketing)/classes/page.tsx, which today renders no JsonLd. The proposed ItemList matches Google's documented all-in-one example (ListItem.position + nested item Course with url). Nine positions ordered by sort_order. Build name/description from the existing category row rather than hand-writing code strings, so admin edits to class_categories still flow through:

itemListElement: categories.map((c, i) => ({
  "@type": "ListItem",
  position: i + 1,
  item: {
    "@type": "Course",
    url: `${siteUrl}/classes/${c.slug}`,
    name: c.name.toLowerCase().includes("yoga") ? `1:1 ${c.name}` : `1:1 Yoga: ${c.name} focus`,
    description: c.description ?? undefined,
    provider: { "@type": "Organization", name: "My Yoga Classes", sameAs: siteUrl },
  },
}))

Drop the "keep each description under 60 characters" instruction. 60 is a display truncation, not a validity rule, and Google's own published example uses an 81-character description. Forcing short strings in code would fork the copy away from the DB.

DROP part (2) almost entirely. Google's surviving Course list carousel supports exactly Course.name, Course.description, Course.provider, ItemList.itemListElement / ListItem.position / ListItem.url. provider.url, offers, image, inLanguage, about, teaches, educationalLevel, courseSchedule, instructor, aggregateRating and hasCourseInstance.location are the RETIRED Course info property list and earn nothing. Specifically do not ship: repeatFrequency/repeatCount on CourseInstance (they belong on courseSchedule, and are unsupported either way); educationalLevel: cat.intensity (gentle/moderate/intense is physical intensity, not learner level); provider by @id (orgJsonLd at app/layout.tsx:84-103 has no @id, the reference would dangle); and the hardcoded INR 999.00 Offer (the condition pages show no price, currency is resolved per-request by effectiveCurrency() while these routes are ISR-cached at revalidate = 300, and migration 0031 still holds a stale 135000 placeholder, so the figure will drift).

KEEP exactly one detail-page change, a one-line fix at lib/seo/structuredData.ts:56: provider.sameAs is currently the class page's own URL. Point it at the organization's identity instead (INSTAGRAM_URL, already exported at lib/seo/structuredData.ts:20, or siteUrl). Google's reference example uses sameAs for the provider's own site, and provider is the one recommended property the surviving spec still has.

ADD an eligibility caveat the finding omits. Google requires "a series or unit of curriculum that contains lectures, lessons, or modules" that is "led by one or more instructors with a roster of students." Standalone 60-minute 1:1 sessions bought as prepaid packs are a contestable fit. Ship the ItemList because it is cheap and content-matched, but treat the carousel as speculative upside, not a reliable win, and confirm in Search Console rather than assuming eligibility.

### [MEDIUM] personJsonLd ignores the credential and experience data already sitting in the teachers table, which is the exact E-E-A-T payload a health-adjacent global site needs

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** lib/seo/structuredData.ts:36, https://www.myyogaclasses.fit/teachers/dr-vaishnavi-mayya, https://www.myyogaclasses.fit/teachers/dr-hima-bindu, lib/supabase/types.ts

**Evidence.** lib/seo/structuredData.ts:36-48 emits only name, url, jobTitle, worksFor, knowsAbout, knowsLanguage, image, description. The live /teachers flight payload shows the unused fields are populated: Dr Vaishnavi Mayya has `"years_experience":9, "certifications":["Bachelor of Naturopathy and Yogic Sciences","MD in Clinical Yoga"]`; Dr Hima Bindu has `"years_experience":8, "certifications":["Doctor of Yogic Sciences"], "languages":["English","Kannada","Hindi"]`; Dr Sangeeta has `"years_experience":2, "certifications":[]`. None of it reaches JSON-LD. Live Person on /teachers/dr-vaishnavi-mayya has no hasCredential, no alumniOf, no makesOffer, no nationality.

**Recommendation.** Corrected finding: personJsonLd omits populated credential and language-depth data (certifications, years_experience) that would let search and AI systems resolve these three teachers as credentialed health-adjacent practitioners. Severity MEDIUM: no rich result exists for Person, it affects 3 of 23 indexable URLs, and the credentials already appear in crawlable bio prose. Worth doing because it is ~20 lines and DB-sourced, not because it moves rankings on its own.

Corrected implementation (keeps @context and the WithContext<Person> return type, drops the non-existent orgRef/SERVICE_ID/makesOffer, drops nationality, fixes the O*NET code, and does not overstate experience):

export function personJsonLd(t: Teacher, url: string): WithContext<Person> {
  const certs = Array.isArray(t.certifications)
    ? t.certifications.filter((c): c is string => typeof c === "string")
    : [];
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: t.display_name,
    url,
    jobTitle: "Yoga Teacher",
    worksFor: { "@type": "Organization", name: ORG_NAME },
    knowsAbout: t.specialties?.length ? t.specialties : undefined,
    knowsLanguage: t.languages?.length ? t.languages : undefined,
    image: t.avatar_url ?? undefined,
    description: t.headline ?? undefined,
    workLocation: { "@type": "Country", name: "India" },
    hasOccupation: {
      "@type": "Occupation",
      name: "Yoga Teacher",
      occupationalCategory: "39-9031.00",
    },
    hasCredential: certs.length
      ? certs.map((c) => ({
          "@type": "EducationalOccupationalCredential",
          name: c,
          credentialCategory: "degree",
        }))
      : undefined,
  };
}

Changes from the original recommendation and why:
1. "@context" and the WithContext<Person> return type are restored. Without them the standalone <script> at app/(marketing)/teachers/[slug]/page.tsx:43 emits invalid JSON-LD and the existing working markup is lost.
2. makesOffer removed. It referenced SERVICE_ID, which exists nowhere in the repo, and no node on this site emits an @id. If an Offer is wanted later, build it on /pricing as Product/AggregateOffer with priceCurrency "INR" only, never a cross-currency price derived from plans.price_base_cents.
3. nationality removed. No nationality column exists; timezone "Asia/Kolkata" is residence, not nationality. workLocation Country India is the honest version and is retained.
4. experienceRequirements / monthsOfExperience removed. years_experience = 9 for Dr Vaishnavi but her visible bio says 6 years of clinical teaching, so 108 months would contradict on-page content and breach Google's match-the-visible-content policy. If the owner wants it, add a distinct teachers.years_teaching column first and use that.
5. occupationalCategory corrected from 25-1193.00 (Recreation and Fitness Studies Teachers, Postsecondary) to 39-9031.00 (Exercise Trainers and Group Fitness Instructors), under which Yoga Instructor is a listed reported job title.
6. recognizedBy Country India dropped from each credential. recognizedBy expects the awarding or recognising body; naming a country there is filler, and the awarding institution is exactly the data the finding rightly says does not exist.
7. The alumniOf advice stands as written and should be kept verbatim. The knowsAbout URL-resolution idea also stands and is the higher-leverage half of this finding, because it creates real internal links from 3 teacher pages into the condition pages, which the first-pass audit already identified as internal-linking dead ends.

### [MEDIUM] No WebSite node. Sitelinks SearchAction is dead, but WebSite itself still drives the SERP site-name feature and is worth emitting without SearchAction.

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** app/layout.tsx:85, lib/seo/structuredData.ts

**Evidence.** Zero WebSite nodes across all 23 URLs. On SearchAction: Google removed the sitelinks search box from Search on 2024-11-21, stating "we've noticed that usage has dropped. With that, and to help simplify the search results, we'll be removing this visual element starting on November 21, 2024." WebSite.potentialAction/SearchAction markup now does nothing. WebSite.name, however, is one of the inputs to Google's site name feature, which is live and renders on every result from the domain.

**Recommendation.** Emit WebSite, omit SearchAction. New builder `websiteJsonLd()`, rendered once in the root layout graph:

```json
{
  "@type": "WebSite",
  "@id": "https://www.myyogaclasses.fit/#website",
  "url": "https://www.myyogaclasses.fit",
  "name": "My Yoga Classes",
  "alternateName": "MyYogaClasses",
  "description": "Live online 1:1 yoga with teachers from India, for students anywhere in the world.",
  "publisher": { "@id": "https://www.myyogaclasses.fit/#organization" },
  "inLanguage": "en"
}
```

Do not add potentialAction/SearchAction: the site has no /search route to point it at, and the feature it served no longer exists. `inLanguage: "en"` here is also the honest statement while the site is monolingual, and it is the node hreflang would eventually hang off if the owner ever localises.

### [MEDIUM] LocalBusiness must not be added, and Organization should be co-typed OnlineBusiness instead. Organization.logo also points at an SVG when a 2400x800 PNG is already deployed.

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** app/layout.tsx:85, app/layout.tsx:89, public/logo-email.png, https://www.myyogaclasses.fit/logo-email.png

**Evidence.** Live Organization: `"logo":"https://www.myyogaclasses.fit/icon.svg"` (app/layout.tsx:89). app/icon.svg is 846 bytes. Meanwhile public/logo-email.png is 78,871 bytes at 2400x800 and serves 200 at https://www.myyogaclasses.fit/logo-email.png. The business has no premises a student visits: teachers are in India (teachers.timezone = "Asia/Kolkata" on all three), sessions are on Meet, and areaServed is correctly "Worldwide".

**Recommendation.** LocalBusiness: NO, and the argument is specific, not squeamish. LocalBusiness exists to attach a business to a geography so Google can serve it for near-me intent, and it wants a PostalAddress. There is no address a customer visits, so any address supplied would be a back office, not a place of service. Worse, it is self-defeating twice over: (a) it would compete with the correct `areaServed: "Worldwide"` by inviting Google to bound the service to one country, which is the exact opposite of the stated global goal; and (b) Google's review-snippet rule makes first-party LocalBusiness pages permanently ineligible for star ratings, so it would foreclose the one thing the owner probably wants from it. The right upgrade is schema.org OnlineBusiness, an Organization subtype added specifically for businesses with no physical premises:

```json
{
  "@type": ["Organization", "OnlineBusiness"],
  "@id": "https://www.myyogaclasses.fit/#organization",
  "name": "My Yoga Classes",
  "url": "https://www.myyogaclasses.fit",
  "logo": { "@type": "ImageObject",
            "url": "https://www.myyogaclasses.fit/logo-email.png",
            "width": 2400, "height": 800 },
  "image": "https://www.myyogaclasses.fit/opengraph-image",
  "sameAs": ["https://www.instagram.com/myyogaclasses.fit/"],
  "areaServed": { "@type": "AdministrativeArea", "name": "Worldwide" },
  "knowsLanguage": ["en", "hi", "kn"],
  "foundingLocation": { "@type": "Country", "name": "India" },
  "contactPoint": { "@type": "ContactPoint", "contactType": "customer support",
                    "email": "hello@myyogaclasses.fit",
                    "availableLanguage": ["English", "Hindi", "Kannada"],
                    "areaServed": "Worldwide" }
}
```

ImageObject: this is the one place it earns its keep. Google's Organization logo guidance wants a crawlable raster it can render, and an 846-byte SVG is a known weak point for the knowledge-panel logo slot. Point logo at /logo-email.png with explicit width/height. Do not add ImageObject anywhere else; plain URL strings are fine for Person.image and Course.image.

knowsLanguage: the current `["en"]` understates the roster. Dr Hima Bindu's live row is `"languages":["English","Kannada","Hindi"]`, so the organization genuinely teaches in three languages. Saying so is both honest and a real global-reach signal. sameAs currently lists one profile; every additional verified profile (YouTube, LinkedIn, a Google Business Profile if one exists) is the cheapest entity-consolidation input available.

### [MEDIUM] A literal placeholder testimonial is shipped to production on all 9 condition pages, which is an E-E-A-T liability and independently rules out Review markup there

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** lib/data/condition-pages/diabetes.json, lib/data/condition-pages/, components/marketing/condition/ConditionLanding.tsx, /classes/diabetes

**Evidence.** lib/data/condition-pages/diabetes.json: `"testimonialWho": "<strong>Placeholder, swap for a real review.</strong> Member · practising for 5 months"`, paired with `"testimonialQuote": "I started after my type 2 diagnosis, nervous about getting it wrong..."`. This renders on the live page. The same structure exists in all nine condition JSON files.

**Recommendation.** Not a schema bug, but it directly gates the schema plan: no Review or aggregateRating node can go on a page that visibly labels its own social proof as a placeholder, and a human quality rater reading "Placeholder, swap for a real review" is an instant trust failure on a health-adjacent page. Two options, in order of preference: (1) remove the testimonial block from ConditionLanding until real reviews exist, and make the field optional in the ConditionPage type so the section is skipped when absent; (2) if it must stay, replace the testimonialWho string with a neutral attribution that does not assert a real person. Once real condition-specific reviews land in the reviews table, they become the legitimate input to the Course aggregateRating described in the critical finding above.

### [MEDIUM] og:locale is the invalid value "en", which weakens the same entity signals the JSON-LD work is meant to strengthen

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** low
- **Locations:** app/layout.tsx:76, https://www.myyogaclasses.fit/

**Evidence.** Live on /: `<meta property="og:locale" content="en"/>`, set at app/layout.tsx:76 `locale: "en"`. The Open Graph spec requires language_TERRITORY (e.g. en_US), not a bare ISO 639-1 code. Confirms established-audit item 8.

**Recommendation.** One line in app/layout.tsx:76. Set `locale: "en_US"` as the primary and, if the owner wants to signal the two priced markets, add `alternateLocale: ["en_IN", "en_AE"]` (Next.js Metadata supports openGraph.alternateLocale). en_US is the right primary for a worldwide English service even with Indian teachers, because it is the locale most consumers default to. This is a metadata fix rather than JSON-LD, but it belongs in the same change: og:locale, WebSite.inLanguage and Organization.knowsLanguage are read as one bundle, and today they disagree (og says "en", the org says ["en"], and the roster actually teaches in three languages).

### [MEDIUM] CORRECTION to the established audit: condition pages carry no FAQPage markup at all, contrary to item 7, despite each rendering five visible condition-specific questions

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** low
- **Locations:** app/(marketing)/classes/[slug]/page.tsx:6, app/(marketing)/classes/[slug]/page.tsx:48, /classes/diabetes, /pricing

**Evidence.** Parsed /classes/diabetes, /classes/geriatric, /classes/kids-yoga, /classes/prenatal and /classes/mental-health: each returns exactly two JSON-LD blocks, Organization (566 bytes) and Course, and no FAQPage. Confirmed in code: app/(marketing)/classes/[slug]/page.tsx imports only `courseJsonLd` (line 6) and renders only that (line 48). The visible accordion exists, live HTML on /classes/diabetes shows `<h2>Questions people ask first.</h2>` followed by an Accordion, and the flight payload carries `"faqs":[{"q":"Can yoga replace my diabetes medication?",...},{"q":"Do I need to be fit or flexible to start?",...}]`. Nine pages x five questions = 45 Q&A pairs with no machine-readable form.

**Recommendation.** Flagged separately from the FAQ deprecation finding because the correction matters for how the owner reads their own coverage: they believe four page types are covered and only three are. The fix is the three-line addition in the FAQ finding above. Do it for AI-extraction value, not rich results, and be clear with the owner that it will produce zero SERP change. If a second first-pass claim needs revisiting for the same reason, item 12's "5-pack is ~$23-24/session" is also wrong: the live plan_prices rows are INR 449900 and AED 27500 for five sessions, i.e. roughly USD 10 to USD 15 per session depending on currency, which makes the gap to the USD 60-120 US private-yoga rate far wider than the first pass assumed and strengthens rather than weakens the pricing argument.

### [LOW] app/layout.tsx:127 renders the sitewide Organization JSON-LD with raw JSON.stringify, bypassing the XSS-escaping JsonLd component that exists precisely to stop this

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** app/layout.tsx:127, components/shared/JsonLd.tsx:10

**Evidence.** app/layout.tsx:127 `dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}`. Compare components/shared/JsonLd.tsx:10-17, whose comment says "JSON.stringify does NOT escape `<`, `>`, `&`, or the JS line terminators U+2028/U+2029, so a teacher-/customer-editable field ... containing `</script>` would break out of this inline <script> and execute" and which applies `HTML_UNSAFE = new RegExp("[<>&\\u2028\\u2029]", "g")`. Every other JSON-LD on the site goes through <JsonLd>; the root layout is the one hole. It is safe today only by accident: every field in orgJsonLd (app/layout.tsx:85-107) is a hardcoded constant.

**Recommendation.** Severity: low (code-hygiene / defense-in-depth, not critical). Reclassify out of the schema dimension's ranked SEO findings and into a hardening checklist item, since it has no search-engine impact in either direction.

Corrected evidence wording: "It is not exploitable today because no user- or DB-supplied value reaches this node. Five fields are string literals, sameAs is the INSTAGRAM_URL literal (lib/seo/structuredData.ts:20), and url/logo derive from siteUrl (app/layout.tsx:60) = process.env.NEXT_PUBLIC_SITE_URL, a build-time env var that only a deploy-capable operator can set." Drop the claim that every field is a hardcoded constant.

Corrected framing of why to do it: not "close the hole" (there is no open hole) but "remove the second, unescaped code path before anyone wires admin_settings content into the Organization node." That is a plausible next step given the audit recommends enriching Organization, and the PR #38 stored-XSS in JsonLd showed the class of bug is live in this codebase.

Recommendation is otherwise unchanged and correct: in app/layout.tsx, add `import { JsonLd } from "@/components/shared/JsonLd";` and replace lines 125-128 with `<JsonLd data={orgJsonLd} />`. Keep the standing rule that no component constructs its own <script type="application/ld+json">. Keep the certifications guard (`Array.isArray(c) ? c.filter((x): x is string => typeof x === "string") : []`) for any future Person work, which I confirmed is warranted against lib/supabase/types.ts:55 and lib/db/schema.ts:88.

### [LOW] courseJsonLd() sets provider.sameAs to the class page URL, telling Google the organization's identity IS /classes/diabetes

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** lib/seo/structuredData.ts:56, https://www.myyogaclasses.fit/classes/diabetes, https://www.myyogaclasses.fit/classes/geriatric, https://www.myyogaclasses.fit/classes/kids-yoga

**Evidence.** lib/seo/structuredData.ts:56: `provider: { "@type": "Organization", name: ORG_NAME, sameAs: url }`, where `url` is the page URL passed from app/(marketing)/classes/[slug]/page.tsx:48. Live on all 9 condition pages, e.g. /classes/diabetes emits `"provider":{"@type":"Organization","name":"My Yoga Classes","sameAs":"https://www.myyogaclasses.fit/classes/diabetes"}` and /classes/kids-yoga emits `"sameAs":"https://www.myyogaclasses.fit/classes/kids-yoga"`. schema.org defines sameAs as "a reference page that unambiguously indicates the item's identity", so this asserts nine different identities for one organization, none of which is the homepage or the Instagram profile the root Organization node declares.

**Recommendation.** Corrected finding (severity: LOW, schema hygiene):

courseJsonLd() sets provider.sameAs to the class page's own URL. schema.org defines sameAs as a reference page on ANOTHER site that identifies the entity; Google describes it as "the URL of a page on another website with additional information about your organization". A same-site self-reference is outside the property's intended use. Corrected location: lib/seo/structuredData.ts:58 (not 56). Live on all 9 condition pages, verified on diabetes, geriatric, kids-yoga, hypertension and prenatal.

Corrected impact: near zero today, not high. Google retired the Course info rich result in June 2025 and dropped Rich Results Test and Search Console support for it on 8 Sept 2025, so this Course node (a standalone Course, not the ItemList that Course List requires) produces no rich result and no validator warning. sameAs is not a required or recommended property for provider. Additionally the correct root Organization node, carrying url=homepage and sameAs=[Instagram], is emitted in the same HTML document one script block above, so the wrong value is not an unopposed identity claim. Residual value in fixing it is cleanliness of the entity graph for LLM/AI-search consumers that parse JSON-LD literally.

Corrected recommendation. Apply ONLY the one-line fix; do NOT apply the "@id" version standalone:

  provider: { "@type": "Organization", name: ORG_NAME, url: SITE_URL },

with, at the top of lib/seo/structuredData.ts:

  export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";

The @id form (provider: { "@id": `${SITE_URL}/#organization` }) is only valid AFTER app/layout.tsx:84 gains "@id": `${siteUrl}/#organization` on orgJsonLd AND the two script blocks are merged into a single @graph. There is currently no "@id" anywhere in app/, lib/ or components/, so as separate <script> blocks the reference cannot resolve and would drop provider entirely. Sequence it behind the @graph change or skip it.

Corrected dedup note: the NEXT_PUBLIC_SITE_URL fallback string is repeated in seven places, not four: app/layout.tsx:60, app/robots.ts:4, app/sitemap.ts:5, app/(marketing)/classes/[slug]/page.tsx:11, app/(marketing)/teachers/[slug]/page.tsx:11, lib/email/index.ts:52, app/api/admin/teachers/[id]/invite/route.ts:95. structuredData.ts has no server-only import, so exporting SITE_URL from there is importable by the ISR marketing routes and by robots.ts/sitemap.ts without forcing anything dynamic.

### [LOW] FAQPage is now inert for rich results (Google deprecated them 2026-05-07). Keep it, do not treat it as an SEO deliverable, and expand it to condition pages only as an AI-extraction play.

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** low
- **Locations:** lib/seo/structuredData.ts:22, app/(marketing)/page.tsx:49, app/(marketing)/faq/page.tsx:19, app/(marketing)/pricing/page.tsx:21, app/(marketing)/classes/[slug]/page.tsx:48

**Evidence.** Google's FAQ structured data doc carries a deprecation notice added 2026-05-07; FAQ rich results stopped appearing in Search on that date, the Search Console FAQ report and Rich Results Test support were removed in June 2026, and the Search Console API data goes in August 2026. This supersedes the August 2023 restriction to "well-known, authoritative government and health websites" that the brief cites: the feature no longer exists for anyone. Live cost today: a 2,176-byte FAQPage block with 9 questions on exactly three URLs (/, /faq, /pricing) and, contrary to established-audit item 7, on ZERO condition pages. The 9 questions come from lib/data/faqs.ts FAQS.

**Recommendation.** Severity: LOW (informational). Dimension: schema.

Corrected finding: FAQPage markup is inert for rich results and always effectively was for this site. Google's FAQ structured data doc carries a deprecation notice: the feature stopped appearing in Search on 2026-05-07, the Search Console FAQ report / appearance filter / Rich Results Test support were removed in June 2026, and the Search Console API data goes in August 2026. This supersedes the August 2023 restriction to authoritative government and health sites, which this site would not have met anyway, so the practical SERP loss from the deprecation is zero.

Corrected live footprint: a 2,177-byte FAQPage block with 9 questions (from lib/data/faqs.ts FAQS) on exactly three URLs: / , /faq , /pricing. Confirmed zero FAQPage on all nine condition pages, so established-audit item 7 is WRONG and should be amended: FAQPage is on / /faq /pricing only, not on /classes/[slug].

Corrected evidence: the 45 condition-page Q&A pairs are NOT "invisible to machines." All five questions and all five answers from lib/data/condition-pages/diabetes.json string-match in the server-rendered HTML of /classes/diabetes. Every crawler already reads them. What is missing is only a typed Q&A container.

Corrected recommendation, two actions not three:

(1) Reclassify, do not delete. Keep faqPageJsonLd exactly as-is at lib/seo/structuredData.ts:22. Unsupported-but-valid markup is not penalised and produces no Search Console errors. Stop counting FAQPage as schema coverage in any audit scorecard: it buys zero SERP real estate.

(2) OPTIONAL, low confidence, low cost: add the same block to the nine condition pages, sourced from the array the accordion already renders.

```tsx
// app/(marketing)/classes/[slug]/page.tsx, beside the existing courseJsonLd at line 48
import { courseJsonLd, faqPageJsonLd } from "@/lib/seo/structuredData";
...
<JsonLd data={courseJsonLd(c, `${siteUrl}/classes/${c.slug}`)} />
{rich ? <JsonLd data={faqPageJsonLd(rich.faqs)} /> : null}
```

This type-checks as written (verified with tsc --noEmit): ConditionPage.faqs is `{q,a}[]`, structurally identical to Faq, and faqPageJsonLd needs no change. `rich.faqs` is a required field, so the `?.length` guard in the original snippet is redundant. Cost: 11,909 raw bytes across nine pages (1,167 to 1,583 per page), which brotli largely reclaims because it duplicates text sitting immediately below it in the same document. Benefit: speculative, a cleaner typed container for LLM extraction, with no public evidence that these systems privilege it over the visible HTML they already read. Do it as housekeeping if the diff is free; do not schedule work for it and do not report it as an SEO win.

DROP the third action entirely. "Fold it into the page @graph, recovering most of the 2,176 bytes" is not achievable. `grep -rn "@graph"` returns nothing; Organization is emitted in app/layout.tsx:127 in the ROOT layout via raw JSON.stringify, which an App Router child page cannot merge into; and on / /faq /pricing the FAQPage is the only page-level node, so there is no second node to merge with. Real recovery is 0 bytes. The only route with two page-level nodes is /teachers/[slug] (Person + BreadcrumbList at lines 43 and 44), which carries no FAQPage, and merging those two would save roughly 77 bytes.

The compliance rule stands and is already satisfied: FAQPage content must be visible on the page, and it is on all four page types. Never emit FAQ markup that is not on the page.

If the goal is schema that still earns SERP features, the effort belongs on the two real gaps established item 7 names and this finding does not address: Product/Offer (or Service with an AggregateOffer) on /pricing, and BreadcrumbList on the condition pages. Those are supported rich result types. FAQPage is not.

### [LOW] BreadcrumbList exists on 3 of 23 URLs, and the one that has it omits Home. It is one of the few types that survived every deprecation round.

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** medium
- **Locations:** app/(marketing)/teachers/[slug]/page.tsx:44, app/(marketing)/classes/[slug]/page.tsx, app/(marketing)/classes/page.tsx, app/(marketing)/pricing/page.tsx, app/(marketing)/reviews/page.tsx, app/(marketing)/teachers/page.tsx, app/(marketing)/faq/page.tsx, lib/seo/structuredData.ts:68

**Evidence.** Parsed all 23 URLs. BreadcrumbList appears only on the three /teachers/[slug] pages, from app/(marketing)/teachers/[slug]/page.tsx:44-49. Live output on /teachers/dr-vaishnavi-mayya is a 2-item trail starting at position 1 = "Teachers" (https://www.myyogaclasses.fit/teachers), with no Home node. Absent entirely from: /classes, all 9 /classes/[slug], /pricing, /reviews, /teachers, /about, /contact, /faq, and the 3 /legal/* pages. That is 20 of 23 indexable URLs with no breadcrumb.

**Recommendation.** Corrected finding: BreadcrumbList is present on 3 of 23 indexable URLs, and the one trail that exists starts at "Teachers" with no Home node. Severity LOW as a standalone schema fix; it becomes worth doing at MEDIUM only when bundled with a visible breadcrumb component, because that is what also cures the internal-linking dead end on the condition and teacher pages.

Corrected rationale (drop the "renders identically in every locale" claim): since 2025-01-23 Google shows only the domain in mobile SERP snippets, so the visible breadcrumb path is a desktop-only payoff. The remaining value is entity/path context for the crawler and Search Console's Breadcrumbs report, not a ranking or mobile-snippet win.

Corrected recommendation, in priority order:

1. One-line fix, do this now. app/(marketing)/teachers/[slug]/page.tsx:45, prepend Home:
   breadcrumbJsonLd([
     { name: "Home",     url: siteUrl },
     { name: "Teachers", url: `${siteUrl}/teachers` },
     { name: t.display_name, url: teacherUrl },
   ])
   Note the file already has `const siteUrl` at line 11, so no new import.

2. Ship a shared visible breadcrumb component (components/shared/Breadcrumbs.tsx, nav aria-label="Breadcrumb", ol/li with Link) and render it plus the matching JSON-LD on the two deep page types only, where a 3-level trail actually carries information:
   - /classes/[slug] (9 pages): Home > Classes > <category name>
   - /teachers/[slug] (3 pages): Home > Teachers > <display name>
   This is the item that pays for itself: 12 pages currently reachable only from nav and footer gain a crawlable, anchored link back to their hub.

3. Optional, low value: add Home > <page> to /classes, /teachers, /pricing, /reviews, /faq, /about, /contact. A 2-item trail duplicates what the domain display already conveys. Do it for consistency, not for return.

4. DO NOT ship the proposed "Home > Legal > <page>" trail. /legal is a real 404. Either use a 2-item Home > Privacy policy (matching the live <title> "Privacy policy") or first create an actual /legal index page and add it to sitemap.xml. Also worth noting while in those files: the legal titles double the brand, e.g. "Privacy policy | My Yoga Classes · My Yoga Classes", because the page title already appends the brand and app/layout.tsx's "%s · My Yoga Classes" template appends it again.

The finding's note that breadcrumbJsonLd needs no change is correct, and its note that a self-referential last `item` is accepted is correct (Google documents `item` on the final element as optional, defaulting to the page URL).

### [LOW] Condition pages carry no `about` link to a medical entity, which is the strongest available global-positioning signal and is missing on the site's 9 best pages

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** /classes/diabetes, /classes/hypertension, /classes/prenatal, /classes/mental-health, lib/seo/structuredData.ts:51, lib/data/condition-pages/

**Evidence.** Live /classes/diabetes Course node is name, description, url, provider, hasCourseInstance only. No `about`. The page has roughly 930-980 words of condition-specific content and lib/data/condition-pages/diabetes.json carries 4 levers, 4 poseGroups, 5 FAQs and a 5-item session checklist, none of which is tied to any recognised entity. All 9 condition pages are structurally identical.

**Recommendation.** CORRECTED FINDING

Title: Condition-page Course nodes are minimal. The highest-value missing piece is BreadcrumbList (documented, live rich result, builder already exists), not `about`.

Severity: low for `about`. Medium for the BreadcrumbList gap the finding missed.

Corrected evidence: All 9 live condition pages emit exactly two JSON-LD nodes, Organization and a 5-property Course (name, description, url, provider, hasCourseInstance). Absent: about, BreadcrumbList, FAQPage. Correct the first-pass audit: FAQPage is NOT present on condition pages (grep -c FAQPage on live /classes/diabetes = 0).

Corrected recommendation, in priority order:

(a) DO FIRST. Wire breadcrumbJsonLd(), which already exists at lib/seo/structuredData.ts:68 and is already proven on app/(marketing)/teachers/[slug]/page.tsx:45, into app/(marketing)/classes/[slug]/page.tsx next to the existing courseJsonLd call: Home -> Classes -> {c.name}. This is a two-line change reusing a tested builder, and unlike `about` it produces a documented, currently-supported Google rich result.

(b) DO SECOND, cheaply. Emit faqPageJsonLd(rich.faqs) on the condition route, mapping the JSON's q/a shape to the existing Faq type. Caveat honestly: since Google's August 2023 restriction, FAQ rich results are essentially limited to well-known government and health authorities, so expect no SERP snippet. Justify it as entity/passage grounding only, and do not bill it as a rich-result win.

(c) ADD `about`, but scoped and re-typed, and label it low-impact. It is cheap and harmless once the types are fixed, but it is a grounding hint for AI answer surfaces, not a ranking or SERP change. Google does not document `about` for Course.

Corrected mapping. Use MedicalCondition ONLY where the page topic genuinely is a diagnosed condition, and Thing everywhere else, to stay inside the 0024_category_copy_positive compliance line:
- diabetes -> MedicalCondition "Type 2 diabetes", sameAs https://en.wikipedia.org/wiki/Type_2_diabetes
- hypertension -> MedicalCondition "Hypertension", sameAs https://en.wikipedia.org/wiki/Hypertension
- pain-relief -> MedicalCondition "Chronic pain", sameAs https://en.wikipedia.org/wiki/Chronic_pain
- mental-health -> Thing "Stress management", sameAs https://en.wikipedia.org/wiki/Stress_management (not "Anxiety", which is a diagnosis the copy does not claim to address)
- prenatal -> Thing "Pregnancy", sameAs https://en.wikipedia.org/wiki/Pregnancy (Thing, not MedicalCondition: pregnancy is not a disease)
- geriatric -> Thing "Physical activity in older adults" (drop "Ageing" as a MedicalCondition entirely; the live copy is about mobility, balance and confidence)
- weight-loss -> Thing "Physical fitness", sameAs https://en.wikipedia.org/wiki/Physical_fitness (not "Obesity", which appears nowhere in the copy)
- hormonal-health -> Thing "Sleep hygiene", sameAs https://en.wikipedia.org/wiki/Sleep_hygiene (NOT "Endocrine disease": migration 0024_category_copy_positive explicitly stripped implied hormone claims from this exact category after a UAE DHA/MOH and India ASCI compliance pass, and an endocrine-disease `about` reintroduces that claim in structured form)
- kids-yoga -> Thing "Children's physical activity" (the finding had this one right)

Implementation note, unchanged from the finding and still correct: keep the mapping as a static slug-keyed lookup beside lib/data/condition-pages, give courseJsonLd an optional `about` parameter so an unmapped category emits nothing, and keep the page @type as-is. Static data, so (marketing) ISR at revalidate = 300 is unaffected and no CSP entry is needed.

### [LOW] VideoObject is not warranted for hero.mp4, and is blocked for the teacher intro videos by a missing uploadDate

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** low
- **Locations:** public/hero.mp4, components/marketing/HeroVideo.tsx:20, components/shared/TeacherIntroVideo.tsx, lib/supabase/types.ts

**Evidence.** public/hero.mp4 is 1,295,397 bytes, referenced as `const VIDEO_SRC = "/hero.mp4"` at components/marketing/HeroVideo.tsx:20 with `const POSTER_SRC = "/hero-poster.jpg"` at :21, and mounted client-side. It is decorative ambience: no title, no narrative, no transcript, not the subject of the page. Separately, teachers.intro_video_url exists and is rendered by components/shared/TeacherIntroVideo.tsx on /teachers/[slug], but the teachers table (lib/supabase/types.ts) has no upload-date column.

**Recommendation.** hero.mp4: NO VideoObject. Google requires the video to be a meaningful, primary piece of page content with a real name and description, and a video rich result that lands a searcher on a silent decorative loop is a bounce generator, not a win. Marking it up would also require inventing a name, description and uploadDate, all three of which would be fabrications.

teacher intro videos: warranted in principle, blocked in practice. A named person introducing themselves is a real, discrete video with a subject, and it would be a genuine differentiator on /teachers/[slug]. But VideoObject requires name, description, thumbnailUrl, uploadDate and contentUrl or embedUrl, and there is no uploadDate to emit. Sequence: add a nullable `teachers.intro_video_uploaded_at timestamptz` (a hand-written migration per the project's schema-ownership rule, not db:generate), populate it, then add `teacherVideoJsonLd(t, url)` emitting name "Meet <display_name>", description from headline, thumbnailUrl from avatar_url, contentUrl from intro_video_url. Do not ship it with a guessed date; a wrong uploadDate is worse than no markup.

### [LOW] An em dash stored in class_categories.description is being served inside JSON-LD, violating the project's copy rule in a surface nobody proofreads

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** low
- **Locations:** https://www.myyogaclasses.fit/classes/geriatric, lib/seo/structuredData.ts:54, lib/data/landing.ts

**Evidence.** Live /classes/geriatric Course node: `"description":"Slow, supportive yoga for older adults to help with everyday mobility, balance, and confidence — with chair options as needed."` — U+2014 EM DASH. It reaches JSON-LD via lib/seo/structuredData.ts:54 `description: cat.description`, straight from the DB row, and scrubRetiredCopy() in lib/data/landing.ts does not strip punctuation.

**Recommendation.** Fix at source: edit the geriatric category description at /admin, replacing the em dash with a comma, since class_categories is DB-driven and a code edit changes nothing on the live site. Audit the other eight descriptions and long_descriptions in the same pass. If the owner wants a belt-and-braces guard, extend scrubRetiredCopy() with a `.replace(/\s*—\s*/g, ", ")` pass so no future admin edit can reintroduce one into rendered copy or JSON-LD. Low impact on ranking, but JSON-LD descriptions are increasingly read verbatim by AI answer engines, which is exactly the surface where the AI-written tell matters.

---

## kw-commercial (15)

### [HIGH] Condition page titles are generated from a database category name, not an SEO title, so nine of the site's best pages carry zero keyword in their most weighted tag

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/diabetes.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/geriatric.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/hormonal-health.json, https://www.myyogaclasses.fit/classes/diabetes, https://www.myyogaclasses.fit/classes/geriatric

**Evidence.** app/(marketing)/classes/[slug]/page.tsx:32 reads `title: c?.name ?? "Class"`. Combined with the template `"%s · My Yoga Classes"` at app/layout.tsx:66, live titles are literally `<title>Diabetes · My Yoga Classes</title>`, `<title>Geriatric · My Yoga Classes</title>`, `<title>Mental Health · My Yoga Classes</title>` (fetched live). Meanwhile the H1s already contain the keyword: `Yoga for diabetes, shaped around you.` The ranking competitors title the exact query, e.g. `Online Yoga Classes For Diabetes - Patanjalee Institute of Yoga & Yoga Therapy` and `Online Yoga Classes for Diabetes | Shyambhai Yoga`. The JSON files at lib/data/condition-pages/*.json carry `metaDescription` but no title field (keys verified: slug, eyebrow, h1Before, h1Em, h1After, heroLead, ..., metaDescription).

**Recommendation.** CORRECTED FINDING

Title: The nine condition pages take their <title> from an admin-editable DB category name, so they carry the condition word but none of the commercial modifiers ("online", "classes for", "1:1") that the ranking pages use.

Corrected evidence:
- app/(marketing)/classes/[slug]/page.tsx:32 is `title: c?.name ?? "Class"`; `c` comes from getClassCategories (lib/data/landing.ts:341-350), which reads the `class_categories` table. The title is therefore DB-driven today and an admin rename silently changes it.
- app/layout.tsx:66 template "%s · My Yoga Classes" adds exactly 18 chars.
- Live titles (curl, 2026-09-16): "Diabetes ·", "Hypertension ·", "Prenatal &amp; Postnatal ·", "Hormonal Health ·", "Pain Relief ·", "Mental Health ·", "Weight Loss ·", "Geriatric Yoga ·" (NOT "Geriatric ·" as claimed), "Kids Yoga ·", each + " My Yoga Classes".
- Not "zero keyword": "Yoga" is present in all nine via the brand suffix and leads two of them. The gap is the modifier set.
- Competitor comparison holds for diabetes only. "Online Yoga Classes For Diabetes - Patanjalee Institute of Yoga & Yoga Therapy" and "Online Yoga Classes for Diabetes | Shyambhai Yoga" are live SERP titles. The "online yoga for high blood pressure" SERP is informational (Yoga Journal, Harvard Health), so do not assume a commercial title wins there.

Severity: high, not critical. One-line fix, zero risk, but it unblocks rather than drives ranking; the 23-URL footprint is the real constraint.

Recommendation (keep the mechanism, replace the strings):
Add `seoTitle` to each of the nine lib/data/condition-pages/*.json and change page.tsx:32 to `title: rich?.seoTitle ?? c?.name ?? "Class"`. `rich` is already in scope on line 30, so this is a true one-liner. Keep each seoTitle at or under 42 chars so the 18-char template lands under ~60.

Use strings whose vocabulary actually appears in that page's H1 and body, otherwise Google rewrites the title from the H1 and the change is wasted. Revised set:
- diabetes.json: "Online Yoga for Diabetes, Live 1:1" (avoids "Yoga Classes" colliding with the brand suffix; body has diabet* x7, blood sugar x3)
- hypertension.json: "Online Yoga for Blood Pressure, 1:1" (body: "blood pressure" x10, matches H1 "Yoga for blood pressure")
- hormonal-health.json: "Online Yoga for Hormonal Health, 1:1" (body: hormon* x9, menopaus* x5; do NOT title on PCOS, it appears once and is a claim risk under the project's health-claim-safe copy rule)
- prenatal.json: "Prenatal and Postnatal Yoga, Online 1:1" (keeps postnatal, which the body covers x4)
- pain-relief.json: "Online Yoga for Back and Neck Pain" (unchanged from the original recommendation; body has back x16, neck x6, pain x20, fully supported)
- mental-health.json: "Online Yoga for Stress, Live 1:1" (stress x4 is the only supported term; "mental health", "anxiety" and "sleep" appear zero times)
- weight-loss.json: "Online Yoga for an Active Routine, 1:1" (matches the live H1; do NOT title "Weight Loss", the body says "weight" twice and avoids the claim on purpose)
- geriatric.json: "Chair Yoga for Older Adults, Online 1:1" (chair x20 and "older adults" x5 are both on-page; "seniors" appears zero times)
- kids-yoga.json: "Online Yoga for Kids, Live 1:1" (child* x34, kid x2)

Pair this with the H1 caveat: if the owner wants to target "weight loss", "seniors" or "PCOS" as head terms, the page body has to earn it first. Changing only the title creates a title/H1 mismatch that Google will overwrite.

### [HIGH] The site has no page at all for the single highest-value commercial cluster: private / 1:1 / one-to-one online yoga

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/

**Evidence.** All 23 sitemap URLs verified live: /, /about, /classes, /pricing, /teachers, /reviews, /faq, /contact, three /legal, three /teachers/[slug], nine /classes/[slug]. There is no /private-online-yoga-classes, no /1-on-1, no /one-to-one. Every competitor that ranks for this cluster has a dedicated URL for it: shvasa.com/lp/private, shyambhai.yoga/one-to-one-yoga-classes/, yogabeyondthestudio.com/online-private-yoga-classes, tamarafayad.yoga/online-private-yoga-classes/, patanjaleeyoga.com/personalised-yoga-classes/, mywowfit.com/yoga. The homepage title does carry the framing ("My Yoga Classes: Live 1:1 online yoga teacher") but a homepage cannot out-specify a purpose-built landing page.

**Recommendation.** Corrected finding: the site has no URL, no H1 and no heading targeting the private / one-to-one commercial cluster. The homepage carries the framing in its title tag and body copy ("1:1" x54, "personalised" x27), but its H1 is "Find your 1:1 yoga teacher." and that string lives in admin_settings, so it is not fixable in code. There is no /private-online-yoga-classes, /1-on-1, /one-to-one or /private-yoga (all 404 verified).

Corrected recommendation, as a five-file PR:

1. app/(marketing)/private-online-yoga-classes/page.tsx. Fully static: no `revalidate` export, no DB read, no cookies(). Export metadata with title "Private online yoga classes, 1:1 with a teacher in India", a description under 155 chars, and alternates: { canonical: "/private-online-yoga-classes" } to match the self-referential canonical every other marketing page already sets. H1: "Private online yoga classes, one to one with a teacher in India". Body sections: what a private session is, 60 minutes live on video with one teacher; who it suits; how the session is shaped around you; how it differs from a group class; how timezones work (teachers practise in IST, times shown in the visitor's own zone); prepaid session packs. Use "personalised" as the primary spelling to stay consistent with the 27 live occurrences, and let "personalized" appear once naturally rather than being forced in. No em-dashes, no free-trial or "no credit card" wording, no "credits" (say "prepaid 1:1 sessions").

2. app/sitemap.ts. Add an entry to the STATIC_ROUTES array (lines 7-70) with priority 0.9 and changeFrequency "monthly". Without this the page never reaches sitemap.xml, which is the whole point of the finding.

3. components/marketing/Footer.tsx. Add one <li> to the existing internal column at lines 51-55, label "Private 1:1 classes". Do not add it to MarketingNav.tsx; six nav slots are already full and the CLAUDE.md conversion notes protect the above-fold CTA.

4. components/marketing/condition/ConditionLanding.tsx. Add a single contextual link to /private-online-yoga-classes near the existing BOOK_HREF CTA. One edit covers all nine condition pages, which today link nowhere except "#how-it-helps".

5. app/(marketing)/pricing/page.tsx. Add one in-copy link to the new page.

Positioning note the original finding should have included: the new page must not cannibalise the homepage. Homepage keeps the "find your 1:1 yoga teacher" intent; the new page owns "private / one to one online yoga classes". Cross-link them.

Expectation setting: this is a necessary foundation, not a near-term revenue unlock. A new URL on a 23-page site will not outrank shvasa or myyogateacher on this query quickly. It is worth doing because it is cheap, it is the only on-page lever not locked behind admin_settings, and it gives the nine condition pages something commercial to link to.

### [HIGH] The brand name collides with the market leader and the domain does not surface for its own brand query

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** https://github.com/Shalom-P/yoga-website, /Users/shalomp/YOGA_WEBSITE/app/layout.tsx

**Evidence.** A search for "my yoga classes" myyogaclasses.fit returned nine results, none of them this site. Position one and two are myyogateacher.com and myyogateacher.com/group-classes. Other results are myyogacc.com, myyoganc.com, yogaworks.com, alomoves.com. The search engine summarised the situation directly: the domain "doesn't appear to have a dedicated result". Separately, github.com/Shalom-P/yoga-website is confirmed public (GitHub API returns `"private": false`, id 1252517398), which the first-pass audit found outranking the site for brand-adjacent queries.

**Recommendation.** Retitle to: "The domain does not appear in search results at all, and a stale public repo occupies its bare-domain query."

CORRECTED EVIDENCE. Searches for `"my yoga classes" myyogaclasses.fit`, for the bare `myyogaclasses.fit`, and for the exact phrase from the site's own title tag `"Live 1:1 online yoga teacher"` all return zero results from this domain. For the bare-domain query, github.com/Shalom-P/yoga-website is result #1. No crawl blocker exists: no X-Robots-Tag, no robots meta, Googlebot UA gets 200 with 151,354 bytes of server-rendered HTML, sitemap.xml lists 23 valid URLs, and Google Search Console is verified via DNS TXT (`google-site-verification=-KzwTiCrZvl1upIYAYmy7wbuW46q6lBdxuaRT1GZSVk`). Domain first committed 2026-05-28. The diagnosis is a young, link-poor, thinly-indexed domain, not brand collision. Brand collision with myyogateacher.com is a real long-term constraint on the generic string "my yoga classes" but is not the cause of present invisibility, since no competitor contests this site's own title phrase.

CORRECTED RECOMMENDATION, in priority order.

1. DO NOT register or verify Google Search Console. It is already verified as a domain property via DNS TXT. Instead, open the existing property and read Indexing > Pages to get the actual status for all 23 sitemap URLs. The distinction between "Discovered, currently not indexed" and "Crawled, currently not indexed" determines everything downstream: the first means a crawl-budget and link-authority problem, the second means Google judged the pages thin or duplicative. Confirm sitemap.xml is submitted, and run a Live Test plus Request Indexing on the homepage and the nine condition pages. This is the single highest-value action and it costs minutes.

2. Fix the GitHub repo, reframed as brand hygiene rather than revenue. Either make it private, or set `homepage` to https://www.myyogaclasses.fit (it currently points at a deleted Vercel deployment returning 404 DEPLOYMENT_NOT_FOUND) and rewrite the description, which currently advertises PayPal, AU customers and Google Meet, all three retired. Suggested replacement, no em-dashes: "Booking and payments platform for live 1:1 online yoga with teachers in India."

3. EXPAND the existing sameAs, do not add it. app/layout.tsx:91 currently holds one entry. Add the real, claimed and verified profiles only, since sameAs pointing at unclaimed or non-existent URLs helps nothing: a Google Business Profile, a LinkedIn company page, a YouTube channel. Adding fabricated entries is worse than one accurate entry.

4. Pursue third-party entity signals, which is the one part of the original recommendation that survives intact and is the correct answer to a link-poor young domain: directory and listing placements that cite the exact domain.

Drop from the finding: the claim that no verification exists, the claim that sameAs is missing, and the "direct revenue leak" framing on the repo.

### [MEDIUM] /pricing is prerendered in INR only, so every global commercial keyword the site wins delivers a rupee page to a US, UK or Singapore visitor

- **Verdict:** partially-correct | **Effort:** substantial | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/pricing, /Users/shalomp/YOGA_WEBSITE/components/marketing/PricingTeaser.tsx, /Users/shalomp/YOGA_WEBSITE/supabase/migrations/0036_international_currencies.sql, /Users/shalomp/YOGA_WEBSITE/lib/razorpay/catalog.ts

**Evidence.** `curl -sI https://www.myyogaclasses.fit/pricing` returns `x-nextjs-prerender: 1`, `x-nextjs-stale-time: 300`, `x-vercel-cache: HIT`. The prerendered body contains only `₹999`, `₹4,499`, `₹7,999` and no $, £, € or AED figure. Currency resolution is client-side only: components/marketing/PricingTeaser.tsx:90 fetches `/api/region?tz=...` after hydration. supabase/migrations/0036_international_currencies.sql widens the CHECK to INR/AED/USD/GBP/EUR but states in its own header comment "this migration deliberately inserts NO prices", and effectiveCurrency() downgrades to INR until every active plan has a row. The live meta description still says "Honest yoga pricing in AED and INR." For contrast, the Singapore SERP shows private online yoga at "S$60 and S$100 per session" and the UK at "from £30 for a one-hour class" (liveyogateachers.com).

**Recommendation.** CORRECTED FINDING (severity: medium, not critical)

Title: The packs are priced only in INR and AED in the live DB, so every visitor outside India and the UAE is quoted and charged in rupees. This is a conversion-readiness gap that should be closed before, not after, global content investment.

Corrected evidence:
- /pricing renders exactly ₹999 / ₹4,499 / ₹7,999 and no other currency figure (`x-nextjs-prerender: 1`, `x-vercel-cache: HIT`, 93,405 bytes).
- The live `plan_prices` set, read from the page's own RSC payload, is INR + AED only: pack-1 INR 99900 / AED 5900, pack-5 INR 449900 / AED 27500, pack-10 INR 799900 / AED 49900. No USD, GBP or EUR row exists.
- Root cause is the missing price rows, NOT the prerender. `app/api/region/route.ts` calls `effectiveCurrency(region.currency)`, and `lib/razorpay/catalog.ts:196` downgrades any unpriced candidate to INR. A US visitor is served INR whether the page is static or dynamic. Migration 0036 widened the CHECK to INR/AED/USD/GBP/EUR and states in its header that it "deliberately inserts NO prices."
- Currency is not a Google ranking input, and the site currently holds no US/UK/SG commercial rankings (it does not appear for `"myyogaclasses.fit" online 1:1 yoga teacher`). The cost is conversion on traffic that arrives, plus SERP-snippet credibility, not lost rankings.
- Drop the "£30 per hour at liveyogateachers.com" citation. Their /pricing page sells teacher-side SaaS (Free / £9 per month / £19 per month) and their homepage advertises group classes "from £5 a class ($6 or €6)." Cite them only as an example of multi-currency display.

Corrected recommendation:
1. Price pack-1, pack-5 and pack-10 in USD, GBP and EUR in /admin/plans. This is a commercial decision with a schema already in place (0036) and is the entire fix for display and checkout at once, because `effectiveCurrency()` stops downgrading the moment every active plan has a row. Do this in parallel with global content work, not as a gate on it. Note the real hard dependency: Razorpay International acceptance on the account, which 0036's own header flags as necessary-but-not-sufficient. Verify a foreign card can actually be charged before announcing foreign prices.
2. Do NOT emit per-market schema or per-market server-rendered prices on /pricing. That needs `headers()`, which forces the route dynamic and, per the documented constraint and the comment in `app/api/region/route.ts`, takes the whole (marketing) group off ISR. Emit one static graph listing every currency that is actually priced, and let the existing client-side `/api/region` swap remain the only per-visitor behaviour.
3. Use Service, not Product. Google's merchant-listing experiences target products purchasable on the page; a 1:1 session pack is a service, and `AggregateOffer` denotes a price range rather than three SKUs. Add to /pricing a `Service` node with an `offers` array of three sibling `Offer` nodes, one per pack (pack-1, pack-5, pack-10), each carrying `priceCurrency`, `price`, `availability` and a `url`. Emit one Offer per priced currency per pack, so today that is 6 nodes (3 packs, INR and AED) and 15 once USD/GBP/EUR are set. Build it in `lib/seo/structuredData.ts` alongside the existing typed schema-dts builders, driven off the same `getPlansWithFeatures()` data the page already awaits, so it can never drift from the rendered cards.
4. Leave the meta description alone until the prices exist. "Honest yoga pricing in AED and INR" is presently accurate. Once USD, GBP and EUR are live, change it to something like "One-time yoga session packs priced in your currency. No subscription, and your sessions never expire." Avoid enumerating currencies so it never goes stale, and note it is a code-level string in `app/(marketing)/pricing/page.tsx:13`, so editing it does work (unlike the DB-driven hero and plan_features).

Unverified and worth a separate check: whether Razorpay on this account can charge a non-Indian card in INR at all today. If it cannot, the current state is not "wrong currency shown" but "no international customer can complete a purchase," which would be a genuinely critical commerce finding under a different dimension than kw-commercial.

### [MEDIUM] /classes/hormonal-health is the site's single biggest missed keyword: the PCOS SERP is 100% small providers with no publisher or directory, and the page mentions PCOS exactly twice

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/classes/hormonal-health, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/hormonal-health.json

**Evidence.** Live grep of /classes/hormonal-health returns: PCOS 2, menopause 10, menstruation 2, thyroid 2. PCOS appears in no title, no URL, no H1 (H1 is `Yoga for hormonal health, shaped around you.`). The SERP for "yoga for PCOS online classes one on one" contains betheshyft.com, theyogaguru.com, kushiyogalaya.com, yogagurushailendra.com, karoyog.com, patanjaleeyoga.com/online-yoga-classes-for-pcos-pcod/, yogiva.com/online-yoga-classes-for-pcos-pcod/ — eight results, zero of them a major publisher, zero of them a marketplace or directory, and several on domains with no more authority than this site. "hormonal health" is a category label, not a search term.

**Recommendation.** CORRECTED FINDING (severity: medium, and it is not the site's biggest keyword gap).

The nine condition pages are titled and headlined with category euphemisms instead of the terms people search. Ranked by actual damage, measured from the repo JSON (which avoids the flight-payload double-count):
- /classes/mental-health: anxiety 0, depression 0, insomnia 0. H1 "Yoga for a calmer mind, shaped around you." WORST, highest volume.
- /classes/pain-relief: "back pain" 0, sciatica 0. H1 "Yoga for pain relief, shaped around you."
- /classes/weight-loss: "weight loss" 0 in body, obesity 0, metabolism 0. H1 "Yoga for an active routine, shaped around you."
- /classes/hormonal-health: PCOS 1 (not 2), PCOD 0, menopause 5 (not 10), thyroid 1. The single PCOS mention is the FAQ "Can yoga balance my hormones or treat PCOS, thyroid, or menopause?" answered "No."

PCOS is still the best commercial opportunity of the four because its SERP is uniquely weak (all eight results are small providers, no publisher, no directory, several on domains no stronger than this one), but it is not the biggest missed keyword.

CORRECTED RECOMMENDATION.
Drop the nested /classes/hormonal-health/pcos child. Use the existing DB-driven pattern instead: insert a class_categories row with slug "pcos" and add lib/data/condition-pages/pcos.json plus one static import line in lib/data/condition-pages.ts. This yields /classes/pcos with automatic sitemap inclusion (app/sitemap.ts reads class_categories), automatic generateStaticParams prerendering, automatic Course JSON-LD and ISR at revalidate 300, with zero new routing code and no parent/child duplication.

Set the row's name field to a keyword-bearing string, because app/(marketing)/classes/[slug]/page.tsx generateMetadata uses `title: c?.name ?? "Class"`. Left alone, the new page ships as "Pcos · My Yoga Classes". Use name "Yoga for PCOS and PCOD" so the title renders "Yoga for PCOS and PCOD · My Yoga Classes".

Suggested H1, claim-safe per the 0024 reframe and em-dash free: "Yoga for PCOS and PCOD, shaped around you." Keep the existing safety block.

Write genuinely new body copy rather than cloning hormonal-health's poseGroups. Note that Baddha Konasana and Supta Baddha Konasana already in hormonal-health.json are exactly the butterfly and reclining bound-angle poses the ranking competitors name, so they belong on the PCOS page, but the page needs its own levers, whoForText and FAQs or it is thin. Route the new copy through landing-pages/*.html first and keep medical review, per the do-not-paraphrase note in lib/data/condition-pages.ts.

Do the cheaper site-wide fix first: change generateMetadata to emit keyword-bearing titles for all nine existing pages (for example "Yoga for Anxiety and Stress" for mental-health, "Yoga for Back Pain" for pain-relief) rather than falling through to the bare class_categories.name. That one change covers every condition page and outranks the PCOS split in priority.

Deprioritize the menopause child page. Its SERP is materially harder than claimed and carries mixed teacher-training intent.

### [MEDIUM] /classes/geriatric uses a clinical slug nobody searches while its own body copy says "chair" 39 times

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/classes/geriatric, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/geriatric.json, https://www.myyogaclasses.fit/classes

**Evidence.** Live grep of /classes/geriatric: chair 39 (plus 2 capitalised), balance 22, older adult 10. The URL is /classes/geriatric, the title is `Geriatric · My Yoga Classes`, the H1 is `Gentle yoga for older adults, shaped around you.` Nothing in the URL or title says "chair yoga" or "seniors". The SERP for "online yoga classes for seniors over 60 live chair yoga one on one" returns silversneakers.com twice, haidensyogapractice.com (a one-teacher site offering "1:1 yoga coaching" for seniors), adaptiveyogalive.com, silverageyoga.org — the small-provider results all put "chair yoga for seniors" in the title.

**Recommendation.** CORRECTED FINDING
/classes/geriatric ranks for nothing because the commercial head term is absent from every field Google matches on. Verified on the live page: "senior" appears 0 times, the phrase "chair yoga" appears 0 times, while the rendered body copy uses "chair" 18 times (not 39 — that figure came from an unfiltered grep that double-counted the RSC payload and 4 JSON-LD blocks; the source file landing-pages/yoga-for-geriatric.html has 19). The live title is "Geriatric Yoga · My Yoga Classes", not "Geriatric · My Yoga Classes". The meta description already reads "Slow, supportive 1:1 yoga for older adults: gentle movement, balance work, and chair-supported options...", so the concept is in the snippet but not in the title, H1 or URL.

SERP evidence holds and is stronger than claimed: for "geriatric yoga online classes" Google returns zero pages titled "geriatric" — every result, including competitor shyambhai.yoga/online-yoga-classes-for-seniors/, is titled around "seniors". The provider-scale results (silversneakers.com x2, haidensyogapractice.com, adaptiveyogalive.com, silverageyoga.org) all carry "chair yoga"/"for seniors" in the title.

CORRECTED RECOMMENDATION (the original does not work as written)
1. There is no `seoTitle` field. `ConditionPage` in /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages.ts has only `metaDescription`, and app/(marketing)/classes/[slug]/page.tsx:32 sets `title: c?.name` from the Supabase `class_categories` row. To make the title code-controlled: add `seoTitle?: string` to the `ConditionPage` type, add `"seoTitle": "Chair Yoga for Seniors, Online 1:1"` to geriatric.json, and change line 32 to `title: rich?.seoTitle ?? c?.name ?? "Class"`. `rich` is already in scope on line 31. Renders as "Chair Yoga for Seniors, Online 1:1 · My Yoga Classes" (51 chars, fits). No em-dash, no free-trial wording, no new origin, no cookies() call, so ISR and CSP are untouched. The alternative (editing `class_categories.name` in the DB) is worse: that string is also the visible card label on /classes and the SimpleDetail H1.
2. Do this once for all nine pages, not just geriatric. The same `seoTitle` override fixes "Diabetes · My Yoga Classes", "Hypertension · ...", etc., which are worse off than geriatric because they lack even the word "Yoga". That is the higher-value framing.
3. For the on-page phrase, change `posesSubhead` or add a new H2 rather than rewriting existing medically-reviewed text: lib/data/condition-pages.ts says the JSON is extracted verbatim from landing-pages/*.html and must not be paraphrased, so mirror any edit into landing-pages/yoga-for-geriatric.html. A safe addition is retitling `helpsH2` to "How chair yoga for seniors supports everyday movement." (currently "How yoga can support older adults.") — it adds the literal phrase without touching a health claim.
4. Drop the "roughly 10x the impressions" claim for a slug change. There is no Search Console verification on this site, so no impression baseline exists to support any multiplier. The slug advice itself (leave it, it is DB-keyed and in the sitemap) is correct and should stand unquantified.
5. The /classes hub claim is confirmed and is the easiest win of the three: app/(marketing)/classes/page.tsx:8-10 hardcodes the nine raw category names in the meta description. Replace with buyer language, e.g. "1:1 online yoga for diabetes, high blood pressure, pregnancy, back pain, anxiety, weight loss, seniors and kids. Live 60-minute sessions with your own teacher."

### [MEDIUM] CORRECTION to the first-pass audit: the 107 pose entries are already published and rendering; the real gap is that they generate zero URLs

- **Verdict:** partially-correct | **Effort:** substantial | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/components/marketing/condition/ConditionLanding.tsx, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/, https://www.myyogaclasses.fit/classes/diabetes

**Evidence.** The audit claimed the pose data is "Unpublished". It is not. components/marketing/condition/ConditionLanding.tsx:142 maps `d.poseGroups`, and the live HTML of /classes/diabetes contains "Paschimottanasana", "Setu Bandha" and "Vajrasana". Also a count correction: the nine JSON files contain 35 poseGroups and 107 poses, not 36 groups. The actionable gap is structural, not editorial: myyogateacher.com carries 84 URLs under /yoga-asana and 241 under /articles; this site converts 107 pose entries into zero indexable URLs.

**Recommendation.** CORRECTED FINDING (severity: medium, dimension is better filed as kw-informational plus schema)

Facts to record: the pose data is PUBLISHED, not unpublished. First-pass item 4 is wrong on two counts. Correct figures are 35 poseGroups and 107 pose entries across the nine files, and the entries render live inside each condition page (ConditionLanding.tsx:142). Also correct first-pass item 7: condition pages have NO FAQPage JSON-LD. Live /classes/diabetes carries only Organization, ContactPoint, Course and CourseInstance.

Do NOT build 55 pose pages out of the existing JSON. The source descriptions are a 10-word median (min 2, max 21), so every generated page would be a stub, and deduplicating by Sanskrit name yields 55 unique names, not the 70-90 the finding claims, so the URL count goes 23 to 78 and every one of those 55 is a thin, low-intent informational page competing with Yoga Journal.

Do this instead, in priority order:

1. Add BreadcrumbList to /classes/[slug] and /teachers/[slug] is already done, so just the condition pages: Home > Classes > {Condition}, emitted through the existing `JsonLd` component in app/(marketing)/classes/[slug]/page.tsx next to `courseJsonLd`. Cheap, correct, and it is the one part of the original recommendation that survives.

2. Add FAQPage to the nine condition pages. The first-pass audit assumed it was there and it is not. These are the site's only 930-980 word pages and the only ones with genuine condition-specific Q&A potential. Reuse the builder already used on /, /faq and /pricing.

3. Fix the titles before adding any URLs. generateMetadata in app/(marketing)/classes/[slug]/page.tsx:28-35 returns `title: c?.name`, producing "Diabetes · My Yoga Classes". Change to a keyword-bearing string per condition, for example "Online 1:1 Yoga for Diabetes", which under the layout template becomes "Online 1:1 Yoga for Diabetes · My Yoga Classes". Nine edits, no new pages, and it targets queries with actual commercial intent, unlike a page about Vajrasana.

4. If pose content is still wanted later, do NOT auto-generate from the JSON. Write a small number of genuinely substantial guides (8-12, not 55), grouped by condition rather than by individual asana, for example "Yoga sequence for type 2 diabetes: 11 poses and how to hold them", and only then link them from the condition pages. That fixes the same internal-linking dead end the audit flagged without publishing 55 stubs.

Note for whoever implements: the existing `revalidate = 300` plus generateStaticParams pattern in the classes route is the right template and uses no cookies(), so ISR in the (marketing) group stays intact. No CSP change is needed for any of the above.

### [MEDIUM] These head terms are UNWINNABLE for a 23-URL domain and must be reclassified as link-building and listing targets, not ranking targets

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/

**Evidence.** "online yoga classes": SERP is yogainternational.com, doyogawithme.com, corepoweryoga.com, yogawithadriene.com, alomoves.com, theyogacollective.com plus a yogaia.com listicle. Zero small providers. "private yoga lessons cost": thumbtack.com, lessons.com, gymdesk.com, offeringtree.com, brettlarkin.com, siddhiyoga.com, theconnectedyogateacher.com — six of seven are publisher or marketplace cost-data pages. "yoga for high blood pressure": yogajournal.com, artofliving.org, medicine.missouri.edu, beyogi.com, yogauonline.com — publisher and university dominated. "online yoga class that fits my time zone": every result is B2B scheduling SaaS (koalendar, lunacal, picktime, simplybook.me, youcanbook.me, bookeo, setmore) — the intent is software, not classes. "online kids yoga classes": outschool.com and cult.fit. "yoga therapy": dominated by IAYT certification and teacher-training providers (premayogainstitute, breathingdeeply, theyogatherapyinstitute, soulofyoga), so the commercial intent is corrupted by training queries.

**Recommendation.** Reclassify only the pure head and cost terms, not the condition or format terms.

DROP as ranking targets (evidence holds): "online yoga classes" (yogainternational, doyogawithme, corepoweryoga, yogawithadriene, theyogacollective, alomoves, yogaia listicle) and "private yoga lessons cost" (thumbtack /p/yoga-prices, offeringtree, brettlarkin, siddhiyoga, glossgenius, wpamelia are cost-data publisher pages; intent is research, not purchase). Also drop "yoga therapy": the live SERP is NCBI PMC x4, iayt.org, Cleveland Clinic, goodtherapy.org, ndm.edu, so it is a medical-informational SERP, not a training-provider SERP as the finding states.

KEEP AND FUND as ranking targets, the finding is wrong here:
- Condition queries. myyogateacher.com/articles/yoga-for-high-blood-pressure ranks #2 for "yoga for high blood pressure" with the identical business model to this site, alongside beneyoga.co.uk and millieleemd.com. This is a demonstrated playbook, not a closed SERP. Retitle /classes/hypertension from "Hypertension" to "Yoga for High Blood Pressure: Live 1:1 Sessions" (the layout template appends " · My Yoga Classes", 18 chars, so keep the page-level string under ~42 chars), and publish the hypertension poseGroups from lib/data/condition-pages/hypertension.json as individual pose sections with Sanskrit and English names. Repeat for diabetes and the other seven.
- "online kids yoga classes". shyambhai.yoga/yoga-for-kids-online/ and alwaysliveyoga.com both rank page 1 against outschool and cult.fit. Retitle /classes/kids-yoga to "Online Kids Yoga Classes, Live 1:1" and build it out from kids-yoga.json.

DO NOT drop the timezone cluster. The claimed scheduling-SaaS SERP does not exist: "online yoga class that fits my time zone" returns youngyogamasters, iyengarnyc, corepoweryoga and yourbuddhi, all yoga providers. Keep "shown in your local time" as trust copy, and additionally target the buyer-intent phrasings where the real competitors sit: mywowfit, 1om1, yogabeyondthestudio and myyogateacher rank there, all beatable by a 23-URL domain with better condition depth.

Fix the placement list. liveyogateachers.com, superprof.com and 1om1.net are direct competitors, not publishers. liveyogateachers charges teachers 25% / £9+10% / £19 to be listed and lists individuals, not platforms, so it costs money and routes the teacher instead of the brand. Pursue instead the genuinely neutral pages found ranking in the alternatives cluster: healthynexercise.com/best-yoga-classes/ (already ranks for "myyogateacher alternative"), yogaia.com/blog, saashub.com/myyogateacher, tracxn and zoominfo company profiles. Treat "myyogateacher alternative", "shvasa alternative", "habuild alternative" and "mywowfit vs" as the real placement cluster, since those roundups are where a 23-URL domain can appear without outranking anyone.

### [MEDIUM] /classes/mental-health omits every clinical noun people actually search, which is a deliberate compliance choice that is costing the page its entire keyword base

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** https://www.myyogaclasses.fit/classes/mental-health, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/mental-health.json

**Evidence.** Live token scan of /classes/mental-health: calm 28, stress 10, anxiety 0, anxious 0, sleep 0, insomnia 0, depression 0, worry 0. The title is `Mental Health · My Yoga Classes` and the meta description says "stress and a busy mind". CLAUDE.md records that migration 0024_category_copy_positive deliberately reframed this copy to be health-claim-safe under UAE and India advertising rules. Competitors ranking for "online yoga classes for anxiety" (flexifyme.com/stress-management, shyambhai.yoga/online-yoga-classes-for-stress-relief/) use "stress" freely but the pure-anxiety results are training providers (myvinyasapractice, aurawellnesscenter, themindedinstitute), which suggests the commercial anxiety SERP is genuinely thin.

**Recommendation.** Do not reintroduce clinical claims. Instead target the compliant commercial phrasing the SERP already rewards: "online yoga classes for stress relief" is served by shyambhai.yoga at position nine and uses no clinical language. Set seoTitle to "Online Yoga for Stress, 1:1 Sessions" and add "stress relief" as an exact phrase, which the page currently does not contain (only the bare word "stress"). Add "sleep" as a benefit noun, which is descriptive rather than diagnostic and therefore safe. Accept that "yoga for anxiety" and "yoga for depression" are off-limits, and say so to the owner rather than quietly leaving the gap.

### [MEDIUM] The competitor-alternative SERP is soft and the site has no comparison page to capture it

- **Verdict:** unverified | **Effort:** moderate | **Impact:** medium
- **Locations:** https://www.myyogaclasses.fit/pricing

**Evidence.** "myyogateacher alternative cheaper" returns simplycodes.com (coupons), dontpayfull.com (coupons), healthynexercise.com (affiliate review), growjo.com and tracxn.com (B2B company-data pages with no consumer value), 1om1.net (a competitor's own listicle) and myyogateacher.com itself. Only one genuine editorial result. Pricing evidence gathered: myyogateacher runs "$71/month" annual versus "$89/month" standard, "$178 upfront for the first 3 months"; 1om1.net offers "30 classes for $68"; mywowfit "starting at just $24.50 per session"; Singapore privates "S$60 and S$100 per session"; UK "from £30 for a one-hour class". This site's live packs are ₹999 / ₹4,499 / ₹7,999.

**Recommendation.** Create /compare/myyogateacher-alternative. Because two of the seven ranking results are stale B2B data pages and two are coupon aggregators, a genuine side-by-side comparison page can realistically break in. Be factual and dated: contrast subscription-with-commitment against one-time prepaid session packs, which is the true structural difference and also this site's strongest differentiator. Critical constraint: the page must say "prepaid 1:1 sessions" and never "credits", per the iOS payment decision. Blocked until USD/GBP pricing exists, since the comparison is meaningless in rupees against a dollar competitor.

### [MEDIUM] The NRI and diaspora cluster is the most defensible position available and is currently unaddressed by a single URL

- **Verdict:** unverified | **Effort:** moderate | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/teachers, https://www.myyogaclasses.fit/

**Evidence.** The SERP for "online yoga classes for NRI Indians abroad USA time zone" is entirely India-based providers selling to the diaspora: zugafitness.in/Blog/online-yoga-classes-usa-new-york-california.html, indiannatya.com/usa-yoga-classes/, indiannatya.com/yoga-online/ (titled "for Kids and Ladies - UAE - US - UK - CA - IN"), callmyyoga.com, yogkulam.org, prathamyoga.com, ruhyoga.com, fitsri.com. Note zugafitness ranks with a blog post targeting a single city pair and has a second ranking page, zugafitness.in/Blog/live-online-yoga-class-london-timezone.html. These are weak pages winning on exact-match targeting alone. This site has three named Indian teachers with individual pages and 60-minute live sessions, which is a stronger proposition than any of them, and INR already renders correctly for this audience.

**Recommendation.** Create three market pages: /online-yoga-classes-usa, /online-yoga-classes-uk, /online-yoga-classes-uae. Each should name the specific timezone overlap in plain text (IST to EST, IST to GMT, IST to GST), list the three teachers, and state the session length. This cluster is uniquely viable right now because it is the one global-market cluster where INR pricing is not a liability: NRI buyers understand rupee pricing. Prioritise it above the US/UK generic clusters that are blocked on currency work.

### [LOW] /classes/pain-relief covers the neck 13 times and lower back zero times, inverting the actual search demand

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/classes/pain-relief, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/pain-relief.json

**Evidence.** Live grep of /classes/pain-relief: neck 13, Knee 2, arthritis 2. A word-boundary scan for "back" returns only "everyday back" 4, "my back" 4, "sensitive backs" 6, "stiff back" 2, "upper back" 2, "the back" 6, "supported backbend" 2. There is no instance of "back pain", "lower back pain" or "sciatica" anywhere on the page. Meanwhile the SERP for "online yoga for back pain live one on one teacher" is headed by myyogateacher.com, mywowfit.com ("If you're dealing with back pain, they'll help match you with the right certified yoga teacher"), superprof.com and 1om1.net, whose founder story is explicitly "overcoming back pain through online private yoga".

**Recommendation.** Corrected finding (kw-commercial, LOW): /classes/pain-relief already leads on the back semantically (back-family 15 vs neck 5 in rendered content; first pose group tagged "Spine & back care"; meta description "everyday back, neck, and joint tension"), but it never uses the two highest-intent literal phrases buyers search: "lower back pain" (0) and "sciatica" (0). The page is not demand-inverted; it is phrase-thin on its own strongest topic.

Corrected recommendation, all of it executable in files that actually render:

1. In /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/pain-relief.json, do NOT restructure the body. Make three surgical phrase edits:
   - poseGroups[0].why: change "Gentle mobility for a stiff back, kept pain-free." to "Gentle mobility for lower back pain and everyday stiffness, kept pain-free."
   - poseGroups[0].poses[2].desc (Apanasana): change "A gentle low-back release..." to "A gentle lower back release that helps the spine settle and soften."
   - heroLead or whoForText: name sciatica once, inside the existing safety framing rather than as a claim, e.g. append to whoForText: "If you have sciatica or a diagnosed disc issue, your teacher works within the range your doctor has cleared."
   Keep every existing medical hedge. No em-dashes. This respects migration 0024's positive-copy reframe.

2. Add ONE FAQ to pain-relief.json phrased as the literal query, for passage/AI-overview retrieval, NOT for a rich result: q: "Can online yoga help lower back pain?" with an answer that stays inside the existing claim-safe register ("Gentle, guided movement can help many people move more comfortably, and a 1:1 teacher can keep every posture inside your pain-free range. It is not a treatment for a diagnosed condition, so see your doctor first."). Do not justify this by FAQPage markup: the page emits no FAQPage, and Google fully deprecated FAQ rich results on 7 May 2026.

3. Drop the seoTitle recommendation entirely - no such field exists. The title fix is real but belongs elsewhere: either update class_categories.name for the pain-relief row via /admin (live value "Pain Relief"), or, better and code-side, change app/(marketing)/classes/[slug]/page.tsx:32 to prefer a new optional `title` key read from the condition JSON with `c?.name` as fallback, then set it to "Yoga for Back and Neck Pain" (the layout template appends " · My Yoga Classes"). That is a code change in the (marketing) group that must not introduce cookies() and must keep `export const revalidate = 300` plus generateStaticParams intact.

4. Separately correct first-pass audit item 7: FAQPage JSON-LD is present on / and /faq but NOT on any condition page. faqPageJsonLd exists at lib/seo/structuredData.ts:22 with zero callers. Given the May 2026 deprecation, adding it is not worth doing for rich results; the genuinely missing and still-supported markup on these pages is BreadcrumbList.

### [LOW] No hreflang and an invalid og:locale on a site explicitly targeting six English markets

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** low
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/layout.tsx, https://www.myyogaclasses.fit/

**Evidence.** `curl -s https://www.myyogaclasses.fit/ | grep -c hreflang` returns 0. The live tag is `<meta property="og:locale" content="en" />`, set at app/layout.tsx in the openGraph block as `locale: "en"`. Open Graph requires language_TERRITORY. The only alternates entry in the codebase is `alternates: { canonical: "/" }` at app/layout.tsx:71.

**Recommendation.** Corrected finding (severity: LOW, cosmetic, and misfiled under kw-commercial; it belongs under technical/social markup and has no keyword or revenue impact):

TITLE: og:locale uses a bare language code instead of the Open Graph language_TERRITORY format.

EVIDENCE: app/layout.tsx:75 sets `locale: "en"`, rendering `<meta property="og:locale" content="en"/>` on every page. ogp.me requires language_TERRITORY and lists og:locale as optional with default en_US. Google does not consume og:locale. `<html lang="en">` (app/layout.tsx) is already the correct, correctly-formatted language signal.

CORRECTED CLAIM ABOUT alternates: the site already has full self-referential canonical coverage. Thirteen `alternates` entries exist, one per indexable marketing route, verified live on /pricing, /teachers and /classes/diabetes. There is no canonical gap. Delete the "only alternates entry" claim entirely.

CORRECTED CLAIM ABOUT MARKETS: the site does not target "six English markets." lib/geo/region.ts:34 declares five currencies (INR, AED, USD, GBP, EUR), EUR covering a 20-country EUROZONE that is mostly not English-first. Only INR renders live today (/api/region returns INR; /pricing shows ₹ only), because effectiveCurrency() downgrades unpriced currencies.

RECOMMENDATION: change one line, `locale: "en"` to `locale: "en_US"` at app/layout.tsx:75, purely so the tag is spec-conforming. Expect no measurable effect: en_US is the spec default a conforming consumer already assumes. Treat it as a two-minute hygiene fix, not a ranking action, and do not let it displace higher-yield work such as the 23-URL index footprint or the unkeyworded condition-page titles.

DO NOT add `alternateLocale: ["en_GB","en_IN","en_AE","en_SG","en_CA","en_AU"]`. og:locale:alternate means "other locales this page is available in." This site serves one language at one URL per topic, so that array would assert six translations that do not exist, and half the listed markets (SG, CA, AU) are not in the codebase at all while the Eurozone that is in the codebase is missing.

DO NOT add hreflang, for the same reason, and the original finding already agreed on this point. Revisit only if genuinely distinct per-market URLs are ever created.

### [LOW] The /classes hub meta description lists nine clinical category labels and captures none of the commercial modifiers those pages should rank for

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** https://www.myyogaclasses.fit/classes, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/page.tsx

**Evidence.** Live: `<meta name="description" content="Diabetes, hypertension, prenatal, hormonal health, pain relief, mental health, weight loss, geriatric, kids: find the 1:1 yoga that fits what your body is working on.">` and `<title>Class types · My Yoga Classes</title>`. "Class types" is an internal taxonomy word. Nothing in the title says "online", "yoga" as a standalone noun, or any condition.

**Recommendation.** Change the /classes title to "Online Yoga Classes by Condition" and rewrite the description to lead with the two highest-opportunity conditions rather than the alphabetical category list: "Online 1:1 yoga for diabetes, PCOS, high blood pressure, back pain, pregnancy and more. 60-minute live sessions with a teacher in India." Note this is a code change in the classes route metadata, not an admin_settings change, so it will take effect.

### [LOW] robots.txt does not disallow /teacher, so a middleware-gated area is crawlable

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** low
- **Locations:** https://www.myyogaclasses.fit/robots.txt, /Users/shalomp/YOGA_WEBSITE/app/robots.ts

**Evidence.** Live robots.txt: `Disallow: /admin`, `Disallow: /dashboard`, `Disallow: /api`. /teacher is absent. CLAUDE.md documents /teacher as a middleware-gated plus requireTeacher() surface. Crawlers will follow it and receive redirects, wasting crawl budget on a 23-URL site where every crawl request matters. Note also that the disallow entries have no trailing slash, and the inArea() helper comment in CLAUDE.md warns that a bare prefix makes /teacher swallow the public /teachers listing, so adding `Disallow: /teacher` without care would deindex the three teacher pages that are the site's best entity signals.

**Recommendation.** Add `Disallow: /teacher$` is not supported by all crawlers, so instead add the exact lines `Disallow: /teacher` followed by `Allow: /teachers` and `Allow: /teachers/`. Verify after deploy that https://www.myyogaclasses.fit/teachers/dr-sangeeta is still reported as allowed, because the three /teachers/[slug] pages carry the Person and BreadcrumbList JSON-LD and must stay indexable.

---

## kw-informational (13)

### [MEDIUM] CORRECTION: the repo pose corpus is 1,070 words total, not publishable content. It is a seed index, not a draft.

- **Verdict:** partially-correct | **Effort:** substantial | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/diabetes.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/geriatric.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/prenatal.json

**Evidence.** Computed across lib/data/condition-pages/*.json: 107 pose entries, desc word counts n=107 min=2 max=21 mean=10.0 total_words=1070. Only 55 unique `sa` values; ~38 are real named asanas/pranayama (the rest are generic: "Gentle stretches", "Shoulder rolls & arm circles", "Seated ankle & leg mobility"). poseGroups total is 35, not 36 (diabetes 4, geriatric 4, hormonal-health 4, hypertension 3, kids-yoga 4, mental-health 4, pain-relief 4, prenatal 4, weight-loss 4). Descriptions are claim-safe marketing lines with no steps, no benefits list, no contraindications: e.g. Setu Bandhasana = "A gentle lift that builds strength through the legs and back without strain." By contrast myyogateacher.com/yoga-asana/setu-bandha-sarvangasana is ~3,500-4,000 words across 9 sections (What is, Overview/Meaning, Benefits split 4 ways, Step-by-Step, Variations, Precautions & Contraindications, Related Poses, FAQ, Related Articles).

**Recommendation.** Corrected finding (severity: medium, reframed as a guardrail on the pose-page proposal, not a site defect):

The pose corpus in lib/data/condition-pages/*.json is 107 entries / 1,070 total description words (min 2, max 21, mean 10.0) across 35 poseGroups and 55 unique `sa` values, of which roughly 35 are canonical named asanas or pranayama once generic labels and variants are deduped. Correct the established audit on two points: it is 35 poseGroups, not 36, and the corpus is NOT unpublished. ConditionLanding.tsx renders poseGroups on all nine live /classes/[slug] pages (verified: the Setu Bandhasana description appears in the prerendered HTML of https://www.myyogaclasses.fit/classes/diabetes, x-nextjs-prerender: 1). In that context a 10-word line is the right form and needs no change.

The real point, narrowed: the corpus is sufficient as a pose-to-condition mapping but insufficient as the body of standalone /poses/[slug] pages. Competitor depth is ~3,015 words including chrome (roughly 2,200-2,600 of body) across 9 sections on myyogateacher.com/yoga-asana/setu-bandha-sarvangasana, not 3,500-4,000.

Revised recommendation:
1. Treat the JSON as (a) the canonical pose list, (b) the pose-to-condition mapping that fixes the internal-linking dead end in established item 3, and (c) the seed for a new pose-page intro. Note that no `posePage` field exists in the repo today, so this is net-new schema, not an extension of something already there.
2. Do not set a word budget as the target. Word count is not a ranking factor and Google has stated there is no minimum. Target topical completeness instead: a pose page ships only when it has steps[], benefits[], contraindications[], modifications[], props[] and at least 3 faqs[] filled, plus slug, sanskrit, english and conditions[]. Length follows from that.
3. Ship in waves of 8-10 completed poses, highest search-demand asanas first, and add each wave to the sitemap only after the fields above are populated. On a 23-URL site, 35 stubs would more than double the index with the thinnest pages on the domain.
4. Implementation constraints for the new route: it lives in the (marketing) group, so it must use generateStaticParams plus a revalidate export and must not call cookies() anywhere in the subtree, or ISR dies group-wide with no build error. No new third-party origin is involved, so no next.config.ts CSP edit is needed. Keep the zero-em-dash rule in all new pose copy.
5. Cheaper prerequisite worth doing first, independent of pose pages: emit BreadcrumbList on the nine /classes/[slug] pages (currently absent) and add the missing FAQPage node there, since the live diabetes page carries only Organization, ContactPoint, Course and CourseInstance despite having a FAQ section.

### [MEDIUM] CORRECTION to item 2: condition-page H1s ARE well-keyworded. Only the <title> is bare, and it comes from one line of code.

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx, /Users/shalomp/YOGA_WEBSITE/app/layout.tsx

**Evidence.** Live https://www.myyogaclasses.fit/classes/hypertension returns <title>Hypertension · My Yoga Classes</title> but <h1>Yoga for <em>blood pressure</em>, shaped around you.</h1>, and meta description "Gentle 1:1 yoga for high blood pressure: slow movement, calming breathwork, and deep rest, practised alongside the care you already receive." The defect is isolated to app/(marketing)/classes/[slug]/page.tsx:32 `title: c?.name ?? "Class"`, which reads the DB category name. Line 33 already correctly prefers `rich?.metaDescription` from the JSON. Root template is app/layout.tsx:66 `template: "%s · My Yoga Classes"`.

**Recommendation.** Corrected finding (severity: medium). Nine condition pages ship a bare DB category name as their <title>. Verified live: "Hypertension · My Yoga Classes", "Diabetes · My Yoga Classes", "Prenatal & Postnatal · ...", "Hormonal Health · ...", "Pain Relief · ...", "Mental Health · ...", "Weight Loss · ...", "Geriatric Yoga · ...", "Kids Yoga · ...". None contains "yoga for", "online", or "1:1". Source: app/(marketing)/classes/[slug]/page.tsx:32 `title: c?.name ?? "Class"` reading class_categories; template app/layout.tsx:66 `"%s · My Yoga Classes"` (18 chars). Line 33 already correctly prefers rich?.metaDescription, and the 9 meta descriptions are genuinely good.

Correction to the original finding: it is NOT true that only the <title> is bare. Two H1s carry no target keyword at all, so this needs a two-field fix, not a one-line one:
- weight-loss H1 is "Yoga for an active routine, shaped around you." Change h1Em from "active routine" to "weight loss".
- mental-health H1 is "Yoga for a calmer mind, shaped around you." Change h1Em from "calmer mind" to "anxiety and stress".
- hypertension H1 says "blood pressure"; change h1Em to "high blood pressure".
The other six H1s (diabetes "Yoga for diabetes", prenatal "Yoga for pregnancy", geriatric "Gentle yoga for older adults", pain-relief, hormonal-health, kids-yoga "Yoga for kids, full of play") are acceptable as-is.

Implementation: add `seoTitle: string;` to the ConditionPage type in lib/data/condition-pages.ts (alongside metaDescription at line 59), add the string to each of the 9 JSON files in lib/data/condition-pages/, and change page.tsx:32 to `title: rich?.seoTitle ?? c?.name ?? "Class",`. Keep the `c?.name` fallback so any future category without rich JSON still renders. This is code, not DB, so it deploys normally; generateMetadata is already static so ISR in the (marketing) group is unaffected.

Suggested strings (all land at 52-58 chars including the template; kids-yoga shortened from the original suggestion, which was 60):
hypertension "Yoga for High Blood Pressure, 1:1 Online"; diabetes "Yoga for Diabetes: 1:1 Online Classes"; prenatal "Prenatal Yoga Online, 1:1 With a Teacher"; hormonal-health "Yoga for PCOS and Hormonal Balance, 1:1"; geriatric "Chair Yoga for Seniors, 1:1 Online"; pain-relief "Yoga for Back and Neck Pain, 1:1 Online"; mental-health "Yoga for Anxiety and Stress, 1:1 Online"; weight-loss "Yoga for Weight Loss, 1:1 Online Classes"; kids-yoga "Kids Yoga Online, 1:1 Live Classes".

Also worth noting for the owner: because the title currently reads class_categories.name, renaming those 9 rows in the admin achieves most of the title benefit with zero deploy. The seoTitle field is still the better home, since it decouples the SEO string from the human-facing category label used in nav and cards.

Separately, first-pass audit item 2 has a factual error: the title separator is "·" (U+00B7), not "|".

### [MEDIUM] /classes/hormonal-health is invisible for PCOS and menopause, the two queries that actually have demand.

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/hormonal-health.json, https://www.myyogaclasses.fit/classes/hormonal-health

**Evidence.** Live title is "Hormonal Health · My Yoga Classes". Nobody searches "hormonal health yoga". SERP for "yoga for pcos does it work poses hormonal" returns myyogateacher.com/articles/yoga-for-women-with-pcos at #2 alongside birlafertility.com, myovacare.com, omyogshala.in, weljii.com, i.e. a beatable field with no Healthline/Mayo lock-in. The page already carries the right practices: hormonal-health.json contains Baddha Konasana, Supta Baddha Konasana, Setu Bandhasana, Balasana, Paschimottanasana, Viparita Karani, Nadi Shodhana, Bhramari, and Sheetali ("a slow, cooling breath that many find soothing during warm flushes", an explicit menopause hook already written).

**Recommendation.** CORRECTED FINDING
/classes/hormonal-health ranks for nothing, because its title, H1 and meta description all use "hormonal health", the weak variant of a phrase family whose demand actually sits under "PCOS", "hormonal balance" and "menopause". Menopause is NOT missing from the page (5 mentions plus a dedicated FAQ, whoFor line and testimonial), it is missing only from the three fields search engines weight most. PCOS genuinely is absent apart from one negating FAQ. Severity: medium, and it is one instance of a template-wide problem across all 9 condition pages.

CORRECTED RECOMMENDATION

Step 1, the actual retitle (the finding's own location cannot do this). Do NOT edit class_categories.name in the DB: that string also renders PracticeSection.tsx:45, ClassGrid.tsx:64 and the Course JSON-LD name. Instead add an optional `seoTitle` to each condition JSON and prefer it in app/(marketing)/classes/[slug]/page.tsx:33:

  title: rich?.seoTitle ?? c?.name ?? "Class",

Then in hormonal-health.json add:
  "seoTitle": "Yoga for PCOS, Menopause and Hormonal Balance"
(44 chars, plus the 18-char " · My Yoga Classes" template from app/layout.tsx:66 = 62, so keep any seoTitle under about 42 chars if you want no truncation. A tighter alternative: "Yoga for PCOS and Menopause Support", 35 chars.)

This is code-side, keeps the DB name intact, and generalises to the other 8 pages in one change.

Step 2, health-claim reconciliation the finding missed. The page's own first FAQ answers "No." to "Can yoga balance my hormones or treat PCOS, thyroid, or menopause?" A title that names PCOS must stay support-framed, never relief- or treatment-framed, or the title contradicts the page and breaches the 0023/0024 claim-safe framing. Prefer "support" over "relief", "balance" or "cure".

Step 3, meta description. Replace the current one in hormonal-health.json with something that carries both entities:
  "Live 1:1 online yoga for PCOS, perimenopause and menopause: gentle movement, cooling breath, and deep rest, shaped to how you feel. Practised alongside your doctor's care."

Step 4, H1. Unlike the title, the H1 IS code-editable via the JSON (h1Before / h1Em / h1After, rendered at ConditionLanding.tsx:75-77). Set h1Em to "PCOS and menopause" only if you also keep the support framing, otherwise leave the H1 alone and let the title carry the keywords.

Step 5, on the two articles. Treat this as a separate, larger proposal, not part of this fix. There is no /articles route in the repo today, so this is new route-group plus content-pipeline work. If it proceeds, /articles/yoga-for-menopause-hot-flashes is the stronger of the two, because the Sheetali line already in the JSON is a genuine differentiator that most of the ranking field lacks. Drop the /breathing/sheetali cross-link entirely: that URL does not exist and nothing in the repo plans it. Cross-link to /classes/hormonal-health only.

Step 6, the cheaper win the finding skipped. The condition pages are internal-linking dead ends (first-pass item #3). Before building articles, add a "related conditions" block linking hormonal-health to prenatal, weight-loss and mental-health, which are the three pages whose audiences overlap PCOS. That is a pure JSON plus component change, ISR-safe, and needs no new content.

### [MEDIUM] geriatric.json is a complete chair-yoga curriculum and chair yoga is the single most winnable high-volume head term on this list.

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/geriatric.json, https://www.myyogaclasses.fit/classes/geriatric

**Evidence.** SERP for "chair yoga for seniors beginners poses" returns myyogateacher.com/articles/chair-yoga-for-seniors at position #1, above GoodRx and Healthline. geriatric.json already contains a chair-native sequence: "Seated Cat-Cow", "Seated gentle twist", "Seated ankle & leg mobility", Sukhasana, "Tadasana (Mountain pose at a chair)", "Vrksasana: Fingertips on a chair for support", "Gentle standing leg lifts", "Chair-supported gentle squat", "Shoulder rolls & arm circles", "Gentle wrist & ankle circles", "Supported gentle backbend", Bhramari, Shavasana "On a chair or floor, as comfortable". 14 of the 107 entries are chair-specific.

**Recommendation.** CORRECTED FINDING (severity: medium)

Title: /classes/geriatric is about chair-supported yoga for seniors but never says "chair yoga" or "seniors", and the six chair poses already in geriatric.json are unpublished.

Corrected evidence:
- geriatric.json holds 14 pose entries, of which SIX explicitly reference a chair: Seated Cat-Cow, Tadasana at a chair, Vrksasana with fingertips on a chair, Gentle standing leg lifts, Chair-supported gentle squat, Shavasana on a chair or floor. Not 14. The other 8 are seated or gentle but chair-agnostic.
- Live /classes/geriatric (200, 929 words) contains "chair" 42 times but "chair yoga" 0 times and "senior" 0 times. Title: "Geriatric Yoga · My Yoga Classes".
- SERP reality: myyogateacher ranks #1 for the 5-word long-tail "chair yoga for seniors beginners poses", but is absent from the head term "chair yoga for seniors", which is held by SilverSneakers, Healthline, GoodRx, seniorlifestyle.com and actsretirement.org. This is a high-authority-publisher SERP, not a soft one.

Corrected recommendation:
1. Do NOT open the article programme here. Chair yoga is a free-content SERP owned by DR90 health publishers, and the traffic converts worst of the nine conditions given /pricing renders INR. Prioritise prenatal, hypertension or pain-relief first: same 107-pose corpus depth, higher commercial intent, and a much stronger "needs live 1:1 supervision" argument.
2. Ship the cheap on-page fix now, which costs nothing and needs no new route. Stop deriving the title from the DB row. In app/(marketing)/classes/[slug]/page.tsx generateMetadata, add an optional `seoTitle` field to the condition-page JSON and prefer it: `title: rich?.seoTitle ?? c?.name ?? "Class"`. Set geriatric.json seoTitle to "Chair Yoga for Seniors, Live 1:1 Online" (44 chars, 62 after the "· My Yoga Classes" suffix). This keeps the change in code and leaves class_categories.name alone, so the /classes cards and nav labels do not shift.
3. Work the phrase into visible copy in the same JSON, which is code-side and safe: change heroLead to open "Slow, supportive 1:1 chair yoga and gentle movement for seniors..." and retag the first poseGroup from "Seated & chair" to "Chair yoga poses". No em-dashes, no free-trial wording, no DB dependency, ISR unaffected.
4. If an article is later written, budget it honestly: the JSON supplies 6 chair poses, not 12, so either expand geriatric.json with the five canonical chair poses every competitor covers (seated forward fold, seated eagle arms, seated warrior II, seated figure-4, seated side bend) or scope the article to 1,000-1,200 words. Drop the "/poses/ page" internal links until a /poses hub actually exists; `find app -type d -name poses` returns nothing today.
5. Target the long-tail, not the head term: "chair yoga for seniors with a teacher online", "1:1 chair yoga for balance and fall prevention". Those are where a 23-URL domain can rank and where the live-supervision angle is a differentiator rather than a liability.

Side observation outside this finding's scope: https://www.myyogaclasses.fit/classes renders 2 em-dashes, inherited from class_categories descriptions in seed.sql/0023 (e.g. "confidence — with chair options as needed"). That is DB copy, so the repo-wide em-dash sweep missed it.

### [MEDIUM] Proposed URL architecture: three hubs, ~90 URLs, built from the existing JSON with no new data source.

- **Verdict:** partially-correct | **Effort:** substantial | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/, /Users/shalomp/YOGA_WEBSITE/app/sitemap.ts

**Evidence.** Live sitemap.xml has exactly 23 <loc> entries (verified by curl | grep -c). app/(marketing)/ contains only about, classes, contact, faq, legal, pricing, reviews, teachers. Competitor uses /yoga-asana/[slug] (84 pages) and /types-of-yoga/[slug] (46) and /articles/[slug] (241).

**Recommendation.** Corrected finding: the site has 23 indexable URLs against myyogateacher.com's verified 613 (232 main + 381 article-sitemap, including 84 /yoga-asana and 47 /types-of-yoga). It has no informational-intent surface at all. lib/data/condition-pages/*.json gives a 45-pose naming index that is a good SLUG and PRIORITIZATION source, but supplies only 1,070 words of prose across all 107 entries (mean 10 words each), so it is not a content source. Budget the content, do not assume it exists.

Corrected recommendation:

1. Scope wave 1 to 10 pose pages, not 90, and treat each as ~500 words of hand-written copy. Ship /poses + /poses/[slug] for: bridge-pose, cat-cow-pose, childs-pose, legs-up-the-wall, tree-pose, cobra-pose, chair-pose, butterfly-pose, seated-forward-bend, knees-to-chest. These are the highest-reuse entries in the JSON (cat-cow appears in 6 condition files, tree pose and child's pose in 4), so each earns multiple contextual internal links from the condition pages, which fixes the dead-end problem in audit item 3 at the same time. Measure indexation and impressions in Search Console before funding waves 2 and 3.

2. Cut kapalbhati and ujjayi from the breathing set. Ship four: alternate-nostril-breathing (Nadi Shodhana, in 6 files), bhramari (6 files), sheetali (2 files), extended-exhale-breathing (1 file). Kapalbhati is named as a contraindication in hypertension.json, prenatal.json and diabetes.json; a page promoting it contradicts the site's own claim-safe condition copy. If kapalbhati is ever published, it must be framed as "who should avoid it," not "benefits."

3. Drop /articles from this finding. It has no existing data source and belongs in a separate, separately budgeted editorial recommendation. Do not count its ~54 URLs toward a figure presented as free.

4. Route mechanics (unchanged, and correct): new segments under app/(marketing)/, `export const revalidate = 3600`, generateStaticParams over the JSON, no Supabase call and no cookies(), mirroring app/(marketing)/classes/[slug]/page.tsx:15-23.

5. Titles: a plain `title` string on a child route still inherits the app/layout.tsx:66 template, so use `title: { absolute: ... }`. Correct string and length: `absolute: "Bridge Pose (Setu Bandhasana): Benefits and Steps"` = 49 chars rendered. The untruncated version with the template is 74 chars, not 71.

6. Add BreadcrumbList JSON-LD on every new page (Home > Poses > Bridge Pose) reusing the builder already used on /teachers/[slug], and link each pose page back to the condition pages that reference it.

### [MEDIUM] The JSON already encodes the pose-to-condition link graph that fixes the dead-end problem. It is free internal linking.

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx

**Evidence.** Deduplicating `sa` across the 9 files yields a ready-made many-to-many map: Shavasana appears in 8 conditions; Bhramari 7 (diabetes, geriatric, hormonal-health, hypertension, kids-yoga, mental-health, prenatal); Yoga Nidra 7; Nadi Shodhana 6; Marjaryasana-Bitilasana 6; Tadasana 5; Balasana 5; Setu Bandhasana 4 (diabetes, hormonal-health, hypertension, pain-relief); Vrksasana 4; Paschimottanasana 3. Condition pages currently render these as plain text with no links, which is why they are dead ends (audit item 3).

**Recommendation.** Corrected finding (severity: medium, not high)

Evidence fix: 35 poseGroups (not 36); Vrksasana appears in 3 conditions (geriatric, kids-yoga, weight-loss), not 4. All other counts reproduce exactly. 55 distinct poses across 107 pose→condition pairs; only 17 poses appear in more than one condition.

Corrected recommendation — do the free half, skip the expensive half.

PHASE 1 (ship this; zero new routes, zero new pages, no thin content, no new medical claims):
In components/marketing/condition/ConditionLanding.tsx, build the `sa` → conditions map once at module scope from the 9 imported JSON files, then render a new "Also practised for" block at the end of the POSES section of /classes/[slug]. For each of the 8 sibling conditions that shares at least one pose, emit one `<Link href="/classes/{slug}">` whose visible text is the sibling's own `h1Em` value, with the shared pose names as the supporting line. This yields 72 directed contextual condition-to-condition links, 8 per page, turning 9 isolated leaves into a fully connected cluster. It is a pure derivation from data already in the bundle, it stays inside the existing ISR/prerender path (no cookies(), no new route), it needs one short heading as the only new copy ("Also practised for", no em-dash), and every link lands on a page that already carries the safetyText disclaimer.

Also add BreadcrumbList JSON-LD to condition pages (audit item 7 already flags it missing) so the /classes hub relationship is machine-readable, and link /classes/[slug] to the specific teachers who run it, which is the other genuine dead-end.

PHASE 2 (do NOT ship as described): do not generate 55 /poses/[slug] pages from the JSON. Median 12 words of unique body text and 38 single-condition stubs is scaled thin content. If pose pages are wanted later, build only the 17 multi-condition poses (Shavasana, Bhramari, Yoga Nidra, Nadi Shodhana, Marjaryasana-Bitilasana, Tadasana, Balasana, Setu Bandhasana, Vrksasana, Paschimottanasana, Surya Namaskar, Sukhasana, Baddha Konasana, Supta Baddha Konasana, Viparita Karani, Sheetali, Bhujangasana) as real 600+ word medically-reviewed articles, each with a canonical slug and canonical English name added to the JSON schema, each carrying the safetyText disclaimer, and each added to app/sitemap.ts. That is a content project, not a linking refactor, and it should be costed as one.

### [MEDIUM] Global informational traffic will land on an AED/INR-only checkout. This caps the ROI of US/UK/EU keywords until USD/GBP/EUR are priced.

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/pricing, /Users/shalomp/YOGA_WEBSITE/lib/razorpay/catalog.ts, /Users/shalomp/YOGA_WEBSITE/lib/geo/region.ts

**Evidence.** Live https://www.myyogaclasses.fit/pricing meta description reads "Honest yoga pricing in AED and INR. One-time session packs, no subscription." The HTML contains ₹ and AED tokens only. This matches CLAUDE.md: SUPPORTED_CURRENCIES lists INR, AED, USD, GBP, EUR but "As of migration 0036 only INR and AED are actually priced", and effectiveCurrency() downgrades to INR otherwise. A US reader arriving on "bridge pose benefits" is quoted rupees.

**Recommendation.** CORRECTED FINDING
Title: /pricing is one ISR artifact rendered in INR for the whole world, and its meta description tells the SERP the studio only bills in AED and INR. That is a relevance and trust leak on global queries, not a checkout blocker.

Corrected evidence:
- Served /pricing carries `x-nextjs-prerender: 1`, `x-vercel-cache: HIT`. The rendered prices are ₹999 (1 session), ₹4,499 (5), ₹7,999 (10). Every visitor and every Googlebot crawl gets that rupee HTML; a UAE visitor does too. Currency is corrected client-side after mount by components/marketing/PricingTeaser.tsx:90 calling /api/region.
- The five "AED" tokens in the HTML are raw plan_prices rows in the RSC flight payload (5900 / 27500 / 49900 fils), not rendered prices.
- Only INR and AED are priced: zero USD, GBP, EUR, £ or € tokens in the document, consistent with pricedCurrencies() in lib/razorpay/catalog.ts and with 0036_international_currencies.sql inserting no prices.
- Per-session economics are ~$9-11, not $23-24. Against $60-120 US private rates the price is a strength; the problem is the symbol, not the number.

Corrected severity: medium. The site has 23 indexable URLs and no informational corpus, so no global informational traffic exists to be capped today.

Corrected recommendation (ordered, and deliberately NOT "park the content"):

1. Do NOT insert USD/GBP/EUR plan_prices rows yet. app/api/payments/intent/route.ts:35 and 0036's header both record that Razorpay International is not enabled on the account, which is why the AED manual SWIFT rail (0030) exists. Pricing USD would make effectiveCurrency return USD, route the buyer to `{method:"razorpay", currency:"USD"}` at intent route line 101, and mint an order the account cannot accept, replacing a working INR Checkout with a failure. Sequence is: enable Razorpay International (support request, settlement stays INR), confirm an AED order clears, then price USD/GBP/EUR in /admin/plans.

2. Ship the pose content NOW, in parallel, not after pricing. Pages published today rank in roughly 3-9 months. The 107 pose entries in lib/data/condition-pages/*.json are the asset; publishing them is independent of currency. Lead with the Sanskrit-name queries (vajrasana, mandukasana, surya namaskar, bhramari, sheetali) because the corpus already contains them and they carry lower competition, not because US demand should be deferred.

3. Fix the meta description, which is in code (app/(marketing)/pricing/page.tsx:13) and therefore actually changeable, unlike the DB-driven hero and plan_features. Replace "Honest yoga pricing in AED and INR. One-time session packs, no subscription." with something that does not fence off the SERP, for example: "Transparent pricing for live 1:1 yoga with India-based teachers. One-time session packs, no subscription, sessions never expire." No em-dashes, no free-trial wording, keeps the 1:1 framing, changes no DB-driven surface, adds no third-party origin, and does not touch ISR.

4. Add a currency-agnostic trust line to the pricing page for non-IN/AE readers, since the rupee figure will be what they see until step 1 lands. Something like "Priced in Indian rupees. Your card is charged the equivalent in your own currency." This is a code-side component string, not admin_settings.

5. Do not treat "yoga for diabetes / PCOS / hypertension" as new work. /classes/diabetes, /classes/hormonal-health and the other seven condition pages are already live at 200. The open gap on those is the title template and internal linking already logged elsewhere in the audit, not the calendar.

### [MEDIUM] Slug strategy: use English-name slugs with Sanskrit in title and H1. The competitor's Sanskrit-only slug is a weakness to exploit, not a pattern to copy.

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** https://myyogateacher.com/yoga-asana/setu-bandha-sarvangasana

**Evidence.** myyogateacher.com uses /yoga-asana/setu-bandha-sarvangasana yet its own title is "Setu Bandhasana (Bridge Pose): Benefits, Steps & Variations" and its H1 is "Bridge Pose (Setu Bandhasana)", i.e. both put the English name first because that is where global English demand sits. Note also the naming collision: the repo says "Setu Bandhasana" while the competitor slug says "setu-bandha-sarvangasana"; both are in circulation and a slug on one loses the other.

**Recommendation.** Slug on the English name (/poses/bridge-pose), H1 "Bridge Pose (Setu Bandhasana)", title "Bridge Pose (Setu Bandhasana): Benefits and Steps", and cover both Sanskrit spellings in the opening paragraph and in an ItemList of alternate names. Where the repo's Sanskrit differs from the common transliteration, list both: Setu Bandhasana / Setu Bandha Sarvangasana; Marjaryasana-Bitilasana / Marjariasana; Sucirandhrasana / Supta Kapotasana. Do not create separate URLs per spelling.

### [MEDIUM] Schema for the new hubs: HowTo is the wrong choice in 2026. Use Article plus FAQPage plus BreadcrumbList.

- **Verdict:** unverified | **Effort:** moderate | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx

**Evidence.** The repo already has typed JSON-LD builders in lib/seo/structuredData.ts (schema-dts) and already emits FAQPage on condition pages and BreadcrumbList on /teachers/[slug], so the plumbing exists. Google withdrew HowTo rich results, so HowTo markup on a pose page buys nothing.

**Recommendation.** Add to lib/seo/structuredData.ts: buildPoseArticleLd() emitting Article (headline, description, datePublished, dateModified, author as the studio Organization) + FAQPage from the pose's faqs[] + BreadcrumbList (Home > Poses > Bridge Pose). Add BreadcrumbList to /classes/[slug] too, which the first-pass audit correctly flagged as missing. Escape all interpolated strings the same way the 0038-era XSS fix did for teacher fields, since pose descriptions will become admin-editable if they move to the DB.

### [MEDIUM] app/sitemap.ts already uses the cookie-bound Supabase client. Add the new routes from the JSON, not from another DB call.

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/sitemap.ts

**Evidence.** app/sitemap.ts:2 imports createSupabaseServerClient and line 80 calls `await createSupabaseServerClient()`. That client is cookie-bound. sitemap.ts sits outside the (marketing) group so it does not trigger the group-wide ISR failure described in CLAUDE.md, but it does make the sitemap route itself dynamic on every request.

**Recommendation.** Generate the ~90 new /poses, /breathing and /articles entries by importing the JSON at module scope and mapping over it, with no Supabase round trip. Set changeFrequency "monthly" and priority 0.6 for pose pages, 0.7 for articles. Keep the same pattern in generateStaticParams on the new routes so the (marketing) ISR contract from PR #63 is preserved. Separately, consider splitting the DB-backed portion of the sitemap so the static two thirds can be served from the prerender.

### [MEDIUM] Publishing ~90 pages multiplies the existing font and JS payload across the whole informational surface.

- **Verdict:** unverified | **Effort:** moderate | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/layout.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/layout.tsx

**Evidence.** First-pass audit measured 6 preloaded font files at 297 KB across 5 families (Inter, Fraunces, Geist_Mono, Cormorant_Garamond, Hanken_Grotesk) and 476 KB brotli JS in 28 files. Live /classes/hypertension HTML is 88,787 bytes uncompressed for a page whose useful content is ~950 words. Informational traffic arrives cold from search, on mobile, with no warm cache, and bounces on slow first paint. Today that cost is paid on 23 URLs; after this build it is paid on ~113.

**Recommendation.** Before shipping the article hub, cut the preloaded font set on (marketing) routes to two families (one display, one text) and drop Geist_Mono from the preload list entirely since pose pages have no code. Article and pose templates should be static server components with no Motion, Lenis or GSAP import, which are justified on the homepage and not on a pose reference page. Target under 40 KB of route JS for /poses/[slug]. Measure with a byte diff against /classes/hypertension's current 88,787 bytes before and after.

### [LOW] AI Overview exposure: roughly a third of this keyword space is low-click. Deprioritize definitional and efficacy queries.

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/

**Evidence.** SERP composition is the tell. "does yoga help lower blood sugar diabetes evidence" returns diabetes.org, healthline.com, ummhealth.org, and three PMC/NCBI papers: a fully-answerable YMYL consensus question, the exact profile Google summarizes and does not send clicks for. Same for "yoga vs pilates" (Cleveland Clinic, Healthline, WebMD) and "how often should you do yoga per week beginner", where every result converges on the identical "2-3 times a week" answer. By contrast "yoga hurting lower back am I doing it wrong alignment check" returns jasonyoga.com, yoga15.com, yogaselection.com, drmaheshbagwe.com: small independent sites, no consensus answer, and the top result's own conclusion is "if pain persists, consider consulting with a yoga instructor to observe your alignment in person."

**Recommendation.** REVISED FINDING (severity: low, dimension kw-informational)

Title: Do not lead the content program with definitional YMYL queries owned by medical institutions. Lead with the 55 named poses already sitting unaddressed in the repo.

Corrected evidence:
- "does yoga help lower blood sugar diabetes evidence" returns diabetes.org, healthline.com and three PMC/NCBI papers. "yoga vs pilates" returns health.clevelandclinic.org, healthline.com, webmd.com. A 23-URL domain with no informational history will not displace these on E-E-A-T, with or without an AI Overview. That, not click suppression, is the reason to deprioritize them.
- Drop the AI Overview mechanism. It is not measurable from SERP composition, and the finding's own low-AIO classes do not behave differently: "is kapalbhati safe with high blood pressure" and "mandukasana benefits steps" both return full consensus across every result and are as absorbable as anything on the avoid list. Also drop "roughly a third" until a keyword list with an actual AIO-presence count exists.
- Correct the back-pain contrast case: that SERP is mixed, not thin. It contains healthline.com, yogajournal.com (x2) and espn.com alongside the four independent sites cited.

Corrected recommendation, specific to this repo:
1. Ship /poses/{slug} from data that already exists. lib/data/condition-pages/*.json holds 107 pose entries across 35 poseGroups, resolving to 55 distinct Sanskrit names, each already carrying sa / en / desc. These render live today inside condition pages (verified: Mandukasana, Vajrasana, Kapalbhati, Setu Bandhasana all present in the HTML of /classes/diabetes). Promoting them to 55 dedicated URLs takes the sitemap from 23 to 78 and is the single largest indexable-surface gain available without writing new copy. Compare myyogateacher.com, which runs 84 /yoga-asana URLs.
2. Fix the cannibalization this creates. 17 poses appear on more than one condition page (Shavasana on 8, Bhramari on 7, Yoga Nidra on 7, Marjaryasana-Bitilasana on 6, Nadi Shodhana on 6). The canonical explanation belongs on /poses/{slug}; the condition pages should link to it rather than restate it.
3. The differentiator is the 1:1 live format, not the information. A pose page that only restates steps and benefits competes with Tata AIG and myUpchar on their own terms and loses. Each pose page should end in the thing none of them can offer: a named India-based teacher who will check this pose on a 60 minute live 1:1 on video, booked from a prepaid session pack. That is the conversion surface and the reason the page deserves to exist.
4. Titles. Do not ship /poses/{slug} with the bare-name pattern already hurting the condition pages ("Diabetes · My Yoga Classes"). Use "Mandukasana (Frog Pose): Steps, Benefits and Who Should Avoid It", remembering app/layout.tsx appends " · My Yoga Classes" (18 chars).
5. No constraint impact: this is code-side routing, metadata and static JSON. It does not touch admin_settings, plan_features or reviews, adds no third-party origin to the CSP in next.config.ts, and must be built without cookies() so the (marketing) ISR group is preserved.

### [LOW] Yoga Nidra is the strongest commercial bridge in the corpus and it is currently unpublished.

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/mental-health.json

**Evidence.** Yoga Nidra appears in 7 of 9 condition files (diabetes, hormonal-health, hypertension, mental-health, pain-relief, prenatal, weight-loss), more than any pose except Shavasana and Bhramari. The SERP for "what is yoga nidra how does it work script" establishes the wedge in its own top results: yoga nidra "is always practiced with verbal direction from a live or recorded instructor" and "a yoga nidra practice can be anywhere from 30 minutes to 1 hour". A 60-minute live 1:1 session is the native delivery format. Competing results are script PDFs and blog scripts (shambhala.org, brettlarkin.com, lofthouse.com/yoga/yoga-nidra-script.pdf), i.e. static text competing against a live practice.

**Recommendation.** CORRECTED FINDING
Title: There is no article layer at all, and Yoga Nidra is the best-supported seed topic for one, not a standalone win.

Corrected evidence:
- Yoga Nidra appears as a poseGroup entry in 7 of 9 condition JSONs (diabetes, hormonal-health, hypertension, mental-health, pain-relief, prenatal, weight-loss). It is TIED with Bhramari at 7, behind Shavasana at 8. Corpus totals: 107 pose entries across 35 groups.
- It is already PUBLISHED and rendering: ConditionLanding.tsx:142 maps poseGroups, and "Yoga Nidra / Guided deep relaxation" is present in the served HTML of all 7 pages. The gap is that it has no dedicated URL and no internal link target. /articles returns 404 and sitemap.xml holds 23 URLs with no article.
- The commercial SERP for "what is yoga nidra" is Wikipedia, Cleveland Clinic, Calm, Sleep Foundation, Yoga International, Arhanta. The script-PDF SERP the finding cited only appears once "script" is in the query, which is teacher-training intent.
- myyogateacher.com already ranks /articles/what-is-yoga-nidra (~1,200 words, live 1:1 CTA), /articles/yoga-nidra-for-sleep, /articles/yoga-nidra-science, /articles/yoga-nidra-cured-my-insomnia and /yoga-online-classes/yoga-nidra. This is a contested head term, not an open wedge.

Corrected recommendation:
1. Ship the route layer first, not one article. Add app/(marketing)/articles/page.tsx plus app/(marketing)/articles/[slug]/page.tsx with generateStaticParams and export const revalidate, sourcing from a new lib/data/articles/*.json mirroring the condition-page JSON shape. Do not call cookies() anywhere in the group. Register the new URLs in app/sitemap.ts, which currently emits the 23 fixed entries. This is the actual unblocker; the topic choice is secondary.
2. Do not chase "what is yoga nidra" as the primary target. Cleveland Clinic and Wikipedia hold it and myyogateacher.com is already established. Target the long tail this site can plausibly win and that its own corpus already supports: /articles/yoga-nidra-for-high-blood-pressure, /articles/yoga-nidra-during-pregnancy, /articles/yoga-nidra-for-menopause-sleep. Each maps 1:1 onto an existing condition page that already lists Yoga Nidra, which makes the internal link natural in both directions and breaks the dead-end problem.
3. Link bidirectionally. From each of the 7 condition pages, link the Yoga Nidra pose entry to its matching article. From each article, link back to the condition page and to /pricing. This is the higher-value half of the recommendation and the finding only proposed one direction.
4. Differentiate on something the competitor has not already claimed. They already say "live coach." What they cannot say is that the session is a full 60 minutes with one named teacher who keeps your history, and that you pay once for a prepaid session pack with nothing recurring. Sample copy, no em-dashes and no free-trial wording: "A recorded script cannot hear you. In a 60 minute 1:1 session your teacher watches how you settle, adjusts the pacing, and picks up next week where you left off."
5. Add BreadcrumbList JSON-LD on the new article routes and on the condition pages, reusing lib/seo/structuredData.ts. Keep the existing escaping.

Corrected severity: low as a single-topic finding. The article-layer gap it sits on top of is medium to high, but that is a structural finding about the missing route, not about Yoga Nidra.

---

## competitor (20)

### [CRITICAL] Pricing and payment comparison: only mywowfit.com handles global properly. The target ships INR to the whole world today

- **Verdict:** unverified | **Effort:** moderate | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/pricing, https://www.myyogaclasses.fit/api/region, /Users/shalomp/YOGA_WEBSITE/lib/razorpay/catalog.ts, /Users/shalomp/YOGA_WEBSITE/supabase/migrations/0036_international_currencies.sql, https://mywowfit.com/

**Evidence.** Live: GET https://www.myyogaclasses.fit/api/region returns {"country":"IN","currency":"INR","locale":"en-IN"} and /pricing renders only ₹ with the footnote "Prices shown in INR". Repo confirms why: /Users/shalomp/YOGA_WEBSITE/supabase/migrations/0036_international_currencies.sql widened the CHECK to INR/AED/USD/GBP/EUR but states "this migration deliberately inserts NO prices", and resolvePackBySlug() in /Users/shalomp/YOGA_WEBSITE/lib/razorpay/catalog.ts returns null for any currency without a plan_prices row, so effectiveCurrency() downgrades to INR. Competitor handling: mywowfit.com is the only site in the set with real internationalisation, serving `hreflang` for en-us, en-gb, en-nl, en-be, en-ch and x-default plus Product + AggregateRating + Brand JSON-LD and $, £, € and AED on-page. myyogateacher.com is USD-only ("All prices are in US Dollars"). 1om1.net is USD-only with `areaServed: "US"`. patanjaleeyoga.com and shyambhai.yoga display no prices at all on their condition pages and gate everything behind an enquiry, with a separate /online-yoga-classes-fees-in-india/ page.

**Recommendation.** Sequence this ahead of any content spend. (1) Insert plan_prices rows for USD, GBP and EUR for all three active plans in /admin/plans; the schema is ready and this is a commercial decision, not a code change. (2) Confirm Razorpay International is enabled on the account, since 0036's own header warns "the schema is necessary but not sufficient". (3) Only after 1 and 2, add `AggregateOffer` to /pricing with three `Offer` nodes (pack-1, pack-5, pack-10) carrying the resolved `priceCurrency` and `price`, plus `priceValidUntil` and `availability: InStock`. Emitting Offer markup while every currency resolves to INR would publish a machine-readable ₹999 price to Google Shopping surfaces for US queries. (4) Adopt mywowfit's hreflang pattern only if and when region-priced landing pages exist; for a single-language site today, `x-default` plus a correct `og:locale` is sufficient.

### [CRITICAL] Condition-page titles target no keyword, and the fix is one line of code

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx, https://www.myyogaclasses.fit/classes/diabetes

**Evidence.** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx:32 reads `title: c?.name ?? "Class"`, which combines with the root template in app/layout.tsx to produce the live `<title>Diabetes · My Yoga Classes</title>` (26 chars, no keyword). The H1 on the same page is already correct: "Yoga for diabetes, shaped around you." Competitors on the same query: patanjaleeyoga.com "Online Yoga Classes For Diabetes - Patanjalee Institute of Yoga & Yoga Therapy", shyambhai.yoga "Online Yoga Classes for Diabetes | Shyambhai Yoga", myyogateacher.com "7 Yoga Poses for Diabetes: Asanas for Blood Sugar Control". Same pattern on /teachers ("Teachers · My Yoga Classes"), /classes ("Class types · My Yoga Classes") and /pricing ("Pricing · My Yoga Classes").

**Recommendation.** Replace line 32 with a per-slug title map rather than a generic prefix, because the right head term differs by condition. Suggested exact strings (all under 60 chars including the 18-char ` · My Yoga Classes` suffix, so drop the suffix on the longer ones via a `title: {absolute: ...}`): diabetes -> "Online Yoga for Diabetes: 1:1 Sessions with a Doctor"; hypertension -> "Online Yoga for High Blood Pressure, 1:1 with a Doctor"; prenatal -> "Online Prenatal Yoga: Private 1:1 Sessions by Trimester"; hormonal-health -> "Online Yoga for PCOS and Hormonal Health, 1:1 Sessions"; pain-relief -> "Online Yoga for Back and Joint Pain: Private 1:1 Sessions"; mental-health -> "Online Yoga for Anxiety and Stress: Private 1:1 Sessions"; weight-loss -> "Online Yoga for Weight Loss: Private 1:1 Coaching"; geriatric -> "Chair Yoga for Seniors Online: Private 1:1 Sessions"; kids-yoga -> "Online Yoga for Kids: Private 1:1 Classes from India". The existing `metaDescription` fields in lib/data/condition-pages/*.json are already good (the diabetes one is 146 chars and well written); leave them.

### [CRITICAL] The brand SERP is owned by a public GitHub repo whose description is factually wrong, and the real site does not appear at all

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** high
- **Locations:** https://github.com/Shalom-P/yoga-website, /Users/shalomp/YOGA_WEBSITE/app/layout.tsx

**Evidence.** A search for the literal string "myyogaclasses.fit" returns as result 1: "GitHub - Shalom-P/yoga-website: Conversion-first yoga studio web app — Next.js 16 + Supabase + PayPal + Google Meet. AU customers, IN teachers." The live site is absent from the entire first page. The repo description is wrong on three counts: PayPal was replaced by Razorpay (PRs #13-17, migrations 0020/0021), "AU customers" was abandoned when the service-area gate was removed, and "Google Meet" is a phrase scrubRetiredCopy() actively strips from the live site at render. A second search combining the brand name with its differentiators returned zero results referencing the domain: no directory listings, no roundups, no press, no review-site entries. The only external identity signal in the site's own Organization JSON-LD is a single Instagram URL in `sameAs`.

**Recommendation.** Two actions, both same-day. (1) Make github.com/Shalom-P/yoga-website private, or at minimum strip the description and the homepage link. A public repo showing the payments schema, RLS policy names and the medical-documents bucket design is a security surface as well as a brand-SERP problem, and a health-adjacent buyer who finds a solo-dev repo instead of a company does not convert. (2) Build the entity footprint that does not exist: Google Business Profile, a LinkedIn company page, Crunchbase, and listings on the yoga-platform directories that already rank for the roundup terms. Then widen the `sameAs` array in the Organization JSON-LD from one Instagram URL to every profile created. Also add a Google Search Console verification: grep of app/layout.tsx and next.config.ts finds no `verification` key and no google-site-verification meta anywhere in the repo, which means nobody can see what any of this is doing.

### [HIGH] URL-architecture comparison: the target publishes 23 URLs against 613 / 417 / 380 / 176 / 163, and is the only site in the set with no scaling template at all

- **Verdict:** partially-correct | **Effort:** substantial | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/sitemap.xml, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/

**Evidence.** Verified counts by fetching every sitemap. myyogateacher.com 613 (241 /articles, 116 /yoga-teachers, 97 /group-classes, 84 /yoga-asana, 46 /types-of-yoga, 14 /articles/category, 3 /yoga-for-specific-goals, 2 /advisor, 2 /workshops, ~19 static). patanjaleeyoga.com 417 (222 posts, 114 pages incl. ~35 /online-yoga-classes-for-{condition}/ and 7 geo pages, 48 WooCommerce time-slot products, 19 categories, 11 product cats, 3 authors). shyambhai.yoga 380. mywowfit.com 176 (34 /trainers/*). 1om1.net 163 (73 blog posts, 62 products, 28 pages). myyogaclasses.fit 23: 1 home, 7 static, 3 legal, 3 /teachers/*, 9 /classes/*. Ratio to the leader: 26.7x. The target has zero instances of every template that scales in this vertical: no pose pages, no article hub, no style/type pages, no geo pages, no glossary, no comparison pages.

**Recommendation.** URL-architecture comparison: the target publishes 23 URLs against 752 / 613 / 417 / 181 / 176, and is the only site in the set with no scaling template at all.

Corrected evidence (all counts re-fetched 2026-09-16, counting every <loc> in every sub-sitemap):
- shyambhai.yoga 752 total (222 posts, 95 pages, 63 products, 246 product_tag, 95 post_tag, 16 product_cat, 15 category). Content URLs excluding taxonomy archives: 380. Note its sitemap is UA-gated: it returns 406 to a default curl UA and 200 to a browser UA, which is why a previous pass recorded it as unreadable.
- myyogateacher.com 613 (241 /articles, 116 /yoga-teachers, 97 /group-classes, 84 /yoga-asana, 46 /types-of-yoga, 3 /yoga-for-specific-goals, 2 /workshops, 2 /advisor, ~22 static).
- patanjaleeyoga.com 417 (222 posts, 114 pages, 48 WooCommerce products, 19 categories, 11 product cats, 3 authors).
- 1om1.net 181 (73 blog, 62 products, 28 pages, 17 collections, 1 discovery).
- mywowfit.com 176 (34 /trainers/*).
- myyogaclasses.fit 23 (1 home, 7 static, 3 legal, 3 /teachers/*, 9 /classes/*).
Ratio to the leader: 32.7x on raw counts, 16.5x against shyambhai's content-only 380. State which basis you are using; do not mix filtered and unfiltered counts across competitors.

Confirmed structural claim: /poses, /guides, /blog, /articles and /yoga-poses all 404. The only dynamic (marketing) routes in app/ are classes/[slug] and teachers/[slug]. There is genuinely no template that scales.

Corrected recommendation. Drop item (1), the title and schema fix: it adds zero URLs and belongs to the on-page finding. Then correct the central premise. The 107 pose entries in lib/data/condition-pages/*.json are NOT unpublished. They already render on the live condition pages under the H2 "The poses we focus on, and why", and there are only 97 distinct one-sentence descriptions among them. So:

(a) /poses hub, 1 new URL. Build it as a navigational index of the 55 unique poses linking into the condition page that already covers each one. Do not restate the existing descriptions on the hub, or you publish a near-duplicate of content already indexed on /classes/*. Its value is the internal link graph, which is real given the established finding that condition pages are dead ends, not new text.

(b) 15 pose pages, 15 new URLs. Treat these as new writing, not extraction. A one-sentence description cannot carry a standalone URL. Budget 600 to 900 words each of genuinely new content (contraindications, prop and chair variations, how it is cued in a 1:1 session, which conditions it suits), then cross-link each pose page to the condition pages that use it. Realistic cost is days of writing, not the implied near-zero.

(c) The 9 informational /guides/yoga-for-{x} split is the highest-risk item and should be sequenced last, not third. lib/data/condition-pages.ts lines 4-6 mark this copy "medically-reviewed copy - do not paraphrase here" with landing-pages/*.html as the source of truth. New condition guides mean new health claims under the UAE and India advertising constraints, so they need medical review before publishing. Also run a cannibalisation check: an informational guide sitting beside a commercial page targeting the same condition can split rather than add rankings.

(d) One /pricing/what-private-online-yoga-costs comparison page, 1 new URL. This one is genuinely low cost and low risk, and it is well supported by the established $60 to $120/hr US market rate versus this site's roughly $23 to $24 per session. Promote it above the pose pages on cost-per-URL.

Realistic outcome is 23 to about 48 indexable URLs, most of it new writing gated on medical review, not "mostly already done." Two cheap items not in the original list and worth adding: BreadcrumbList on the 9 condition pages, and FAQPage on them, which is currently absent despite the JSON carrying a faqs array and the page rendering an FAQ section.

### [HIGH] CORRECTION to the brief: the price point is ~$10 per session, not $23-24, and the leader charges $21, not $60-120

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/pricing, /Users/shalomp/YOGA_WEBSITE/supabase/migrations/0031_pack_pricing_update.sql, https://myyogateacher.com/pricing

**Evidence.** Live https://www.myyogaclasses.fit/pricing renders ₹999 / ₹4,499 / ₹7,999 for 1, 5 and 10 sessions, i.e. ₹999, ₹899.80 and ₹799.90 per 60-minute session, roughly $11.35 / $10.20 / $9.10. The $23-24 figure in the brief matches the pre-migration-0031 AED price (AED 435 for pack-5 = AED 87/session). /Users/shalomp/YOGA_WEBSITE/supabase/migrations/0031_pack_pricing_update.sql:41-49 re-priced AED to 5900 / 27500 / 49900 fils, i.e. AED 59 / AED 55 / AED 49.90 per session, roughly $16 / $15 / $13.60. Meanwhile the actual category leader charges $84/mo for 4 private sessions = $21.00 per session at list ($14.75 at the 3-month intro), not $60-120. The $60-120 range is the rate for independent US teachers (thumbtack.com/p/yoga-prices, lessons.com/costs/yoga-classes-cost), which is a different comparison set. 1om1.net's Service schema declares `"offers":{"@type":"AggregateOffer","priceCurrency":"USD","lowPrice":"68"}` with the "$10" in their title being a 7-day trial, not a session rate.

**Recommendation.** Fix the internal price narrative before it reaches any copy. Against the real competitor the honest claim is "half the price of the leading 1:1 platform, with no subscription and no auto-renew", not "a fifth of the US market rate". More urgently: ₹900/session shown to a US visitor is a positioning problem, not a bargain. It anchors a doctor-credentialed 60-minute session below what a US buyer reads as credible for clinical guidance. When USD/GBP/EUR are priced in /admin/plans per migration 0036, price the 5-pack at $16-19/session, not the rupee conversion. That still undercuts MYT's $21 by 10-25% while staying above the it-must-be-fake threshold, and it is the number the comparison page in the next finding will be built on.

### [HIGH] Teacher-page meta description is the raw 27-character headline field

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/[slug]/page.tsx, https://www.myyogaclasses.fit/teachers/dr-sangeeta

**Evidence.** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/[slug]/page.tsx:29 is `description: t?.headline ?? undefined`. Live result on /teachers/dr-sangeeta: `<meta name="description" content="Yoga and Naturopathy Doctor">`, 27 characters. Google will rewrite it. Compare myyogateacher.com/yoga-teachers/divya-1, which despite having 18 words of body HTML ships a composed 155-char description: "Book a live 1-on-1 yoga session with Divya, a certified Indian yoga teacher. Rated 4.9/5 from 1090+ students on MyYogaTeacher. Try your first session free."

**Recommendation.** Compose it at line 29: `description: \`Book a live 1:1 online yoga session with ${t.display_name}, ${t.headline}. 60-minute personalised sessions in your local time.\`` and clamp to 158 chars. Note the free-first-session hook MYT uses is off-limits here by project policy, so lean on the credential instead, which is the stronger differentiator anyway. While in this file, line 28's title `${t.display_name}: Yoga Teacher` should become `${t.display_name}: Doctor-Credentialed Yoga Teacher` for the three current teachers, all of whom hold the qualification.

### [HIGH] Content gap: 20+ condition pages both WordPress competitors publish that the target does not, several of which decompose from existing pages

- **Verdict:** unverified | **Effort:** substantial | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/classes, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/pain-relief.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/hormonal-health.json

**Evidence.** Present on patanjaleeyoga.com AND shyambhai.yoga but absent from myyogaclasses.fit: back-pain, neck-pain, knee-pain, shoulder-pain (the target folds all four into one /classes/pain-relief), migraine, sinus, asthma, hernia, digestion, irritable-bowel-syndrome, insomnia / better-sleep, menopause, PCOS-PCOD (target folds into /classes/hormonal-health), fertility, stress (separate from anxiety), urinary-stress-incontinence, glaucoma, work-life-balance, flexibility, first/second/third-trimester prenatal splits (patanjalee has three separate trimester pages), post-natal. myyogateacher.com adds: arthritis, sciatica, depression, thyroid. Additional templates absent from the target entirely: /types-of-yoga/* (46 URLs at MYT covering hatha, vinyasa, yin, restorative, kundalini, pranayama, yoga-nidra, yoga-therapy, private-yoga), article hub (241 at MYT), geo pages (patanjalee has /online-yoga-classes-{usa,uk,hyderabad,chennai,bengaluru,trivandrum,telangana}/; shyambhai has {pune,kolkata,gurgaon,delhi,mumbai,ahmedabad}), and a timezone page (patanjalee /time-zones/, shyambhai /global-calendar-yoga-classes-online/).

**Recommendation.** Prioritised by cost given what exists. Cheapest first: split /classes/pain-relief into /classes/back-pain, /classes/neck-pain and /classes/knee-pain, reusing the 13 pose entries already in pain-relief.json and the existing ConditionLanding component. Then split /classes/hormonal-health into /classes/pcos and /classes/menopause (11 pose entries already written, and PCOS is the single highest-intent term on that list). Then split /classes/prenatal by trimester, following patanjalee's three-page pattern. Then add sciatica, insomnia and thyroid as net-new. Do NOT build geo pages: /online-yoga-classes-usa/ style pages are the weakest thing patanjalee publishes (1,254 words, duplicate H1, no local signal behind it) and they conflict with the worldwide Organization framing already in the JSON-LD. DO build the timezone page, see the next finding.

### [HIGH] The cross-timezone story is the target's best-engineered feature and has no page, while two competitors already rank pages on it

- **Verdict:** unverified | **Effort:** moderate | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/faq, /Users/shalomp/YOGA_WEBSITE/lib/timezone/index.ts, https://patanjaleeyoga.com/time-zones/

**Evidence.** Competitors publish patanjaleeyoga.com/time-zones/ and shyambhai.yoga/global-calendar-yoga-classes-online/. myyogateacher.com covers it only as a homepage bullet ("Available 24x7, Live via Zoom"). The target has no such URL in its 23-page sitemap, despite the repo containing the deepest implementation in the set: lib/timezone/index.ts with formatCustomerTime / formatTeacherTime, device-detected IANA zones stored per customer, slotInsideAvailability() normalising Postgres day_of_week against date-fns, and the Asia/Calcutta ICU-alias fix. The homepage already says "Choose a slot from live availability, shown in your local time" and "Today · 7:00 PM your time", so the product truth is there; only the page is missing.

**Recommendation.** Publish /online-yoga-in-your-timezone as a 1,200-word page that answers the actual query a US, UK, EU or Gulf buyer has: "my teacher is in India, what time will my class be?". Include a static table of India Standard Time against New York, Chicago, Los Angeles, London, Berlin, Dubai, Singapore and Sydney for both halves of the year, since IST has no DST and the counterpart zones do, which is the specific confusion nobody has written up. Render it server-side from a constant table so it stays inside ISR: do not call cookies() or read a request header for this, which would kill ISR for the entire (marketing) group. Link it from every /classes/* page and from /faq, where the question "How does the time-zone thing work?" already exists with a short answer.

### [HIGH] SERP feature ownership: providers hold almost nothing. Publishers hold the informational SERPs and the commercial-investigation SERP has no student-side page at all

- **Verdict:** unverified | **Effort:** moderate | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/pricing, https://1om1.net/blogs/private-yoga-blog/best-5-online-private-yoga-platforms

**Evidence.** Sampled SERPs. "yoga for hypertension poses online class": yogajournal.com holds position 1, myyogateacher.com/articles/yoga-for-hypertension position 2, then shvasa.com, yogauonline.com (two results), womenshealthnetwork.com, gulfnews.com. Publishers own the snippet and PAA space; MYT is the only provider present. "online yoga for diabetes 1:1 personalized class": myyogateacher.com/articles/yoga-for-diabetics, mvdiabetes.com, patanjaleeyoga.com/online-yoga-classes-for-diabetes/, omyogainternational.com, patanjaleeyoga.com/product/personalized-yoga-class-11/, yogamantraonline.com, shyambhai.yoga/online-yoga-classes-for-diabetes/, shyambhai.yoga/yoga-for-diabetes/. Note patanjalee and shyambhai each take two slots by running a commercial page and an informational page on the same term. "how much do private yoga lessons cost per hour online": gymdesk.com, thumbtack.com, lessons.com, offeringtree.com, brettlarkin.com, yogaunion.com, siddhiyoga.com, theconnectedyogateacher.com, airbnb.com/services. Every single one is written for teachers pricing their own classes or is a local-services aggregator. There is no buyer-side page. "best online 1-on-1 yoga platforms 2026": happytrainers.com, 1om1.net (two self-published roundups), healthynexercise.com, yogaia.com/blog/best-online-yoga-classes.

**Recommendation.** Three distinct plays, not one. (1) Informational condition SERPs: do not chase Yoga Journal head terms. Go long-tail and clinical, where the doctor credential is the differentiator: "yoga poses to avoid with high blood pressure", "is kapalbhati safe with hypertension" (the diabetes JSON already contains exactly this caveat), "yoga after gestational diabetes". (2) The cost SERP is the single best opportunity found in this audit: build /guides/what-private-online-yoga-costs as a genuine buyer-side comparison naming real numbers, MyYogaTeacher $84/mo for 4 sessions = $21/session subscription with no refunds, ONE OM ONE $68 entry, US independent teachers $50-120/hr per Thumbtack and Lessons.com, and the target's own pack price. No competitor will write this because every one of them is the expensive option. (3) The roundup SERP is an outreach target, not a ranking target: pitch happytrainers.com and healthynexercise.com for inclusion, and note that 1om1.net self-publishes the roundups it appears in, which is a tactic worth copying only on a separate property.

### [HIGH] Backlink and authority signals: myyogateacher has run real digital PR, the target has run none

- **Verdict:** unverified | **Effort:** substantial | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/reviews, https://myyogateacher.com/press-media

**Evidence.** Observable without a backlink tool. myyogateacher.com runs a press logo bar on the homepage naming Men's Health, Woman's World, Well+Good, Women's Health, LA Yoga and Yahoo Life, maintains /press-media, /video-testimonials, /careers, /life-at-myyogateacher (including /life-at-myyogateacher/hackathon-waynad-2024) and /friends-and-family-of-mYT, has 14 /articles/category/* taxonomy hubs, publishes /articles/myyogateacher-reviews to own its own brand-review SERP, carries app-store social proof (4.9 from 1,010 Apple reviews, 4.7 from 596 Google Play reviews), and its robots.txt disallows /producthunt/thank-you.html, evidence of a Product Hunt launch. Third-party coverage exists at healthynexercise.com/best-yoga-classes/myyogateacher-review/ and in 1om1's and happytrainers' roundups. patanjaleeyoga.com runs /testimonials/ and a retreat programme across Mumbai, Goa, Rishikesh, Bangalore and Govardhan, which is offline PR that generates links. 1om1.net self-publishes 73 blog posts including two "best platforms" roundups it appears in, and ships a /sitemap_agentic_discovery.xml pointing at /agents.md, an early AI-crawler play. The target has: 12 reviews on /reviews with only Organization schema, one Instagram link, and no external citation found in any search run.

**Recommendation.** The cheapest credible links for this specific business are credential-led, not content-led. (1) The three teachers hold real clinical degrees: get them listed on their awarding institutions' alumni pages and on Indian yoga-therapy professional bodies, each of which is a topically relevant .edu-adjacent or .org link no competitor has. (2) Pitch the one story nobody else can tell: a licensed yoga-and-naturopathy physician's view on a specific clinical question, offered to the health desks that already cover this beat (gulfnews.com ranks in the hypertension SERP sampled above and is a natural first target given the AED market). (3) Get listed in the roundups that already rank, happytrainers.com and healthynexercise.com. (4) Publish /reviews with real, attributable reviews and drop the homepage "4.9 · 1,200+ reviews" claim until it is true, since an unverifiable count is both a trust liability and an ASA/UAE advertising risk. Expect 6-12 months before any of this moves rankings.

### [HIGH] Realistic timeline and the fastest defensible wedge

- **Verdict:** unverified | **Effort:** substantial | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/, https://myyogateacher.com/

**Evidence.** Inputs to the estimate, all measured above: 23 indexable URLs against 613 for the leader; zero observable external citations; no Search Console verification in the codebase; a .fit TLD with no prior authority; a brand SERP currently won by a GitHub repo; 3 teacher pages against 116; and a checkout that renders ₹ to every market on earth. Against that, real assets: 9 condition pages of 978 words each that are better written and more medically careful than anything patanjalee or shyambhai publish, 107 pose entries covering 55 unique asanas, three genuinely clinically credentialed teachers, a one-time no-expiry pack model against a leader that auto-renews and refuses refunds in writing, and a technical stack (prerendered ISR, valid schema, full CSP and HSTS) that is better executed than every competitor sampled.

**Recommendation.** Honest timeline. Months 0-3: no meaningful ranking movement is available, and nothing else matters until USD/GBP/EUR are priced and GSC is verified, because traffic into a rupee checkout is wasted spend. Months 3-6: long-tail condition and pose queries begin to place, 20-100 organic sessions per month, mostly from the retitled condition pages and the pose hub. Months 6-12: the condition cluster competes with patanjalee and shyambhai on specific conditions (they are beatable: thin, duplicate-H1, uncited), while myyogateacher's 241-article hub stays out of reach on head terms. Months 12-24: head terms become contestable only with sustained link acquisition. The fastest defensible wedge, in order: (1) doctor-credentialed clinical yoga, because it is true, verifiable, expensive for competitors to fake, and completely unclaimed. Every competitor says "certified Indian teachers"; none says "your teacher holds a clinical degree". (2) The buyer-side cost comparison page, because the entire SERP for it is currently written by and for teachers, and the target is the only participant with an incentive to publish real numbers. (3) The cross-timezone page, because the engineering behind it is already the best in the set. Pair all three with the no-subscription, never-expires, refundable contrast against a leader who prints "we do not offer any refunds" on its own pricing page. Do not chase MYT's 613 URLs and do not chase geo pages.

### [MEDIUM] CORRECTION: shyambhai.yoga's sitemap is readable. It is 380 URLs and it is a near-clone of patanjaleeyoga.com's architecture

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** medium
- **Locations:** https://shyambhai.yoga/sitemap.xml, https://patanjaleeyoga.com/sitemap_index.xml

**Evidence.** https://shyambhai.yoga/robots.txt declares two sitemaps; https://shyambhai.yoga/sitemap.xml is an All-in-One-SEO index with CDATA-wrapped <loc> values (which is why a naive grep missed it). Counts: post-sitemap 222, page-sitemap 95, product-sitemap 63 = 380 URLs. The page list is slug-for-slug the same as patanjaleeyoga.com: /online-yoga-classes-for-{diabetes,hypertension,back-pain,neck-pain,knee-pain,shoulder-pain,migraine,sinus,asthma,hernia,digestion,irritable-bowel-syndrome,menopause,women,glaucoma,eye-blinking,sneezing,urinary-stress-incontinence,central-serous-retinopathy,work-life-balance,flexibility,weight-loss}, plus /yoga-volunteer-course/ and /online-pregnancy-yoga-with-garbh-sanskar-classes/ on both. patanjaleeyoga.com's own meta description reads "Patanjalee Shyambhai Yoga provides expert online yoga classes..." These are one operation running two domains on the same template.

**Recommendation.** CORRECTED FINDING: shyambhai.yoga's sitemap IS readable and declares 752 URLs, not 380. It is the SAME OPERATOR as patanjaleeyoga.com but NOT a content clone.

Corrected evidence:
- The sub-sitemaps 406 on a short user agent and 200 on a full Chrome UA. That, not CDATA, is why an earlier pass read it as unreachable.
- shyambhai declares 752 URLs across seven children (post 222, page 95, product 63, category 15, post_tag 95, product_cat 16, product_tag 246). patanjalee declares 417 (post 222, page 114, product 48, category 19, product_cat 11, author 3). Combined declared footprint is 1,169 URLs, or 764 excluding taxonomy. The "797" figure mixed one site's full index with the other's content subset.
- Shared architecture is limited to a 42-page marketing shell (44 percent of shyam's pages, 37 percent of pat's). 18 of 22 condition slugs match exactly; neck-pain, migraine and sinus differ by the "for-" segment and glaucoma differs by a "-uncontrolled" suffix.
- The pages are NOT duplicates. /online-yoga-classes-for-diabetes/ measures 985 vs 1,618 words with a 0.010 text-similarity ratio. Blog URL overlap is 1 of 222. Product overlap is 0 of 63/48. Different CMS plugins and different hosts.

Corrected severity: medium, but as COMPETITOR INTEL that redirects strategy, not as a defect. Nothing on myyogaclasses.fit changes because of it.

Corrected recommendation. Drop both claimed weaknesses. The duplicate-H1 angle is worthless (it is confined to two Elementor geo pages and multiple H1s are not a ranking factor). The "no multi-currency" angle is factually backwards: patanjalee's WooCommerce store already transacts in USD and ships /online-yoga-classes-usa/, /online-yoga-classes-uk/ and a 3,086-word /time-zones/ page. They are ahead of the target on global currency and timezone surface area, not behind, and the target currently offers only INR and AED because 0036's USD/GBP/EUR rows are unpriced and effectiveCurrency() downgrades them.

What to do instead, in priority order:
1. Treat the pair as one operator with two independent content estates (1,169 declared URLs). Do not model them as two rivals and do not model them as one duplicate.
2. Price the USD, GBP and EUR plan_prices rows so effectiveCurrency() stops downgrading to INR. This closes a real gap against a competitor that already charges in USD. Follow the no-cross-currency-fallback rule: add explicit plan_prices rows per active plan, never lean on plans.price_base_cents.
3. Build a /timezones page. patanjalee ranks a 3,086-word one and the target's cross-timezone story (customers worldwide, teachers in India, 60-minute live 1:1) is stronger but currently invisible. This is an ISR-safe static marketing route.
4. Lead the credential axis, but frame it as specificity, not absence. patanjalee claims Dr./Ph.D/YCB too. The target's differentiator is a named MD in Clinical Yoga and Naturopathy (Dr Vaishnavi Mayya) and Medical Yogic Sciences (Dr Hima Bindu) attached to individual teacher pages with Person JSON-LD, versus an institute-level therapist claim. Surface the certifications jsonb column (lib/db/schema.ts:88) into the Person schema as hasCredential.
5. Lead the pricing axis on commitment, not on price. patanjalee sells 1, 2, 3, 5 and 12-month durations (1:1 at Rs 8999 per month up to Rs 33999). The target's prepaid session packs never expire into a recurring charge. Say "prepaid 1:1 sessions, no monthly plan" and never the word credits. No free-trial wording, no em-dashes.
6. The out-publishing judgement stands but for a different reason: the volume is 1,169 URLs across two estates with near-zero internal overlap, so there is no duplicate-content self-harm to exploit. Compete on the 9 existing condition pages plus the 107 unpublished pose entries in lib/data/condition-pages/*.json, not on page count.

### [MEDIUM] CORRECTION: the 107 pose entries are 55 unique poses across 35 groups, and each entry is one sentence. They are a hub skeleton, not 40-80 ready-to-publish pages

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/diabetes.json, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/

**Evidence.** Parsing all 9 files in /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/: 107 total pose entries, 35 poseGroups (first-pass said 36), but only 55 distinct Sanskrit names. 17 poses appear in 2+ conditions: Shavasana x8, Bhramari x7, Yoga Nidra x7, Nadi Shodhana x6, Marjaryasana-Bitilasana x6, Tadasana x5, Balasana x5, Setu Bandhasana x4. Each entry is `{sa, en, desc}` where desc is one sentence, e.g. Surya Namaskar: "A flowing sequence, paced to you, that warms the whole body and gets you moving. A chair version is always available." That is ~25 words. myyogateacher.com/yoga-asana/bhujangasana is 2,325 words with Article + FAQPage + BreadcrumbList + ImageObject + Person schema. Publishing 55 x 80-word pages against that would read as doorway pages.

**Recommendation.** CORRECTED FINDING (severity: medium)

Title: The 107 pose entries are 55 unique poses across 35 groups, they are ALREADY LIVE on the 9 condition pages, and the whole corpus is 1,070 words. Do not fan them out into 55 pages.

Corrected evidence:
- 107 entries / 35 poseGroups / 55 distinct Sanskrit names / 17 in 2+ conditions. Confirmed. First-pass "36 poseGroups" was wrong; it is 35.
- Descriptions average 10.0 words (median 10, min 2, max 21). All 107 descriptions total 1,070 words. The quoted Surya Namaskar entry (22 words) is the longest in the corpus, not typical.
- CORRECTION TO FIRST-PASS ITEM 4: the pose data is NOT unpublished. ConditionLanding.tsx:142-165 renders it, and the live HTML of /classes/diabetes contains the Sanskrit names. Any hub reusing these strings duplicates live on-site text.
- CORRECTION TO THIS FINDING: no internal link points at any pose today. ConditionLanding.tsx:151 renders `{p.sa}` inside a plain `<div>`, not an anchor.
- Competitor benchmark confirmed: myyogateacher.com/yoga-asana/bhujangasana = 2,325 visible words, Article + FAQPage + BreadcrumbList + ImageObject + Person across 3 ld+json blocks.

Corrected recommendation, in dependency order:

STEP 1 (prerequisite the original omitted). Linkify the pose cards in place. In ConditionLanding.tsx:151, wrap `{p.sa}` in `<Link href={"/poses#" + slugify(p.sa)}>`. This is what actually creates the 107 outbound links and the 2-8 inbound links per multi-condition pose. Without it, steps 2 and 3 produce an orphan.

STEP 2. Ship one static /poses hub in the (marketing) group, no cookies(), alphabetised by Sanskrit name, `id` anchor per pose. For each of the 55: Sanskrit name, English name, and a SINGLE newly-written 20-30 word description, not a copy of a condition-page string. Writing fresh text is required, not optional, because 14 of the 17 multi-condition poses have 2-5 different existing descriptions and reusing one duplicates live text. Under each pose, a "Practised in" row linking to every /classes/* page that includes it (107 links, 9 destinations). Add `${BASE_URL}/poses` to STATIC_ROUTES in app/sitemap.ts.

STEP 3 (separate fix, which the hub does NOT deliver). The leaf-to-leaf dead end on the 9 condition pages needs its own treatment: a "Related conditions" block on each /classes/{slug} linking to 3-4 siblings. A hub page cannot substitute for this.

STEP 4. Only after steps 1-3 are live and /poses is being crawled, expand the 17 multi-condition poses into /poses/{slug} pages of 900-1,200 words each, with generateStaticParams plus a sitemap loop. Justify the 17 by frequency in the corpus and by the inbound links step 1 created, not by links that exist "by construction" (they do not). Each page needs Article + BreadcrumbList JSON-LD via lib/seo/structuredData.ts. The remaining 38 stay as hub anchors.

Keep all new copy em-dash free and free-trial free, and use "prepaid 1:1 sessions" in any CTA.

### [MEDIUM] Condition pages emit exactly zero contextual outbound links; the direct competitor emits 86 on the same topic

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/classes/diabetes, /Users/shalomp/YOGA_WEBSITE/components/marketing/condition/ConditionLanding.tsx

**Evidence.** Every internal href on https://www.myyogaclasses.fit/classes/diabetes, counted: /login?next=/dashboard/book x3, /teachers x2, /reviews x2, /pricing x2, /faq x2, /classes x2, /about x2, / x2, /login, /contact, /legal/{terms,refund,privacy}, plus icons and font preloads. That is 15 unique URLs and every one is header, footer or CTA chrome. Zero links to the 8 sibling conditions. Zero links to any of the 3 teachers. https://patanjaleeyoga.com/online-yoga-classes-for-diabetes/ has 86 unique internal links; https://shyambhai.yoga/online-yoga-classes-for-diabetes/ has 81. Inbound linking is fine (home and /classes each link to all 9 leaves), so this is specifically a leaf-to-leaf and leaf-to-teacher failure.

**Recommendation.** CORRECTED FINDING

Title: Condition pages are internal-linking dead ends: zero page-to-page links in the body, including zero to the 8 sibling conditions and zero to the 3 teachers.

Corrected evidence: In the body region of https://www.myyogaclasses.fit/classes/diabetes there are exactly 2 anchors, a "/login?next=/dashboard/book" CTA and a "#how-it-helps" jump. All 13 unique internal page URLs on the page are header or footer chrome. ConditionLanding.tsx contains no other Link, and app/(marketing)/classes/[slug]/page.tsx never fetches the teacher roster, so the component has no data to link with.

Corrected competitor comparison: Do NOT cite 86 and 81. Those are mega-menu and footer chrome (I verified every anchor text: city pages, teacher-training tiers, cart, privacy policy). Counting the same way on both sides, patanjaleeyoga.com's diabetes page has 5 in-body internal links, only 2 of which are contextual page-to-page (/online-yoga-classes/ and /online-yoga-classes-for-knee-pain/). The honest competitive statement is: competitors surface roughly 45 condition pages from every page through a mega-menu because they have roughly 45 such pages, while this site has 9 and surfaces only the /classes hub. That is a content-breadth gap, not a linking gap, and it belongs in the "23 indexable URLs" finding.

Corrected severity: medium, not critical. All 9 leaves are reachable from / and /classes and are in the sitemap, so there is no discovery or indexation risk, and link-equity flow on a 23-URL site is near-noise. The genuine upside is topical clustering plus a conversion path (condition page to teacher profile to book) that does not exist today. Cheap to fix, but not critical.

Corrected recommendation (two blocks in components/marketing/condition/ConditionLanding.tsx, both driven by props passed from app/(marketing)/classes/[slug]/page.tsx):

1. "Related conditions" row. Hard-code a slug adjacency map in lib/data/condition-pages/index.ts, exported alongside getConditionPage, and render 3 links per page to /classes/{slug} using the existing class_categories name. Suggested map: diabetes -> hypertension, weight-loss, hormonal-health; hypertension -> diabetes, mental-health, geriatric; weight-loss -> diabetes, hormonal-health, hypertension; prenatal -> hormonal-health, pain-relief, mental-health; hormonal-health -> prenatal, weight-loss, mental-health; pain-relief -> geriatric, prenatal, hypertension; geriatric -> pain-relief, hypertension, mental-health; mental-health -> hormonal-health, hypertension, pain-relief; kids-yoga -> mental-health, pain-relief, weight-loss. Needs no new data source.

2. "Practise this 1:1 with" row. Do NOT filter by the `specialties` array: those are free-text strings ("Clinical Yoga", "Cardiovascular Health", "Posture Correction") that match none of the 9 slugs, so a filter would render an empty block on most pages. With only 3 active teachers, link all of them, or drive it from the same hard-coded map keyed on teacher slug (diabetes/hypertension/weight-loss -> dr-vaishnavi-mayya; prenatal/hormonal-health -> dr-sangeeta; pain-relief/geriatric/mental-health -> dr-hima-bindu) with the other two shown as "also available". Fetch with getAllActiveTeachers() in page.tsx, which uses createSupabaseAnonClient() and therefore preserves ISR at revalidate=300; pass the array as a prop because ConditionLanding is "use client".

Realistic outcome: about 6 to 8 contextual outbound links per condition page (3 conditions + 3 teachers + a pose hub if that ships), not "roughly 20". Keep the section copy free of em-dashes and of any free-trial or "no credit card" phrasing.

Also worth adding while editing this route: BreadcrumbList JSON-LD on /classes/[slug], which is genuinely missing and is a cheaper win than the link blocks.

### [MEDIUM] CORRECTION: per-page depth is NOT better than competitors on the pages that matter. The flagship condition page is half the length of the direct competitor's

- **Verdict:** partially-correct | **Effort:** substantial | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/classes/diabetes, https://patanjaleeyoga.com/online-yoga-classes-for-diabetes/

**Evidence.** Word counts from live HTML, scripts and styles stripped: myyogaclasses.fit/classes/diabetes 978. patanjaleeyoga.com/online-yoga-classes-for-diabetes/ 1,994. myyogateacher.com/articles/yoga-for-diabetics 2,110. myyogateacher.com/yoga-asana/bhujangasana 2,325. myyogateacher.com/yoga-for-specific-goals/yoga-for-back-pain 1,317. shyambhai.yoga/ homepage 4,144; patanjaleeyoga.com/ homepage 4,490; myyogaclasses.fit/ homepage 769. Thinner still: /teachers 180 words, /teachers/dr-sangeeta 171, /reviews 280, /pricing 330. The first-pass claim that per-page depth beats competitors is true only against the shells (MYT /pricing 20 words, MYT teacher pages 18 words), not against the pages actually ranking for the target's own keywords.

**Recommendation.** CORRECTED FINDING (severity: medium, dimension: competitor)

Title: The flagship condition page is about half the length of the pages ranking for its own keywords, and it is a linking dead end. Depth is a real gap, but it is second to linking and titles.

Corrected evidence: Visible word counts, fetched live and stripped of script/style/svg/head: myyogaclasses.fit/classes/diabetes 961. patanjaleeyoga.com/online-yoga-classes-for-diabetes/ 1,902. myyogateacher.com/articles/yoga-for-diabetics 2,055. Homepages: myyogaclasses.fit 716 vs shyambhai.yoga 4,054 and patanjaleeyoga.com 4,344. The first-pass claim that per-page depth beats competitors was measured against client-rendered shells (myyogateacher.com/pricing and /yoga-teachers return zero server-rendered words to curl, which is a measurement artifact, not thin content), so that claim should be withdrawn. Separately, the 107 pose entries in lib/data/condition-pages/*.json are already live: "Mandukasana", "Ardha Matsyendrasana" and "Setu Bandhasana" all appear in the live HTML. diabetes.json holds 1,009 words of string content and the page renders 961, so there is no unpublished reserve.

Corrected recommendation, in cost order:

1. FIRST, fix the two things that cost minutes, not days. The title is "Diabetes · My Yoga Classes" and carries no keyword. In app/(marketing)/classes/[slug]/page.tsx:32, generateMetadata returns title: c?.name. Return a condition-specific title instead, sourced from a new titleTag field in each condition JSON, for example "Yoga for Diabetes: Gentle 1:1 Sessions Online". The layout template appends " · My Yoga Classes" (18 chars), so keep the field under 42 characters. And there is exactly one internal link into /classes/diabetes sitewide. Cross-link the nine condition pages to each other and from /teachers/[slug] (each teacher to the conditions they cover) before writing a single new word of body copy.

2. Then add depth, but drop the word-count target. Do not aim at 1,600 to 1,800 words. Word count is not a ranking factor. Aim at query coverage. Two sections, both new keys in lib/data/condition-pages/*.json rendered by ConditionLanding.tsx:

   a) "Poses to approach carefully, and why." This is the strongest of the three original suggestions and is explicitly permitted: migration 0024 states "Practice-SAFETY is intentionally preserved ... no breath-holding, sugar source nearby, doctor/midwife go-ahead ... are safety guidance, not medical disclaimers." Frame as practice adaptation, not medical instruction. Sample safe phrasing: "Deep forward folds are usually eased off if you have retinopathy. Your teacher will offer a supported version instead." No em-dashes.

   b) "What your first four weeks look like," a week-by-week block. Pure process copy, zero claim risk, and it answers the "how does an online 1:1 actually work" query that neither competitor covers well.

3. DROP the clinical-trial and PubMed-citation section entirely. It collides with supabase/migrations/0024_category_copy_positive.sql, which records a completed UAE DHA/MOH and India ASCI / Drugs and Magic Remedies Act compliance pass and states the copy must NEVER imply the yoga cures, treats, reverses, controls or lowers a disease or symptom. Diabetes is a scheduled condition under that Act and the teachers are India-based. The competitors that outrank this site cite nothing, so the citations are not the ranking mechanism. If an evidence angle is wanted later, it needs legal review first, not an SEO ticket.

4. Recognise the asymmetry and do not chase it. MYT's ranking title is "7 Yoga Poses for Diabetes: Asanas for Blood Sugar Control." That claim language is unavailable to this advertiser. Compete on what is defensible instead: clinician-led teachers, genuine 1:1 rather than group, and cross-timezone availability, none of which the competitors' long pages actually cover.

### [MEDIUM] Positioning gap: every competitor claims 'Indian teachers'. Nobody claims 'your teacher is a doctor'. That is the unclaimed territory

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/teachers, https://myyogateacher.com/, https://myyogateacher.com/advisor/dr-loren-fishman

**Evidence.** Verbatim competitor positioning. myyogateacher.com H1: "Online Yoga Classes with Expert Indian Teachers - Live!" and mid-page: "Yoga began in India – now it begins with you" / "Learn live from certified Indian teachers who make every class supportive, simple, and personal" / "200+ expert Indian teachers" / "Authentic, experienced teachers, rooted in yoga's original traditions, to provide guidance you can trust". shyambhai.yoga title: "Best Online Yoga Classes From India | Shyambhai Yoga". 1om1.net title: "1-on-1 Online Private Yoga from Only $10 - ONE OM ONE", Service schema `areaServed: "US"`. So 'Indian teachers' is saturated and 'cheap' is claimed. MYT's credential language is unsystematised marketing copy on individual cards: "Zaeem, Fitness teacher with a PHD in yoga", "Sujit, Masters in Yoga", "Dr. Kaviya, Therapeutic Yoga Teacher". Their only real medical asset is /advisor/dr-loren-fishman, an external MD advisor, and that page ships the title "MyYogaTeacher Articles" (broken template) with no schema and 363 words. Meanwhile the target's entire 3-person roster is clinically credentialed and says so on the homepage: "Dr Vaishnavi Mayya, MD in Clinical Yoga & Naturopathy" / "Dr Sangeeta, Yoga and Naturopathy Doctor" / "Dr Hima Bindu, Medical Yogic Sciences · 8 years".

**Recommendation.** CORRECTED FINDING (severity: medium, not critical)

Title: The site buries its one real differentiator. All three teachers hold Indian clinical yoga degrees, but /teachers markets them as "200-hr Yoga Alliance certified", which is the exact commodity claim myyogateacher.com owns at scale.

Corrected evidence claim: within the named competitor set (myyogateacher.com, shyambhai.yoga, 1om1.net) the credential axis is unclaimed, and all the quoted competitor strings reproduce exactly. Do NOT claim it is unclaimed globally: yogawithdoctor.com, doctoratoosa.com/yoga-therapy, yogamedicine.com and the C-IAYT yoga-therapist field already occupy "medically credentialed yoga" in English search. The defensible framing is narrower and still valuable: nobody in the low-cost India-to-world 1:1 category pairs Indian teachers with clinical degrees.

CORRECTED RECOMMENDATION

(a) Fix the self-dilution first. This is a 15-minute change and it is the highest-value item, not the new page. In app/(marketing)/teachers/page.tsx:
  - line 8: title "Teachers" becomes "Clinically Trained Yoga Teachers for 1:1 Online Sessions"
  - line 10: replace "Every one is Yoga Alliance trained" with the actual roster fact, e.g. "Our teachers hold Indian clinical degrees in yoga and naturopathy, and teach live 1:1 sessions to students worldwide."
  - line 21: replace the "at least 200-hr Yoga Alliance certified" subhead. Leading with the floor credential when the roster exceeds it is pure downside. State the degree instead.
  - H1: keep a human line but name the qualification in it, for example "Your teacher trained in a clinic, not just a studio."

(b) In app/(marketing)/teachers/[slug]/page.tsx:29, the title template "{name}: Yoga Teacher" throws away the credential already sitting in t.headline. Use the headline: "Dr Vaishnavi Mayya, MD in Clinical Yoga and Naturopathy". Note headline and certifications are DB-driven (teachers table, migration 0002), so the template must read them, not hardcode strings.

(c) In lib/seo/structuredData.ts:42, `jobTitle: "Yoga Teacher"` is hardcoded across all three doctors. Derive jobTitle from t.headline and add hasCredential as an EducationalOccupationalCredential (credentialCategory "degree", educationalLevel the actual degree, recognizedBy the issuing university where known, sourced from the existing `certifications jsonb` column). Caveat this honestly in the audit: hasCredential produces no rich result. It is an entity-disambiguation signal, worth doing because it is three lines, not because it wins a SERP feature.

(d) Re-scope the new page away from a zero-demand head term. Do not title it "doctor-led yoga therapy". Build /about/our-teachers-training (or similar) targeting the questions people actually search: what a BNYS or MD in Yoga and Naturopathy is, how a 5.5-year clinical degree compares with a 200-hour teacher certificate, and what changes in a session for someone managing diabetes or hypertension. Interlink it from all nine /classes/* condition pages, which fixes the dead-end problem in the established audit at the same time. Add it to sitemap.ts.

(e) Wording guardrail, stated more strictly than the original. For US, UK and EU visitors "doctor" in a health-service context implies a licensed physician, which an Indian MD (Y&N) or BNYS holder is not in those jurisdictions. Prefer "clinically trained", "clinical yoga degree" or the literal degree name over "doctor-led", and never pair it with "therapy" or "treatment". Keep the existing "practised alongside your medical care" frame, which is correct as written.

### [MEDIUM] Second unclaimed position: myyogateacher is a subscription that auto-renews and explicitly refuses refunds, twice, on its own pricing page. Nobody is attacking that

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/pricing, https://myyogateacher.com/pricing

**Evidence.** myyogateacher.com/pricing rendered: "4 Private Sessions / Every month / $84 / $59/mo / Billed every 3 months - change / $177 for first 3 months then $252 every 3 months". FAQ verbatim: "Yes, your membership will auto-renew based on the plan you choose... Your credit card will be charged automatically at the start of each billing cycle" and, twice, "we do not offer any refunds" / "We do not offer refunds. However, you can cancel at any time". Also "All prices are in US Dollars" (single currency, no selector). The target's live /pricing says the opposite on every axis: "Buy a one-time pack of 1:1 sessions, no subscription, and your sessions never expire", "Session never expires", plus a published /legal/refund page. This contrast is absent from the target's titles, meta descriptions and JSON-LD; it exists only as body copy a searcher never sees in a SERP.

**Recommendation.** Keep the core action, fix the evidence, severity and copy.

Corrected finding (severity: medium): /pricing's SERP surface is wasted. Its title is "Pricing · My Yoga Classes" (25 rendered chars) and its description leads with "Honest yoga pricing in AED and INR", which tells a US, UK or EU searcher the service is not for them. Both are hardcoded in app/(marketing)/pricing/page.tsx:11-13 and ship without an admin edit. Drop the claim that the no-subscription contrast is missing from JSON-LD: it is already live on /pricing as FAQPage entities from lib/data/faqs.ts ("How does paying work: is there a subscription?" and "What's your refund policy?"). It simply cannot surface, because FAQPage rich results have been restricted to government and health sites since Aug 2023.

Corrected recommendation:

1. Title (accounts for the `"%s · My Yoga Classes"` template at app/layout.tsx:66):
   title: "1:1 Online Yoga Pricing, No Subscription"
   Renders as 58 chars including the brand suffix, so nothing truncates.

2. Description, with the credential claim removed:
   "Buy a one-time pack of 60-minute 1:1 yoga sessions, taught live online. No subscription, no auto-renew, and your sessions never expire."
   135 chars, no em-dash, no free-trial or "no credit card" wording, no "credits", no currency promise the page cannot keep.

3. Do not write "doctor-credentialed teacher" into a code-level meta description. It reads as allopathic licensure to a Western searcher, contradicts the repo's deliberate "your doctor, not our teacher" health-claim framing, and hardcodes a claim about DB-driven `teachers` rows. If the credential is worth surfacing, do it on /teachers/[slug] in the existing Person JSON-LD via `hasCredential`, where it tracks the DB.

4. The real schema gap on /pricing is Product/AggregateOffer, not the FAQ. Add one Product node with three Offer children (pack-1, pack-5, pack-10), `priceCurrency` taken from `effectiveCurrency()` so it never emits an unpriced currency, and `"availability": "https://schema.org/InStock"`. Unlike FAQPage, merchant/offer markup is still eligible.

5. Separate, larger item this finding is a symptom of: 0036_international_currencies.sql deliberately inserts no USD/GBP/EUR rows, so `effectiveCurrency()` downgrades every non-IN, non-AE visitor to ₹. Until an admin prices at least one pack in USD at /admin/plans, no meta-description wording makes /pricing convert globally.

### [MEDIUM] Technical comparison, honest scorecard: the target wins on delivery and security and loses on discovery surfaces

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/layout.tsx, /Users/shalomp/YOGA_WEBSITE/next.config.ts, https://www.myyogaclasses.fit/sitemap.xml

**Evidence.** Where the target wins, verified by header and payload inspection. Security: myyogaclasses.fit serves a full hand-maintained CSP, `strict-transport-security: max-age=63072000; includeSubDomains; preload`, `x-frame-options: DENY`, `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin`, `permissions-policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`. myyogateacher.com serves none of these (`server: BunnyCDN-MU1-1528`, no HSTS, no CSP, no XFO). patanjaleeyoga.com serves only `x-frame-options: SAMEORIGIN` and nosniff behind Cloudflare, no HSTS, no CSP. Delivery: the target is `x-nextjs-prerender: 1`, `x-vercel-cache: HIT`, `x-nextjs-stale-time: 300`, 90 KB HTML for a 978-word page. Markup hygiene: the target has exactly one H1 per page; patanjaleeyoga.com/online-yoga-classes-usa/ and /online-yoga-classes-fees-in-india/ each ship two identical H1s. Where the target loses: no image sitemap at all (/image-sitemap.xml 404s) while shyambhai.yoga embeds 825 `<image:image>` entries in its page-sitemap alone; no hreflang while mywowfit.com serves six; `og:locale` is "en" which is not a valid `language_TERRITORY` value; no /llms.txt (404) while 1om1.net ships /agents.md behind a dedicated discovery sitemap; homepage canonical is `https://www.myyogaclasses.fit` while sitemap.xml lists `https://www.myyogaclasses.fit/`.

**Recommendation.** Fix the four cheap discovery losses. (1) app/layout.tsx:75, change `locale: "en"` to `locale: "en_US"` and add `alternateLocale`. (2) Extend app/sitemap.ts to emit `<image:image>` for teacher avatars and condition hero images; teacher photos are the highest-value image asset on the site and image packs are a live SERP feature on yoga queries. (3) Reconcile the homepage canonical with the sitemap's trailing slash. (4) Add /llms.txt. One warning that bites specifically on this codebase: the CSP in next.config.ts currently allows `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://*.posthog.com` only. Any GA4, GTM, Clarity or schema-testing script added for this work must be added there first or it will fail silently in production and pass in dev.

### [LOW] CORRECTION to the first-pass audit: condition pages have NO FAQPage schema, despite 45 written FAQs and a ready-made builder

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx, /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts, https://www.myyogaclasses.fit/classes/diabetes

**Evidence.** Live https://www.myyogaclasses.fit/classes/diabetes emits exactly two JSON-LD blocks: `{"@type":"Organization"}` and `{"@type":"Course","name":"1:1 Yoga: Diabetes focus"}`. No FAQPage. Yet the page renders 5 visible Q&As (faqH2: "Questions people ask first.", Q1: "Can yoga replace my diabetes medication?") sourced from lib/data/condition-pages/diabetes.json. Across all 9 JSON files that is 45 Q&A pairs. `faqPageJsonLd()` already exists at /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts:22 and is simply never called from /Users/shalomp/YOGA_WEBSITE/app/(marketing)/classes/[slug]/page.tsx. Competitors DO have it: shyambhai.yoga/online-yoga-classes-for-diabetes/ emits FAQPage + Question + Answer; myyogateacher.com/articles/yoga-for-diabetics emits FAQPage.

**Recommendation.** RETITLE: "Condition pages emit no BreadcrumbList and no FAQPage; breadcrumbs are the only part with live SERP value."

SEVERITY: low (was high). Breadcrumbs are a real but minor SERP-display win. FAQPage is now zero-value for Google and is worth adding only as near-free hygiene for non-Google consumers (Bing, AI answer surfaces), not as a ranking or rich-result play.

DO THIS (in app/(marketing)/classes/[slug]/page.tsx, next to the existing courseJsonLd on line 47):

1. Breadcrumbs, the part that actually still works:
   import { courseJsonLd, breadcrumbJsonLd, faqPageJsonLd } from "@/lib/seo/structuredData";
   <JsonLd data={breadcrumbJsonLd([
     { name: "Classes", url: `${siteUrl}/classes` },
     { name: c.name, url: `${siteUrl}/classes/${c.slug}` },
   ])} />
   Mirrors the existing pattern at app/(marketing)/teachers/[slug]/page.tsx:45. /classes is a live 200 and is in the sitemap, so the trail resolves. Both named competitors already do this.

2. FAQPage, corrected code, low priority:
   {rich ? <JsonLd data={faqPageJsonLd(rich.faqs)} /> : null}
   Pass rich.faqs DIRECTLY. Do NOT map to {question, answer} as the original finding said: Faq is {q, a} (lib/data/faqs.ts:5), ConditionPage.faqs is Faq[] (lib/data/condition-pages.ts:56), and the mapped version is a strict-mode type error that emits "name": undefined. Justify this on non-Google surfaces only. Google retired FAQ rich results on 2026-05-07.

DROP ENTIRELY: the Course offers / hasCourseInstance.courseSchedule / provider.sameAs work. Google's course-info structured data was deprecated 2025-06-12 and its documentation removed 2025-09-09 with the note that these types "are no longer shown in Google Search results". There is no Course rich result to qualify for. Do not hardcode "price":"999" into page.tsx under any framing: plan prices live in plan_prices and are admin-editable at /admin/plans, so a literal in code will drift from what the customer is actually charged.

OPTIONAL, AND A BETTER USE OF THE SAME EDIT WINDOW: the Course node's provider.sameAs is set to the page's own URL (structuredData.ts:58, confirmed in the live JSON-LD as sameAs "https://www.myyogaclasses.fit/classes/diabetes"). sameAs is meant for off-domain identity profiles. Point it at the homepage or reuse the exported INSTAGRAM_URL constant already in that file. This is a data-correctness fix, not a rich-result fix, so expect no SERP change.

ALSO WORTH FIXING, MISSED BY BOTH THE FINDING AND THE FIRST-PASS AUDIT: / , /faq and /pricing all emit the identical 9-entry FAQS set as FAQPage, triplicating the same generic Q&As across three URLs while 45 unique condition FAQs carry no markup. If FAQPage is kept anywhere, keep it on /faq and on the condition pages, and drop it from / and /pricing.

### [LOW] The category leader's homepage Organization and BreadcrumbList JSON-LD are INVALID: a leaked `{JSON.stringify(...)}` template literal

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** medium
- **Locations:** https://myyogateacher.com/, https://www.myyogaclasses.fit/

**Evidence.** myyogateacher.com/ serves three ld+json blocks. Two of them begin literally `<script type="application/ld+json">{JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", ...`. json.loads() fails on both: `Expecting property name enclosed in double quotes: line 1 column 2`. Only their FAQPage block parses. This means their headline trust asset, `"aggregateRating":{"ratingValue":"4.9","reviewCount":"360000"}`, is not machine-readable by any parser, and neither is their sitewide Organization entity or their breadcrumb. Their /pricing and /yoga-teachers/* pages carry zero JSON-LD of any kind.

**Recommendation.** Corrected finding (severity: low, dimension: competitor)

Title: MyYogaTeacher's homepage Organization and BreadcrumbList JSON-LD are unparseable (a leaked `{JSON.stringify(...)}` JSX interpolation), and their /pricing and teacher pages carry no JSON-LD at all. The practical gap is smaller than it looks.

Evidence (reproduced in raw HTML and after a full JS render):
- myyogateacher.com/ serves 3 ld+json blocks. Two begin literally `{JSON.stringify({ "@context": ...`; json.loads() fails on both with `Expecting property name enclosed in double quotes: line 1 column 2`. Only the FAQPage block parses. Hydration does not repair them.
- myyogateacher.com/pricing and /yoga-teachers/divya-1: zero ld+json, before and after JS.
- Their broken Organization block contains `aggregateRating: {ratingValue: "4.9", reviewCount: "360000"}` and `address.addressCountry: "United States"`.

Correct read of the impact: this costs MYT less than it appears. Google's review-snippet policy makes self-controlled Organization reviews ineligible for the star feature regardless, so that aggregateRating was never going to render. Their BreadcrumbList has a single ListItem ("Home"), which produces no breadcrumb rich result either way. The real loss is entity-graph signal from the Organization node, plus genuinely missing schema on /pricing and their 116 teacher pages. That last part, not the parse error, is the exploitable gap: the target already emits Person + BreadcrumbList on /teachers/[slug] and Course on /classes/[slug], where MYT emits nothing.

Recommendation, corrected:
1. Do NOT add aggregateRating to Organization. Correct as stated, and worth keeping explicit.
2. Add `foundingDate` to the orgJsonLd object in /Users/shalomp/YOGA_WEBSITE/app/layout.tsx (a one-line literal, e.g. `foundingDate: "2026"`). Requires the owner to supply the real year. This is the only clean addition.
3. Do NOT add a PostalAddress. There is no published business address. The site's stated jurisdiction is Dubai (app/(marketing)/legal/terms/page.tsx:293), the only address in code is a UK bank's (lib/payments/bankTransfer.ts:24-28), and the teachers being in India says nothing about where the organization is. Declaring `addressCountry: "IN"` to look "more honest" than MYT would be a false entity claim. If the owner has a real registered address, publish it on /legal and in a `PostalAddress` together, not in markup alone.
4. Do NOT "widen sameAs" as a markup task. lib/seo/structuredData.ts:20 holds the single INSTAGRAM_URL constant, deliberately shared with the footer, and no other profile exists in the codebase or on the site. sameAs must only list profiles the org actually controls. If the owner opens a YouTube or LinkedIn presence, add the URL to that one constant so the footer and JSON-LD stay in sync; until then the single-entry array is correct, not a defect.
5. The higher-value version of this competitor gap: MYT has zero structured data on 116 /yoga-teachers/* pages and on /pricing. The target should press that by adding the already-missing `AggregateOffer`/`Offer` to /pricing and `BreadcrumbList` to the nine condition pages, which are separate first-pass items with real rich-result eligibility, rather than by polishing an Organization node that only feeds the knowledge graph.

Separately, and not a schema issue: the homepage "4.9 . 1,200+ reviews" vs 12 rendered reviews on /reviews is a real advertising-substantiation exposure, but it is DB-driven (`trustRating` / `trustCount` from admin_settings, visible in the live RSC payload). It must be changed at /admin/settings. A repo edit will not touch it.

---

## architecture (14)

### [HIGH] VERIFIED: condition and teacher pages emit zero contextual internal links. Every href is nav, footer or CTA.

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** components/marketing/condition/ConditionLanding.tsx, app/(marketing)/teachers/[slug]/page.tsx, app/(marketing)/classes/[slug]/page.tsx

**Evidence.** curl of https://www.myyogaclasses.fit/classes/diabetes (200, 90549 bytes) yields exactly these non-asset internal hrefs: /login?next=/dashboard/book x3, /teachers x2, /reviews x2, /pricing x2, /faq x2, /classes x2, /about x2, / x2, /login, /contact, /legal/terms, /legal/privacy, /legal/refund. The x2 pairs are the nav copy plus the footer copy of the same link. Not one link points to a sibling condition, a teacher, or a pose. /teachers/dr-sangeeta (200, 63436 bytes) is the same set plus /teachers x3 (nav, footer, and the 'All teachers' button at app/(marketing)/teachers/[slug]/page.tsx:140). Source confirms it: components/marketing/condition/ConditionLanding.tsx contains exactly two Link elements, line 84 (BOOK_HREF) and line 90 (the in-page anchor #how-it-helps).

**Recommendation.** TITLE: Condition and teacher pages emit zero contextual internal links. Every href is nav, footer, CTA or an in-page anchor.

SEVERITY: high, not critical. All 23 URLs are in sitemap.xml, every condition page is linked from the /classes hub and every teacher page from /teachers, and both hubs sit in the global nav, so every page is at click depth 2 with no orphan or discovery problem. The gain from fixing this is topical clustering and PageRank concentration across the nine strongest pages, not the repair of a broken crawl path.

CORRECTED EVIDENCE: /classes/diabetes 200, 90549 bytes; /teachers/dr-sangeeta 200, 63436 bytes. ConditionLanding.tsx has exactly two Link elements, lines 84 and 90. On the teacher page the "All teachers" button is at app/(marketing)/teachers/[slug]/page.tsx:131 (the file is 138 lines; there is no line 140). On dr-sangeeta the booking CTA is /login?next=%2Fdashboard%2Fbook%2Fdr-sangeeta and /login?next=/dashboard/book appears once, not three times.

CORRECTED RECOMMENDATION:

1. RelatedConditions and TeachersForCondition in components/marketing/condition/ConditionLanding.tsx. Insert after the poses section closes at line 173, i.e. at the blank line 174, BEFORE the `{/* 5 · HOW WE WORK */}` comment on line 175. Do not insert between 175 and 176, that splits the comment from its section. Both are plain server components taking props already in scope, so ISR (verified: x-nextjs-prerender: 1, x-nextjs-stale-time: 300) is untouched.
   - RelatedConditions: 3 sibling links chosen by clinical adjacency, not alphabetically. Suggested pairs: diabetes -> hypertension, weight-loss, geriatric; prenatal -> hormonal-health, pain-relief, mental-health; kids-yoga -> mental-health, weight-loss, pain-relief. Anchor text should be the full page title, not the bare category name.
   - TeachersForCondition: 2 links, matched off the existing `t.specialties` field rather than hardcoded.

2. DROP PosesForCondition as specified. There is no /poses route in the repo, so linking pose cards to /poses/{slug} would ship 107 links to 404s. If pose pages are wanted, they are a separate build: create app/(marketing)/poses/[slug]/page.tsx with generateStaticParams, and note the data supports 55 unique poses, not 107, since 17 Sanskrit names repeat across conditions (Shavasana in 8 of 9 files). Until that route exists, leave the pose cards unlinked.

3. On the teacher page, insert ConditionsThisTeacherCovers (3 links) and OtherTeachers (2 links) after the specialties/languages info block closes at line 117, at the blank line 118, before the CTA row that opens at line 119. Do not insert at line 120, which is inside the `<Button>` element and will not compile.

CONSTRAINT NOTES for whoever implements this: keep every new string em-dash free (use a comma, colon or period), keep the "1:1" framing, introduce no free-trial or "no credit card" wording, and add no new third-party origin so the hand-maintained CSP in next.config.ts stays as is. Condition copy lives in lib/data/condition-pages/*.json, not the DB, so these code edits will change the live page.

### [HIGH] Target URL architecture: 23 to 97 URLs before a single article, 250+ with the editorial program

- **Verdict:** partially-correct | **Effort:** substantial | **Impact:** high
- **Locations:** app/(marketing)/poses/page.tsx, app/(marketing)/poses/[slug]/page.tsx, app/(marketing)/poses/collections/[slug]/page.tsx, app/(marketing)/articles/page.tsx, app/(marketing)/articles/[slug]/page.tsx, app/(marketing)/articles/topics/[slug]/page.tsx, app/(marketing)/types-of-yoga/[slug]/page.tsx, app/(marketing)/private-yoga-online/page.tsx

**Evidence.** Live sitemap.xml returns exactly 23 <loc> entries. Existing route shape is app/(marketing)/{classes,teachers}/[slug]/page.tsx with generateStaticParams, plus 11 static routes in app/sitemap.ts STATIC_ROUTES.

**Recommendation.** CORRECTED FINDING

Title: 23 live URLs. A staged build to 63 structural URLs, then editorial, not 248 pages in one push.

Evidence (verified): sitemap.xml returns exactly 23 <loc>. app/sitemap.ts STATIC_ROUTES is a hardcoded 11-entry array; dynamicRoutes queries only teachers + class_categories. Only 13 page.tsx files exist under app/(marketing). /poses, /articles, /types-of-yoga, /private-yoga-online all 404. Competitors verified by expanding their sitemap indexes: myyogateacher.com 613, patanjaleeyoga.com 417, but 80 of patanjaleeyoga's and 213 of myyogateacher's are commerce, archive or inventory URLs, so the comparable content tier is their 371 (241 articles + 84 asana + 46 types).

CORRECTED TREE

Tier 1, structural, 40 new URLs, no editorial risk:
- /private-yoga-online  pillar, the only page competing for "private yoga lessons online"
- /poses  hub, /poses/[slug]  start at 25, not 40. The JSON has 55 unique Sanskrit names but median 10-word descriptions; publish only poses you can write 400+ original words for.
- /poses/collections  index, /poses/collections/[slug]  9 as listed. Informational intent here, commercial intent stays on /classes/{condition}. That split is the one genuinely load-bearing idea in the original finding, keep it.
- /types-of-yoga  hub, /types-of-yoga/[slug]  12 as listed
Running total: 23 + 1 + 1 + 25 + 1 + 9 + 1 + 12 = 73.

Tier 2, editorial, gated: /articles, /articles/[slug], /articles/topics, /articles/topics/[slug] (8). Ship the hubs with 30 to 40 articles, not 150, each carrying a named credentialed author byline (the three teachers are Dr.-prefixed, use that) and a "Reviewed by" line. Health topics are YMYL; volume without named expertise is the exact pattern the March 2026 update hit. Revisit 150 only after the first 40 hold rankings for 90 days.

DROP from the original: the class_categories.parent_slug column. It is uncounted in the original's own total, needs a hand-written migration applied to the live DB, and the sub-condition pages it enables are DB rows not code, so they cannot ship in this change. /articles/page/{n} pagination: ship /articles as a single hub until you exceed 50 articles.

FIX in the original: 98 not 97. "EXPLICIT static segment so it never collides" is the wrong reason, literal segments always beat sibling dynamic ones in the App Router; the actual requirement is that generateStaticParams for /poses/[slug] must exclude "collections" or the build hits a duplicate-route conflict.

CORRECTED LOCATIONS (adds the one that was missing):
app/(marketing)/private-yoga-online/page.tsx
app/(marketing)/poses/page.tsx
app/(marketing)/poses/[slug]/page.tsx
app/(marketing)/poses/collections/page.tsx
app/(marketing)/poses/collections/[slug]/page.tsx
app/(marketing)/types-of-yoga/page.tsx
app/(marketing)/types-of-yoga/[slug]/page.tsx
app/(marketing)/articles/page.tsx
app/(marketing)/articles/[slug]/page.tsx
app/(marketing)/articles/topics/page.tsx
app/(marketing)/articles/topics/[slug]/page.tsx
app/sitemap.ts  REQUIRED. Without it all of the above stay out of sitemap.xml and the count stays at 23. Extend STATIC_ROUTES for the hubs and add the new slug sources to dynamicRoutes. Past ~250 URLs, split into a sitemap index.

MANDATORY per-route constraints (absent from the original):
- Every new dynamic route needs both `export const revalidate = 300` and `generateStaticParams`. The comment at app/(marketing)/classes/[slug]/page.tsx:17 says revalidate is inert without it.
- No cookies() anywhere in these files. One call kills ISR for the entire (marketing) group with no build error.
- No new third-party origin, so next.config.ts CSP is untouched.
- Pose and article copy is code-resident, so no admin_settings or plan_features conflict. Do not route this copy through class_categories, which is DB-driven and would make code edits inert.

### [HIGH] Implementing all of this without breaking ISR: six rules, plus one live defect in app/sitemap.ts

- **Verdict:** unverified | **Effort:** moderate | **Impact:** high
- **Locations:** app/sitemap.ts, app/(marketing)/layout.tsx, app/(marketing)/classes/[slug]/page.tsx, next.config.ts

**Evidence.** app/(marketing)/layout.tsx carries an explicit comment: 'No auth read here on purpose: awaiting cookies() (via getCurrentUser) would opt the whole (marketing) group into dynamic rendering and disable every page's ISR window.' app/(marketing)/classes/[slug]/page.tsx:17-19: 'Without this, revalidate above is inert: a dynamic segment with no known params is server-rendered on every request and never enters the ISR cache.' Verified live: /classes/diabetes returns x-nextjs-prerender: 1 and x-nextjs-stale-time: 300, age: 260. Revalidate values across the group: page.tsx 60, pricing 60, reviews 60, classes 300, classes/[slug] 300, faq 300, teachers 300, teachers/[slug] 300. DEFECT: app/sitemap.ts line 3 imports createSupabaseServerClient from @/lib/supabase/server, which is the cookie-bound client, and calls it at line 75. Live headers on /sitemap.xml: x-vercel-cache: MISS, age: 0, and NO x-nextjs-prerender header, against x-nextjs-prerender: 1 on /classes/diabetes. The sitemap is regenerated with two Supabase round trips on every single crawler request.

**Recommendation.** R1 No cookies() anywhere in (marketing), including transitively. New pose, article, style and pillar pages read from flat files in lib/data/ (the pose and article corpora are editorial, not transactional, so they do not belong in Postgres) or from the anon Supabase client, never createSupabaseServerClient. This also preserves the zero-env mock story described in lib/data/landing.ts.

R2 Every new dynamic segment gets generateStaticParams plus export const revalidate, copied verbatim from the pattern at app/(marketing)/classes/[slug]/page.tsx:15-24. Without generateStaticParams the revalidate is inert and you get an uncached server render per request on 40 pose pages and 150 articles, which is the exact failure the existing comment warns about. Suggested values: poses 3600, poses/collections 3600, types-of-yoga 3600, articles/[slug] 3600, articles hub 600, private-yoga-online 3600. Editorial content does not need a 300 second window and a longer one cuts revalidation churn at scale.

R3 Leave dynamicParams at its default (true) so a pose or article added between deploys still renders on demand and is then cached, exactly as the existing comments describe for teachers and categories.

R4 The nav dropdown stays client-side. MarketingNav is already 'use client' and already resolves auth via useViewer for precisely this reason. Do not be tempted to server-render the signed-in state to personalise the new hubs.

R5 CSP. next.config.ts:13-19 permits script-src from 'self', checkout.razorpay.com and *.posthog.com only. Do NOT add Google Tag Manager, a schema-generator widget, or a third-party related-posts service, each would need a new origin in that hand-maintained header and would break in production only. For Search Console, use the DNS TXT method, or Next's metadata verification.google field which emits a meta tag and needs no origin at all. Ship JSON-LD through the existing components/shared/JsonLd.tsx server component, which is already inside the CSP because it is an inline application/ld+json block, not a script source.

R6 FIX app/sitemap.ts. Replace createSupabaseServerClient with the anon client and add export const revalidate = 3600. This is outside the (marketing) group so it is not poisoning the group's ISR, but it is its own uncached-per-request defect and it gets 10x worse when the sitemap has 250 URLs and needs four queries instead of two. While there, add the new routes to STATIC_ROUTES and add the pose, collection, style and article loops alongside the existing teacher and category loops at lines 88-110.

### [HIGH] Phased build order, sequenced for compounding rather than for volume

- **Verdict:** unverified | **Effort:** substantial | **Impact:** high
- **Locations:** app/(marketing)/classes/[slug]/page.tsx, app/(marketing)/pricing/page.tsx, app/sitemap.ts, lib/data/condition-pages/

**Evidence.** Sequencing logic: the 9 condition pages are the only ranking-capable content (930 to 980 words each per the first-pass audit, confirmed by JSON payloads of 895 to 1113 tokens per file) and they sit at depth 1 with a homepage link each. Anything linked from them inherits that position immediately. Building new pages before fixing those 9 wastes the only authority the site has.

**Recommendation.** PHASE 0, week 1, about 4 hours, zero new routes. Retitle the 9 condition pages in generateMetadata at app/(marketing)/classes/[slug]/page.tsx:32 (currently `title: c?.name`, which produces 'Diabetes · My Yoga Classes' and targets nothing). Use the metaTitle field you add to each JSON file: 'Online Yoga for Diabetes: 1:1 Sessions with Indian Teachers', 'Yoga for High Blood Pressure: Private Online Classes', 'Prenatal Yoga Online: 1:1 Classes Through Every Trimester', 'Yoga for PCOS and Hormonal Health: Private Online Sessions', 'Yoga for Back and Neck Pain: 1:1 Online Classes', 'Yoga for Anxiety and Stress: Private Online Sessions', 'Yoga for Weight Loss: 1:1 Online Classes That Fit Your Week', 'Chair Yoga for Seniors: Gentle 1:1 Classes Online', 'Yoga for Kids: Calm and Focus in a 1:1 Online Class'. Remember app/layout.tsx appends ' · My Yoga Classes' (18 chars), so keep each under 42 characters of your own or it truncates. Same commit: add breadcrumbJsonLd (already built at lib/seo/structuredData.ts:68, already used on teacher pages) to condition pages, set og:locale to en_US, add the metadata verification.google tag, and fix app/sitemap.ts per R6.

PHASE 1, week 1 to 2, still zero new routes. Ship the internal-link blocks from findings 5 and 6. This is the single highest-return change on the list: it converts 12 depth-1 dead ends into a connected cluster and it does not depend on a single new page existing. Ship it before the pose library, because the pose library's whole value is that these pages link to it.

PHASE 2, week 2 to 3. /poses hub plus 40 pose pages, generated from the existing JSON. The copy is already written, this is a data transform and one template. Wire the condition pages' pose cards to link into it (the cards already render p.sa and p.en at ConditionLanding.tsx:150-155, they just are not Links). 40 new indexable URLs, every one of them at depth 2 with 1 to 9 contextual inbound links from depth-1 pages on day one. Nothing else on this list has that link profile at launch.

PHASE 3, week 4. The 9 /poses/collections pages and the /private-yoga-online pillar. Collections are assembled from data already published in Phase 2, so the marginal cost is a template plus intro copy. The pillar is the only genuinely new writing in this phase.

PHASE 4, weeks 5 to 12. /articles hub, the 8 topic hubs, and the first 24 articles at roughly 3 a week. Ship the hubs and topic hubs in the same deploy as the first 8 articles so no topic hub launches empty.

PHASE 5, weeks 13+. /types-of-yoga and its 12 style pages. Deliberately last: 'types of yoga explained' is a hard, low-commercial-intent head term owned by encyclopaedic sites, and the cluster's real job is to catch informational traffic and route it to conditions. It needs the rest of the site to exist first to do that.

PHASE 6, parallel and blocking. Add USD, GBP and EUR plan_prices rows at /admin/plans. This is an admin task, not a deploy: SUPPORTED_CURRENCIES already lists all five at lib/geo/region.ts:35 and migration 0036 exists, but effectiveCurrency downgrades to INR until every active plan has a row. Do this BEFORE Phase 4 traffic arrives. Rewrite the /pricing meta description at the same time, it currently reads 'Honest yoga pricing in AED and INR. One-time session packs, no subscription.' which tells a US, UK or EU searcher in the SERP snippet, before they ever click, that the service is not priced for them.

### [MEDIUM] Topic cluster map with explicit bidirectional linking rules

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** components/marketing/condition/ConditionLanding.tsx, app/(marketing)/classes/[slug]/page.tsx

**Evidence.** Derived from real pose overlap across lib/data/condition-pages/*.json. Jaccard similarity on the canonical pose sets: diabetes/hypertension 0.43 (6 shared poses), hormonal-health/prenatal 0.44 (7 shared), mental-health/kids-yoga 0.44 (7 shared), hypertension/mental-health 0.40 (6 shared), geriatric/kids-yoga 0.40 (6 shared). Shavasana appears in all 9 conditions, Yoga Nidra in 8, Bhramari in 7, Marjaryasana-Bitilasana in 7.

**Recommendation.** Retitle: "Lateral internal linking between the 9 condition pages and the 3 teacher pages." Severity medium, not high: it is 12 existing URLs, and the high-value version of this finding is blocked behind content that does not exist yet.

CORRECTED EVIDENCE (verified, reproduce with python over lib/data/condition-pages/*.json, set of `sa` values):
- 9 files, 107 raw pose entries, 106 unique within-condition, 55 distinct poses, 35 poseGroups.
- Real top pairs: hormonal-health/mental-health 0.438 (7 shared), hormonal-health/hypertension 0.429 (6), diabetes/hypertension 0.429 (6), hypertension/mental-health 0.400 (6), diabetes/hormonal-health 0.375 (6).
- Universal poses: Shavasana 8/9 (absent from prenatal, which uses Side-lying Shavasana), Yoga Nidra 7/9, Bhramari 7/9, Nadi Shodhana 6/9, Marjaryasana-Bitilasana 6/9, Tadasana 5/9, Balasana 5/9.
- Live /classes/diabetes emits 13 unique internal destinations, all nav, footer, legal or CTA. Zero sibling-condition links, zero teacher links.

DROP entirely: PILLAR 1 (/private-yoga-online, 404), PILLAR 3 (/poses, 404), PILLAR 4 (/articles, 404), PILLAR 5 (/types-of-yoga, 404), and the parent_slug sub-condition taxonomy (no such field, no such slugs). Those belong in a separate content-creation finding, not an architecture one. R1, R2 and R5 are unactionable until those pages exist.

DROP R6. /login is indexable, not noindexed, so the stated rationale is false; 1 of the 3 links is the sitewide nav; and a 2-CTA cap collides with CLAUDE.md's "above-fold Book my 1:1 session CTA carries the bulk of conversion, must be visible in viewport 1 on every device" plus the non-negotiable mobile sticky CTA. If anything is worth doing here it is adding rel="nofollow" nothing and instead simply not worrying about it. Internal-link sculpting is deprecated folklore.

REPLACE R3 with a hand-balanced set that actually satisfies the inbound constraint, since unconstrained Jaccard does not. Each condition gets exactly 3 siblings; every condition receives at least 2 inbound:
- diabetes -> hypertension, weight-loss, hormonal-health
- hypertension -> diabetes, mental-health, geriatric
- hormonal-health -> mental-health, prenatal, weight-loss
- mental-health -> hormonal-health, hypertension, kids-yoga
- prenatal -> hormonal-health, pain-relief, mental-health
- pain-relief -> geriatric, hypertension, prenatal
- geriatric -> pain-relief, hypertension, diabetes
- weight-loss -> diabetes, hormonal-health, pain-relief
- kids-yoga -> mental-health, prenatal, geriatric
Inbound counts: diabetes 3, hypertension 4, hormonal-health 4, mental-health 4, prenatal 3, pain-relief 3, geriatric 3, weight-loss 3, kids-yoga 1... note kids-yoga needs one more, so also add kids-yoga to prenatal's set in place of mental-health, giving kids-yoga 2 inbound. Verify the closure with a script before shipping rather than asserting it, which is what the original finding failed to do.

REPLACE R4 with the honest version: with only 3 live teachers, link each condition page to the 1-2 teachers whose bio actually mentions that condition, and give each teacher page a "Conditions I work with" block linking to every condition they cover. Do not impose an artificial 2-and-3 cap on a graph this small.

IMPLEMENTATION, respecting constraints: render both blocks inside components/marketing/condition/ConditionLanding.tsx from a static sibling map in lib/data/condition-pages.ts. No cookies(), no new fetch, so ISR in the (marketing) group is preserved. No new third-party origin, so next.config.ts CSP is untouched. Link text must avoid em-dashes and must not reintroduce free-trial wording. This is pure code, not admin_settings or plan_features, so it is not subject to the DB-driven-copy override.

EXPECTED VALUE: this converts 9 orphan-ish leaves into a connected subgraph of 12 URLs. It is worth doing and it is cheap, but on a 23-URL site it is a medium-impact tidy-up, not a high-impact one. The high-impact work is the missing content the finding assumed already existed.

### [MEDIUM] Exact internal-link specification for all 9 condition pages that exist today

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** components/marketing/condition/ConditionLanding.tsx, lib/data/condition-pages/

**Evidence.** Sibling choices blend measured pose overlap with clinical adjacency. Teacher choices are taken from the live Person JSON-LD knowsAbout arrays: dr-vaishnavi-mayya has ['Clinical Yoga','Lifestyle Disorders','Cardiovascular Health','Respiratory Health','Musculoskeletal Disorders',"Women's Health"], dr-hima-bindu has ['Posture Correction','Core Strength','Stress Relief','Pain Relief','Breathwork','Nervous System Regulation'], dr-sangeeta has exactly one: ['Prenatal and Postnatal Yoga'].

**Recommendation.** CORRECTED FINDING. Title: the nine condition pages link to no sibling condition and no teacher profile. Severity: MEDIUM.

Corrected evidence. Each condition page has TWO inbound internal links today, not one: the homepage and the /classes hub both render all nine href="/classes/<slug>" (verified by curl on / and /classes). No other page links to them: /teachers, /faq, /pricing, /about all return zero. ConditionLanding.tsx contains exactly two <Link>s, line 84 (BOOK_HREF) and line 90 (the #how-it-helps in-page anchor), so nothing on the page body links out. The three knowsAbout arrays quoted in the original finding DO reproduce exactly on live, but they come from teachers.specialties via lib/seo/structuredData.ts:44 and are admin-editable, so treat them as a snapshot, not a constant.

Corrected recommendation. Ship ONLY the links whose targets exist today. Drop every pose link and every "Collection:" link from this change: /poses/*, /yoga-poses-for-diabetes, /collections/* all return 404, and there is no /poses route in app/(marketing)/. Those belong in a separate finding that first BUILDS the pose pages from the 107 entries in lib/data/condition-pages/*.json; linking to them before they exist ships 63 broken links.

Do not hardcode the map inside ConditionLanding.tsx. Put it in a new lib/data/condition-links.ts as a typed const keyed by slug, and pass it in as a prop, so the sibling titles stay next to the JSON they describe and a future pose-page phase extends the same object.

Guard the teacher links against link rot. Teacher slugs are DB rows and app/(marketing)/teachers/[slug]/page.tsx calls notFound() when the row is gone, so either resolve the two teacher links from the same getTeachers() call the page already makes and skip any that no longer resolve, or add a unit test in lib/data/condition-links.test.ts asserting every sibling slug is a key of the condition-pages map (that one is pure and dependency-free, so it fits the stated "pure helpers only" test convention).

Fix the two unsupported teacher picks. dr-sangeeta's only specialty is 'Prenatal and Postnatal Yoga', so keep her on PRENATAL alone. Replace her on HORMONAL-HEALTH with dr-vaishnavi-mayya (Women's Health) plus dr-hima-bindu (Nervous System Regulation), and on KIDS-YOGA with dr-hima-bindu (Breathwork) plus dr-vaishnavi-mayya (Clinical Yoga).

Corrected per-page spec, siblings (3) then teachers (2), all targets verified present in the live sitemap:
DIABETES -> hypertension, weight-loss, hormonal-health | dr-vaishnavi-mayya, dr-hima-bindu
HYPERTENSION -> diabetes, mental-health, geriatric | dr-vaishnavi-mayya, dr-hima-bindu
PRENATAL -> hormonal-health, pain-relief, kids-yoga | dr-sangeeta, dr-vaishnavi-mayya
HORMONAL-HEALTH -> prenatal, weight-loss, diabetes | dr-vaishnavi-mayya, dr-hima-bindu
PAIN-RELIEF -> geriatric, prenatal, mental-health | dr-hima-bindu, dr-vaishnavi-mayya
MENTAL-HEALTH -> hypertension, hormonal-health, kids-yoga | dr-hima-bindu, dr-vaishnavi-mayya
WEIGHT-LOSS -> diabetes, hormonal-health, hypertension | dr-vaishnavi-mayya, dr-hima-bindu
GERIATRIC -> pain-relief, hypertension, mental-health | dr-hima-bindu, dr-vaishnavi-mayya
KIDS-YOGA -> mental-health, prenatal, geriatric | dr-hima-bindu, dr-vaishnavi-mayya

The descriptive anchor text in the original finding is good and em-dash-free; keep it for the sibling and teacher links and discard the pose and collection anchors.

Corrected inbound audit. Baseline is 2 everywhere. After this change: hormonal-health 6, mental-health 6, diabetes 5, hypertension 5, prenatal 5, pain-relief 5, geriatric 5, weight-loss 4, kids-yoga 4.

Why medium and not high. This is a real fix and it is cheap, but the ranking constraint on this site is content volume and titling, not link distribution across nine already-crawled pages. Sequence it behind the title rewrite (the pages are currently "Diabetes | My Yoga Classes", no keyword) and behind building the pose pages, which is what would actually close the 23-vs-613 URL gap and give these links somewhere worth pointing.

### [MEDIUM] Exact internal-link specification for the 3 teacher pages, plus the data gap that blocks two of them

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** app/(marketing)/teachers/[slug]/page.tsx

**Evidence.** Live page word counts inside <main>: dr-sangeeta 110 words, dr-vaishnavi-mayya 125 words, dr-hima-bindu 155 words. Meta descriptions are the raw headline field: 'Yoga and Naturopathy Doctor' (27 chars), 'MD in Clinical Yoga & Naturopathy' (33 chars), 'Medical Yogic Sciences · 8 years' (32 chars). Source: app/(marketing)/teachers/[slug]/page.tsx:31, description: t?.headline. Dr Sangeeta's knowsAbout array has exactly one entry, which is not enough to derive 3 condition links honestly.

**Recommendation.** CORRECTED FINDING
Title: Teacher pages are internal-link dead ends with non-descriptive meta descriptions. Severity: MEDIUM.

Evidence (reproduced): <main> on each live teacher page contains exactly two hrefs, the login/book CTA and /teachers. Word counts in <main> are 97 (dr-sangeeta), 105 (dr-vaishnavi-mayya), 135 (dr-hima-bindu). Meta descriptions are the raw headline: 27, 33 and 32 chars, from app/(marketing)/teachers/[slug]/page.tsx:29 (`description: t?.headline ?? undefined`), NOT line 31.

FIX 1, metadata. Compose and CLAMP, because headline and specialties are unbounded admin-entered text and no fixed template can promise a length range. Replace page.tsx:26-31 with:

  const clamp = (s: string, n = 155) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n)).replace(/[,.]$/, "") + ".");
  const focus = t?.specialties?.slice(0, 2).join(" and ").toLowerCase();
  return {
    title: t ? `${t.display_name}: Yoga Teacher` : "Teacher",
    description: t
      ? clamp(`${t.display_name} teaches 1:1 online yoga${focus ? ` for ${focus}` : ""}. Live 60 minute sessions in your own timezone, anywhere in the world.`)
      : undefined,
    alternates: { canonical: `/teachers/${slug}` },
  };

Verified against the real live values this yields 137 / 154 / 148 chars. Two specialties, not three, is what keeps it in range. It keeps the `t?.` guard so an unknown slug still 404s, degrades cleanly when specialties is empty, and never leaks the "·" or "&" from a headline into the description.

FIX 2, internal links. Do this in code with an explicit slug map, not by editing admin text. Add to page.tsx a const map `TEACHER_CONDITIONS: Record<string, {href: string; label: string}[]>` and render a "Conditions <first name> works with" list plus a "Other teachers" list of the other two slugs. Static Links, no cookies(), so ISR at revalidate = 300 is untouched. Link ONLY what the teacher's own specialties evidence:
  dr-vaishnavi-mayya (6 specialties, all evidenced): /classes/hypertension "Yoga for high blood pressure", /classes/diabetes "Yoga for diabetes", /classes/hormonal-health "Yoga for hormonal health and PCOS".
  dr-hima-bindu (6 specialties, all evidenced): /classes/pain-relief "Yoga for back and neck pain", /classes/mental-health "Yoga for stress and anxiety", /classes/geriatric "Chair yoga for seniors".
  dr-sangeeta: ONE link, /classes/prenatal "Prenatal and postnatal yoga online". Do not manufacture two more. DROP the finding's instruction to add "Kids and Family Yoga" and "Women's Health" to her record, that is inventing a credential.

Also add the reverse direction, which the finding missed and which is worth more: each /classes/[slug] page (930-980 words, the site's best content) should link to the teacher(s) who actually treat that condition. Those pages have real topical authority to pass, the teacher pages have almost none.

FIX 3, thin bodies. Correctly scoped: `{t.bio}` at page.tsx:100 is DB-driven from the teachers table, so this is an admin or teacher-portal content task, not a deploy. Target 300-400 words covering training lineage, who they work best with, and what a first 60 minute session looks like. Frame the benefit as trust and conversion on a page a prospect lands on from /teachers, not as a prerequisite for ranking on the teacher's own name, which these pages already win uncontested.

### [MEDIUM] Orphan risk and pagination strategy for the articles hub at scale

- **Verdict:** partially-correct | **Effort:** substantial | **Impact:** high
- **Locations:** app/(marketing)/articles/page.tsx, app/(marketing)/articles/topics/[slug]/page.tsx, app/sitemap.ts

**Evidence.** There is no /articles route in the repo today (find over app/(marketing) returns only page, contact, classes, faq, teachers, about, pricing, reviews, classes/[slug], teachers/[slug], legal/*). The failure mode is predictable from the competitor shape: myyogateacher.com publishes 241 article URLs, which is far past the point where a single reverse-chronological hub can keep them all reachable.

**Recommendation.** SEVERITY: high -> medium. There are zero articles, so zero orphans and zero current impact. It is worth encoding before article #1 because retrofitting internal links across 250 published URLs is expensive, but it is a pre-build design constraint, not a live defect. Do not let it compete for priority with the actual content gap.

CORRECTED MECHANISM #1 (the finding's version cannot work). Rename it: it is a RECIPROCAL-EDGE gate, not a publish gate. The build-time loader must (a) validate the outbound fields as described, AND (b) materialize the reverse edge — for every article A listing B in relatedArticles, B's rendered "Related reading" must include A. Without step (b) the gate validates outbound links while "orphan" is defined by inbound links, so a freshly published article passes the gate with zero inbound links. Then, and only then, add the real orphan assertion: after building the full article set, compute inbound-link count per article and throw if any published article has fewer than 2. Model the throw on lib/razorpay/catalog.ts:155, which is the correct pattern to cite.

DROP relatedPoses FROM THE GATE until /poses/{slug} exists. As written, min 2 relatedPoses blocks article #1 behind an entire second route tree. Make it optional-but-validated-if-present, and hard-require it only once /poses ships. The 107 pose entries across 35 poseGroups in lib/data/condition-pages/*.json (established list says 36 groups; the real count is 35) are the natural seed corpus for that tree.

ADD MECHANISM #5, WHICH IS CHEAPER THAN ALL FOUR AND FIXES A SECOND LOGGED PROBLEM. Every article carries an author byline linking to an existing /teachers/{slug}, and each teacher page renders "Articles by this teacher". Verified live: all three teacher pages exist in the sitemap and already ship Person + BreadcrumbList JSON-LD, so add author as a Person node referencing that teacher URL. This gives every article a SECOND permanent inbound link from a depth-1 page, and simultaneously resolves established item #3's teacher-page dead end. The finding's "do not build author archives" stands only as "do not build a NEW archive" — the archive already exists and is currently a dead end.

KEEP AS-IS (verified correct, do not weaken): self-canonical on every /articles/topics/{topic}/page/{n}; index,follow on topic pagination; no /articles/page/{n}; no tag or date archives; condition-page reverse index (condition pages confirmed depth-1, all 9 linked from the homepage).

SITEMAP: raise the split trigger from 200 URLs to ~2,000, or split only when Search Console coverage actually becomes hard to read. At 250 URLs the 50,000/50MB limit is not a factor and the stated rationale is wrong. When you do split, note that generateSitemaps turns /sitemap.xml into an index at /sitemap/[id].xml and you must resubmit in Search Console, losing per-sitemap history. Until then keep the single app/sitemap.ts and just extend it with the article and topic-hub routes.

TOPIC COUNT: "8 topic hubs" is unmoored from the repo. The site's existing taxonomy is 9 conditions (diabetes, geriatric, hormonal-health, hypertension, kids-yoga, mental-health, pain-relief, prenatal, weight-loss). Use 9 topic hubs mirroring the condition slugs so the reverse index in mechanism #2 is a 1:1 mapping rather than an 8-to-9 join.

### [MEDIUM] NEW DEFECT: sitemap.xml is rendered dynamically on every request because it reads cookies

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** app/sitemap.ts

**Evidence.** app/sitemap.ts line 2 imports createSupabaseServerClient from @/lib/supabase/server (the cookie-bound client per the CLAUDE.md client table) and calls it at line 75 inside the default export. Live response headers for https://www.myyogaclasses.fit/sitemap.xml: 'age: 0', 'x-vercel-cache: MISS', 'cache-control: public, max-age=0, must-revalidate', and no x-nextjs-prerender header at all. Compare https://www.myyogaclasses.fit/classes/diabetes: 'x-nextjs-prerender: 1', 'x-nextjs-stale-time: 300', 'age: 260'.

**Recommendation.** Swap the import to the anon browser-safe client (or a service client, since sitemap data is public and non-user-specific) and add `export const revalidate = 3600` to app/sitemap.ts. The two Supabase queries at lines 78-90 read only public is_active rows, so no cookie-bound session is needed for either. This becomes materially worse at the target scale, where the same handler will be running four queries across teachers, categories, poses and articles on every crawler fetch, and Googlebot re-fetches a sitemap frequently for a site that has just tripled its URL count.

### [MEDIUM] Pose pages need their own schema and a strict duplicate-content guard, since 3 of the 40 will share copy across up to 9 conditions

- **Verdict:** unverified | **Effort:** moderate | **Impact:** medium
- **Locations:** lib/seo/structuredData.ts, lib/data/condition-pages/

**Evidence.** Shavasana's description text appears in 9 of 9 condition JSON files, Yoga Nidra in 8, Bhramari in 7, Marjaryasana-Bitilasana in 7, Nadi Shodhana in 6, Tadasana in 6, Balasana in 5. The descriptions are condition-specific (diabetes.json Tadasana reads 'Grounding, balance, and posture work to begin exactly where your body is today') but overlap heavily in structure.

**Recommendation.** Each /poses/{slug} page gets: an ExerciseAction JSON-LD node (schema.org/ExerciseAction, with name, alternateName for the English name, description, and a HowTo-style step list), a BreadcrumbList using the existing lib/seo/structuredData.ts:68 builder, and a 'Used in these conditions' block limited to 3 per rule R2. Crucially, the per-condition description strings from the JSON files must NOT be concatenated onto the pose page verbatim, or Shavasana's page becomes 9 near-identical paragraphs. Instead: write one canonical 250 to 350 word body per pose (how to enter, what it does, contraindications, chair or wall variation) and surface the condition-specific line only as a short attributed callout on the linked condition page, where it already lives. The pose page is the canonical explanation; the condition page is the application. That split keeps both unique and is what makes the informational/commercial intent separation in the URL architecture actually hold.

### [LOW] CORRECTION to the established audit: 35 poseGroups not 36, and 107 entries contain a duplicate. The true unique count is 55 raw strings, 40 publishable pose pages.

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** medium
- **Locations:** lib/data/condition-pages/kids-yoga.json, lib/data/condition-pages/

**Evidence.** Parsed all 9 files in lib/data/condition-pages/. Group counts: diabetes 4, geriatric 4, hormonal-health 4, hypertension 3, kids-yoga 4, mental-health 4, pain-relief 4, prenatal 4, weight-loss 4 = 35 poseGroups, not 36. Pose entries total 107, but kids-yoga.json lists Vrksasana twice, so there are 106 distinct (condition, pose) pairs. Normalising the Sanskrit strings yields 55 unique names. Of those, 5 are generic movement labels with no search demand ('Gentle standing leg lifts', 'Shoulder rolls & arm circles', 'Supported gentle backbend', 'Gentle stretches', 'Gentle neck releases') and 10 are variants that fold into a parent ('Seated Cat-Cow' into Marjaryasana-Bitilasana, 'Side-lying Shavasana' into Shavasana, 'Chair-supported gentle squat' into Malasana, 'Tadasana balance games' into Tadasana, 'Seated gentle twist' into Ardha Matsyendrasana, 'Guided story relaxation' into Yoga Nidra, and the four breath variants 'Belly balloon breath', 'Flower & candle breath', 'Gentle natural breathing', 'Extended-exhale breathing' into one diaphragmatic-breathing page).

**Recommendation.** CORRECTED FINDING

Title: lib/data/condition-pages/ holds 35 poseGroups (not 36 as the first-pass audit stated) and 107 pose entries, one of which is a shipped duplicate. Normalising gives 55 raw strings and roughly 40 publishable pose pages.

Corrected evidence:
- 35 poseGroups, 107 entries, 55 unique `sa` strings, 106 distinct (condition, pose) pairs. All verified by script.
- kids-yoga.json lists Vrksasana twice and BOTH cards render live on /classes/kids-yoga, because ConditionLanding.tsx:148 prints `p.sa` verbatim. This is the only reader-visible defect in the finding.

Corrected derivation (the finding's version is off by one and leaves 6 strings unclassified). From 55:
- Drop 7 generic movement labels, not 5. Add 'Gentle wrist & ankle circles' and 'Seated ankle & leg mobility' (both geriatric.json, lines 48 and 96) to the 5 already named. 55 - 7 = 48.
- Fold 4 breath variants into one diaphragmatic-breathing page: -3 = 45.
- Fold 6 single variants into existing parents: -6 = 39.
- 'Virabhadrasana I & II' splits into virabhadrasana-i plus the existing virabhadrasana-ii: +1 = 40.
- 'Garudasana arms' to garudasana, 'Natural / Ujjayi-light breathing' to ujjayi, 'Thread-the-needle' to parsva-balasana: net 0.
Result: 40 pages, but 32 asanas + 7 breath/meditation + parsva-balasana. DROP pawanmuktasana from the list unless the author intends it as an editorial parent for the two geriatric mobility strings, in which case say so explicitly. It appears nowhere in the repo.

Corrected severity: low as filed, because the headline is an arithmetic correction with no ranking impact. Split it in two:
- LOW, ship now: delete the second Vrksasana object from the "Balance & games" group in kids-yoga.json (keep the "flamingo" desc, drop the "Standing tall like a tree" one from "Animal poses & play", or vice versa). One-line JSON fix, no migration, no DB, ISR revalidates.
- HIGH, separate finding: the 40-page pose hub is a 23-to-63 URL expansion against myyogateacher.com's 84 /yoga-asana pages. That is the actual revenue-relevant item and deserves its own entry rather than riding along as a footnote to a counting correction.

Two gaps the recommendation should close before it is actionable:
- It gives an H1 pattern but no <title> pattern. app/layout.tsx:66 is `template: "%s · My Yoga Classes"`, which adds 18 characters, so the proposed 62-char H1 string would become an 80-char title and truncate in SERPs. Specify a shorter title, for example "Setu Bandhasana (Bridge Pose)" yielding "Setu Bandhasana (Bridge Pose) · My Yoga Classes" at 47 chars.
- New /poses routes would live in the (marketing) group. Note explicitly that they must not call cookies(), since that kills ISR group-wide with no build error.

### [LOW] Anchor text strategy: three tiers, with a hard cap that prevents over-optimisation

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** components/marketing/MarketingNav.tsx, components/marketing/Footer.tsx, components/marketing/condition/ConditionLanding.tsx

**Evidence.** Every internal anchor on the live site today is brand-voice or navigational. Verified strings: 'Book a 1:1 session' (ConditionLanding.tsx:84-86), 'All teachers' (teachers/[slug]/page.tsx:140), 'Book a 1:1 with {firstName}' (teachers/[slug]/page.tsx:133), 'How it helps' (ConditionLanding.tsx:90), footer 'Teachers', 'Class types', 'Pricing', 'FAQ', 'Reviews', 'About', 'Contact'. None of these carries a query term.

**Recommendation.** Corrected finding: "Three footer anchors and the nine condition-card anchors are under-descriptive; the site's real anchor problem is the opposite of over-optimisation."

Corrected evidence. Nav and footer anchors are bare navigational labels (Footer.tsx: 'Teachers', 'Class types', 'Pricing', 'FAQ', 'Reviews'; MarketingNav.tsx NAV_LINKS lines 14-20). But descriptive anchors already exist and already exceed the proposed 60-char cap: /teachers/dr-vaishnavi-mayya receives a 114-char anchor, /classes cards receive ~180-char title+description anchors. ConditionLanding.tsx has exactly two hrefs, BOOK_HREF (line 16, "/login?next=/dashboard/book") and "#how-it-helps" (line 90), so condition pages emit zero outbound equity.

What to actually do, in order of value:

1. DO NOT change "Book a 1:1 session". It points at /login, which is not indexable content. Anchor text credits the destination. Spending the edit there buys nothing. Keep "Book a 1:1 with Sangeeta" too, that part of the original finding is right.

2. Footer, code edit, safe, sitewide: in components/marketing/Footer.tsx change 'Class types' to "Yoga by condition" (it is literally what /classes is, nine condition pages), 'Teachers' to "Our yoga teachers", 'Reviews' to "Student reviews". Leave 'Pricing', 'FAQ', 'About', 'Contact' alone. This is a real but small win, roughly 23 pages of sitewide partial-match anchor.

3. The nine condition-card anchors are the high-value slot and are DB-DRIVEN, not code. They render from ClassCategory.name at ClassGrid.tsx:59. Changing "Hypertension" to a keyworded anchor requires an UPDATE to class_categories.name (or /admin), and it also rewrites the card title and the /classes/[slug] H1. So do not rename. Instead add a separate, code-side, keyworded anchor: give StyleCards a second line inside the card that is not part of the card link, or add a short prose paragraph above the grid on /classes linking each condition with a Tier-2 partial ("yoga for high blood pressure", "prenatal yoga online", "chair yoga for seniors"). That keeps DB copy untouched.

4. Fix the anchors that already break the 60-char rule before adding more rules. TeacherGrid and the /classes cards wrap the whole card in one <a>, so the anchor is title + rating + bio fragment. Wrap only the heading in the <a> and make the rest non-link, or add aria-label and keep the link to the name plus specialty, e.g. "Dr Sangeeta, prenatal and postnatal yoga". That is one anchor under 45 chars instead of one at 73-114.

5. Tier 1 exact-match editorial anchors are not actionable until condition pages have outbound links at all. Fold that into the internal-linking work, do not ship it as an anchor-text policy against pages that emit two links, one of which is a fragment.

Keep the original's sound rules: no 'click here'/'read more', no brand name in internal anchors, no em-dashes. Drop the "at most one exact-match anchor per target per page" cap as premature; the site has zero exact-match editorial anchors today, so an over-optimisation cap is solving a problem that does not exist yet.

### [LOW] Navigation: move to a 6-item bar with one Learn group, keeping /pricing visible as required

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** medium
- **Locations:** components/marketing/MarketingNav.tsx, components/marketing/Footer.tsx

**Evidence.** components/marketing/MarketingNav.tsx:13-20 defines NAV_LINKS as a 6-entry const array: /teachers Teachers, /classes Classes, /pricing Pricing, /reviews Reviews, /faq FAQ, /about About. CLAUDE.md conversion notes: 'Public pricing is the #1 trust signal, keep /pricing visible from the nav.' MarketingNav is already 'use client' and resolves auth client-side (line 24 comment explicitly says a cookies() read in the layout would opt the whole group out of ISR), so a dropdown is pure client work with no rendering consequence.

**Recommendation.** SEQUENCING: this is a follow-on to the content finding, not a standalone item. Do not touch the nav until at least two of /poses, /types-of-yoga, /articles return 200. Today all four proposed destinations 404. Severity low, not medium.

WHEN THE HUBS EXIST, the target bar (6 items):
Teachers | Classes | Pricing | Learn | Reviews | About

Keep Pricing 3rd, where it is today. Insert Learn at position 4 and drop FAQ from the bar. This preserves the CLAUDE.md constraint literally rather than just nominally, and avoids moving the #1 trust signal past a new dropdown.

Learn dropdown contents, added only as each ships: Yoga pose library (/poses), Types of yoga (/types-of-yoga), Articles (/articles), FAQ (/faq).

MANDATORY IMPLEMENTATION CONSTRAINT the original finding omitted: the dropdown's `<Link>` elements must be mounted in the DOM at all times and hidden with CSS plus `aria-hidden` / `hidden` attribute toggling. Do NOT use the `{open && (...)}` pattern that the mobile sheet uses at MarketingNav.tsx line ~110. That pattern keeps links out of the server-rendered HTML, which would remove the four Learn links from the static ISR payload and defeat the entire point of the change. The desktop `<nav>` at line 65 is the only always-in-DOM copy of these links today.

FOOTER: Footer.tsx line 20 is already `md:grid-cols-[1.6fr_1fr_1fr_1fr]` (brand, Explore, Company, Legal). A Learn column is the FIFTH column, not the fourth. Two acceptable options:
(a) Change line 20 to `md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]` and add a fifth `<div>` headed "Learn" with Pose library, Types of yoga, Articles, FAQ.
(b) Cheaper and lower-risk: leave the grid alone and append Pose library, Types of yoga, Articles to the existing Explore column, which already holds FAQ. Explore would go from 5 to 8 links, which is still a reasonable footer column and requires no layout change.
Prefer (b) unless the design calls for a visual split.

/private-yoga-online: agreed it does not belong in the nav, but it cannot go in the footer either until it returns 200. It is currently a 404.

Keep the label "Classes". Do not rename to "Conditions" and do not change the URL. That part of the original recommendation is sound.

MOBILE: agreed, flat inline list inside the existing sheet, no nested accordion. Since the sheet is already conditionally mounted it contributes nothing to crawlability either way, so this is a pure UX call and the flat list is right.

HIGHER-PRIORITY ITEM FOUND WHILE VERIFYING THIS ONE, worth its own finding: on live /faq the 9 `acceptedAnswer` strings appear 0 times outside `<script>` tags. The accordion unmounts closed items, so the crawlable `<main>` is 124 words consisting of the 9 question headings, the intro line, and the CTA. No answer text is in the HTML. Fix by rendering the answer `<p>` for every item in the DOM and hiding collapsed ones with CSS (Radix `forceMount` plus `hidden` styling), not by unmounting. Separately, /pricing's 9 Question names are byte-identical to /faq's, so the same FAQPage block ships on three URLs. Keep the markup on /faq only, or scope /pricing's to genuinely pricing-specific questions. Fixing /faq's body content matters far more to its top-level-slot question than where the link sits in the bar.

### [LOW] Crawl depth: the established assumption is wrong, everything is already at depth 1. The target keeps the maximum at 3.

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** medium
- **Locations:** app/(marketing)/page.tsx, components/marketing/Footer.tsx

**Evidence.** Enumerated the live homepage's non-asset hrefs: it links /classes/diabetes, /classes/geriatric, /classes/hormonal-health, /classes/hypertension, /classes/kids-yoga, /classes/mental-health, /classes/pain-relief, /classes/prenatal, /classes/weight-loss, /teachers/dr-hima-bindu, /teachers/dr-sangeeta, /teachers/dr-vaishnavi-mayya, plus every nav and footer destination. That is all 23 sitemap URLs reachable in one click. Depth today is 1, not 2. The dead-end problem is real but it is a link-equity and topical-context problem, not a reachability problem.

**Recommendation.** CORRECTED FINDING

Title: Crawl depth is already optimal. Every one of the 23 live URLs sits at depth 1. The real problem is contextual linking, not reachability. Keep depth at a maximum of 3 as content scales.

Severity: low (informational correction plus a forward constraint; zero current impact).

Evidence (verified 2026-09-16): all 23 sitemap URLs are reachable in one click from `/`. Set difference between sitemap `<loc>` paths and homepage internal hrefs is empty. Links are plain server-rendered `<a href>` in the raw HTML with zero `rel="nofollow"`. `components/marketing/Footer.tsx` supplies 10 of them (lines 51-55, 64-65, 79-81); the 9 condition pages and 3 teacher pages come from homepage body sections in `app/(marketing)/page.tsx` (`PracticeSection`, `TeacherGrid`), not from nav or footer. `/classes/diabetes` contains zero contextual internal links: its only internal hrefs are /login, /teachers, /reviews, /pricing, /faq, /classes, /about, /, /contact and the three /legal pages, all of which are nav or footer chrome.

CORRECTED DEPTH LEDGER

Depth 0: `/` (1 URL).

Depth 1: 13 URLs in nav or footer (the 10 that exist today plus `/poses`, `/types-of-yoga`, `/articles`), the 9 condition pages, and up to 8 teacher pages. 25 URLs at a 3-teacher roster. Hard constraint the original ledger missed: `getFeaturedTeachers()` in `lib/data/landing.ts:299-308` is `.limit(8)`, so teacher 9 and beyond drop to depth 2 via `/teachers` by design. `getClassCategories()` (lines 341-350) is uncapped, so all 9 condition pages hold depth 1 permanently. If the roster is ever meant to stay at depth 1 past 8, that number is the thing to change.

Depth 2: 40 pose pages (from `/poses`, plus up to 3 condition pages each, giving redundancy if `/poses` ever paginates), 9 pose collections (from `/poses/collections` and from their parent condition), 12 style pages (from `/types-of-yoga`), 8 article topic hubs (from `/articles`), the 24 most recent articles (from `/articles`), teachers 9+, and every sub-condition. Roughly 95 URLs plus growth.

Depth 3: every article older than the 24 on `/articles`, reached through its topic hub. Nothing at depth 4.

FIXED ENFORCEMENT RULE (the original was self-contradictory). Do not claim every article gets a link from its parent condition page. That would put every article at depth 2, which nullifies the stated depth-3 tier, and a condition page linking 30 or 100 articles dilutes its own link equity and is unusable. Instead:

- Each condition page carries a curated, fixed-size block of 6 to 8 contextual links: its 3 highest-intent articles, 3 poses drawn from the `poseGroups` already sitting unpublished in `lib/data/condition-pages/*.json` (107 pose entries across 36 groups), and its collection page. Rotate the article slots, do not grow the block.
- Each topic hub paginates and links every article in its topic. That is the guarantee that nothing reaches depth 4: an article always has its topic hub, and a topic hub is always depth 2 because `/articles` is in the footer.
- The depth-4 risk is therefore topic-hub pagination depth, not orphaning. Cap each topic hub at 3 pages (about 72 articles) before splitting the topic; page 4 of a hub would put its articles at depth 4.

Also drop the dangling reference to "the R5 rule in the cluster map." It is not verifiable from this finding and the plan should stand on its own.

IMMEDIATE ACTION AVAILABLE TODAY (this is the part with real value, and it is a linking fix rather than a depth fix): add the 6-to-8-link contextual block to the 9 condition pages and cross-link the 3 teacher pages to the conditions they teach. That converts 12 dead-end pages into hubs without changing any URL's depth, and it uses content the repo already has.

---

## offpage (15)

### [HIGH] The homepage claims 1,200+ reviews against 12 published, which is a manual-action risk and blocks every review-platform play

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/, https://www.myyogaclasses.fit/reviews, https://www.myyogaclasses.fit/teachers/dr-vaishnavi-mayya

**Evidence.** The homepage trust bar renders "1,200+ reviews" alongside a 4.9 rating. https://www.myyogaclasses.fit/reviews renders 12 review items. The teacher page /teachers/dr-vaishnavi-mayya renders "4.8 · 98 reviews" for a roster of three teachers. lib/seo/structuredData.ts carries an explicit comment that Person has no aggregateRating, so no rating is currently emitted in schema, which is the only reason this has not already become a structured-data problem.

**Recommendation.** CORRECTED FINDING — Severity: high (legal/consumer-protection, not primarily algorithmic)

Title: The site publishes six fabricated customer testimonials and a "1,200+ reviews" claim against zero real published reviews.

Corrected evidence:
- Homepage trust bar: `<strong class="font-semibold text-foreground">4.9</strong> ·&nbsp;1,200+ reviews`, wrapped in `<a href="/reviews">` so the claim links straight to its own refutation.
- /reviews renders SIX items (`<figure` x6, `<blockquote` x6, RSC ids r1..r6, all rating 5), not 12.
- Those six are MOCK_REVIEWS, lib/data/landing.ts:274-281, with invented names and cities: Emma R. (Dubai, AE), James P. (Abu Dhabi, AE), Fatima H., Noor S., Mohammed A., Priya N. (Bengaluru, IN). They are live because getFeaturedReviews() at lib/data/landing.ts:376-384 ends with `if (!data || data.length === 0) return MOCK_REVIEWS`, and the production reviews table returns zero is_featured+is_approved rows. Supabase is configured (teachers come from the DB: Dr Vaishnavi Mayya, Dr Sangeeta, Dr Hima Bindu — MOCK_TEACHERS starts with "Aarti Deshmukh" and does not appear).
- Per-teacher: rating_count 98 + 312 + 0 = 410 across the full three-teacher roster, from teachers.rating_avg / teachers.rating_count. Also unreconcilable with 1,200+, and also backed by zero review rows.
- No aggregateRating is emitted anywhere (grep returns nothing on /, /teachers, /teachers/[slug], /reviews). structuredData.ts:34-35 explains this as a schema.org vocabulary fact (Person has no aggregateRating property), not as a deliberate policy hedge.

Corrected risk framing:
- The live risk is NOT a Google manual action. No rating markup exists, and even if it did, Google treats on-site reviews about your own business as self-serving and ineligible for LocalBusiness/Organization review snippets; a structured-data manual action, if one ever landed, causes the markup to be ignored while the page still ranks, and has a documented reconsideration path. Do not tell the owner this is unrecoverable.
- The live risk is that six invented customers with invented names and locations are published as genuine testimonials. FTC 16 CFR Part 465 (effective 21 Oct 2024) prohibits creating or disseminating reviews from people with no actual experience of the service, with civil penalties up to $51,744 per violation, and it reaches a global-customer site selling to US buyers. The UK DMCC Act 2024 regime is equivalent. This is the reason to act this week, and it is independent of SEO.

Corrected fix, in order:
1. Delete the fabricated testimonials from the live render. Change lib/data/landing.ts:384 from `if (!data || data.length === 0) return MOCK_REVIEWS;` to `if (!data) return [];` and have TestimonialWall and /reviews render an honest empty state ("Reviews from our first students are coming soon."). Keep MOCK_REVIEWS behind the `!isSupabaseConfigured` branch at line 376 only, so the zero-env preview story survives. This is a code change, not a DB change, and it does take effect live.
2. Fix the number in BOTH places, because one alone is not enough. Set landing.trust_count and landing.trust_rating at /admin/settings, AND change the code fallbacks at app/(marketing)/page.tsx:44 (and lib/data/landing.ts:288, supabase/seed.sql:14). landingSetting() at lib/data/landing.ts:426-431 treats an empty string as unset and falls back to the code literal, so clearing the admin field resurrects "1,200+ reviews". Replace with something evidenceable that is not a count, for example "Live 1:1, 60 minutes" or "Taught by qualified Indian teachers".
3. Zero or blank teachers.rating_avg / teachers.rating_count for all three teacher rows until real reviews exist, and make the teacher card hide the rating block when rating_count is 0 (Dr Hima Bindu already carries 0 and should not be showing a 5).
4. Only after real reviews exist: emit AggregateRating, and put it on Service or Course (the /classes/[slug] Course node already exists and is the natural host), not on Person, which has no such property. Expect no star snippet for self-collected reviews regardless.
5. Trustpilot / Google Business review collection can start immediately, since it is the supply of real reviews that unblocks everything else. No new third-party script is needed for a link-out, so no next.config.ts CSP edit; if you later embed a Trustpilot widget, widget.trustpilot.com must be added to the CSP script-src and frame-src or it breaks in production only.

None of the proposed copy uses em-dashes, reintroduces free-trial wording, calls packs "credits", touches cookies() in the (marketing) group, or adds a cross-currency fallback.

### [HIGH] What NOT to do: the named tactics that would be actively harmful on a new .fit domain

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/next.config.ts, https://www.myyogaclasses.fit/

**Evidence.** A search for yoga and wellness guest-post opportunities surfaced exactly the link-scheme pattern: thedailymeditation.com/write-for-us-share-your-talent-with-our-readers, healthywrites.com/write-for-us/, yoga2all.com/write-for-us-health-and-wellness-blog/ (submissions to a gmail address, yogatoall2016@gmail.com), healthpind.com/write-for-us/, kayawell.com/blog/write-for-us-health (which openly "offers guest posting services for healthcare bloggers and related businesses"), treatwiser.com/write-for-us/, plus a syndicated "Write for Us Health, Lifestyle and Fitness" press release carried on markets.financialcontent.com. Separately verified on-site risks: the homepage claims "1,200+ reviews" against 12 published; a Google Business Profile is not available for an online-only business; and the live CSP header allows scripts only from 'self', checkout.razorpay.com and *.posthog.com.

**Recommendation.** Avoid, specifically: (1) The "write for us" network above. These are paid-placement farms with no editorial gate, they are the exact footprint Google's link spam systems classify, and on a domain with essentially no authority the links carry no equity while the footprint carries risk. (2) Syndicated press-release distribution, including the financialcontent.com-style wire placements. Those links are boilerplate-duplicated across hundreds of mirror domains and are discounted by design. (3) Any AggregateRating or Review schema until the 1,200 figure is reconciled, since a rich-results manual action on a 4-month-old domain is disproportionately damaging. (4) A Google Business Profile at a virtual, coworking or residential address: ineligible, and suspension is a public brand-SERP event. (5) Incentivised or seeded Trustpilot reviews. Trustpilot actively detects them, and a "we detected fake reviews" banner on the brand's own Trustpilot page is a permanent, top-ranking brand-SERP result, which is precisely the problem this site already has with GitHub. (6) Reciprocal or footer-wide link exchanges with other yoga sites. (7) Any third-party badge, review or schema widget dropped in without first adding its origin to the hand-maintained CSP in next.config.ts: the live header is `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://*.posthog.com`, so a Trustpilot TrustBox or similar will fail silently in production only.

### [MEDIUM] No verifiable legal entity exists, which blocks every high-value citation and any knowledge panel

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/legal/terms, https://www.myyogaclasses.fit/about, /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts

**Evidence.** Live /legal/terms reads: "operated by My Yoga Classes (registration / trade-licence details to be inserted, \"we\", \"us\", \"our\")" and carries a standing banner "June 2026 Pending legal review. This is a good-faith draft ... It has not yet been reviewed by a qualified lawyer in any relevant jurisdiction and must be verified before launch." Section 12 sets governing law as "the laws of the United Arab Emirates (Emirate of Dubai)" while /about and the repo README both describe the business as operating from India with Indian teachers. There is no postal address, no registration number and no telephone anywhere on the site. Wikidata returns zero entities for "My Yoga Classes" (wbsearchentities search returned []).

**Recommendation.** Title: Live legal pages ship unfinished placeholder text and a self-contradicting jurisdiction on a site that takes payments

Severity: medium (real trust/E-E-A-T and conversion issue; NOT the gate on off-page work, and not critical).

Corrected evidence:
- /legal/terms and /legal/privacy both render the literal placeholder "My Yoga Classes (registration / trade-licence details to be inserted)".
- Both pages carry a live banner: "Last updated: 21 June 2026 Pending legal review. This is a good-faith draft for a service that accepts students worldwide, operated from India with payments settled in INR and AED. It has not yet been reviewed by a qualified lawyer in any relevant jurisdiction and must be verified before launch."
- /legal/terms contradicts itself: that banner says operated from India, while its own Section 12 says "These Terms are governed by the laws of the United Arab Emirates (Emirate of Dubai)". This is one document disagreeing with itself, not terms-vs-/about. /about makes no operator claim at all.
- No postal address, registration number or telephone on /legal/terms, /about, /contact, /legal/privacy or the footer. Only hello@myyogaclasses.fit.
- Wikidata wbsearchentities returns 0 results for the brand.

Corrected location: the Organization JSON-LD is at /Users/shalomp/YOGA_WEBSITE/app/layout.tsx:85-104, NOT lib/seo/structuredData.ts (which has no Organization node). The footer is /Users/shalomp/YOGA_WEBSITE/components/marketing/Footer.tsx and is code-editable.

Corrected recommendation, in order:
1. Do the two things that need no entity decision and can ship this week. Claim the Trustpilot profile now using hello@myyogaclasses.fit, which already matches the domain and satisfies their verification. Create a Wikidata item now with brand name, official website (P856), Instagram handle, industry and inception; Wikidata has no notability bar and needs sourceable details, not a licence number. Add both to the Organization sameAs array.
2. Separately, have the owner settle the operating entity. This is a legal and tax decision (INR and AED settlement, GST vs VAT), not an SEO one. Flag to them only that the terms banner says India while Section 12 picks Dubai law, and that one of the two is wrong.
3. Once settled, delete the "Pending legal review ... must be verified before launch" banner and replace "details to be inserted" on BOTH /legal/terms and /legal/privacy, and align Section 12 with the chosen entity.
4. Then mirror the string into the Organization node at app/layout.tsx:85-104, which is already typed WithContext<Organization> from schema-dts so the fields typecheck: add legalName, address as a PostalAddress (addressCountry at minimum), foundingDate, and identifier for the licence or CIN. Add the same block to Footer.tsx.
5. Skip Crunchbase, Tracxn and the SHRM vendor directory. They are wrong for a B2C worldwide 1:1 yoga service. Skip Google Business Profile too: online-only businesses with no in-person customer contact are ineligible, so there is no local pack to win and a published postal address buys far less here than in a normal local-SEO brief.
6. Do not sequence the rest of the off-page programme behind this. Nothing above blocks Instagram, YouTube, Yoga Alliance teacher profiles or digital PR.

### [MEDIUM] A LinkedIn company page already exists and is missing from sameAs, so the one free entity edge is unclaimed

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts, https://www.linkedin.com/company/myyogaclasses-fit, https://www.instagram.com/myyogaclasses.fit/

**Evidence.** linkedin.com/company/myyogaclasses-fit returns HTTP 200 and resolves to a real page: name "Myyogaclasses.fit", tagline "Your body is different. Your yoga should be too. ⭐", industry "Wellness and Fitness Services", size "2-10 employees", website https://www.myyogaclasses.fit/. The control slugs /company/myyogaclasses and /company/my-yoga-classes both return 404, confirming the 200 is a real page, not a soft-200. Meanwhile the live Organization JSON-LD on the homepage has exactly one sameAs entry: ["https://www.instagram.com/myyogaclasses.fit/"], and lib/seo/structuredData.ts declares a single exported constant INSTAGRAM_URL. The footer likewise links only Instagram. Instagram itself is real and active: 40 followers, 3 following, posts and reels through August and September 2026, bio "Every body is different. Your yoga should be too. 🧘 1:1 Personalized Yoga Sessions 🌿 Heal • Strengthen • Balance", link www.myyogaclasses.fit. Note the LinkedIn tagline says "Your body" while Instagram says "Every body": the taglines already disagree.

**Recommendation.** Retitle: "Site does not reciprocate the existing LinkedIn -> site link, and the LinkedIn entity name disagrees with the Organization name."

Severity: medium. Rationale is effort, not impact: a one-line change with modest entity/AI-citation upside, not a ranking lever. Note the profiles are tiny (2 LinkedIn followers, 40 Instagram followers), and note that LinkedIn already links out to the site via its own JSON-LD `"sameAs":"https://www.myyogaclasses.fit/"`, so only the return leg is missing.

DO (specific, constraint-safe):
1. In lib/seo/structuredData.ts, replace the line-20 INSTAGRAM_URL constant with an exported array, keeping a named Instagram export so the Footer's label and icon still resolve:
   export const INSTAGRAM_URL = "https://www.instagram.com/myyogaclasses.fit/";
   export const LINKEDIN_URL = "https://www.linkedin.com/company/myyogaclasses-fit";
   export const SOCIAL_PROFILES = [INSTAGRAM_URL, LINKEDIN_URL];
   Then app/layout.tsx:91 becomes `sameAs: SOCIAL_PROFILES`, and components/marketing/Footer.tsx renders one <a> per profile so the two surfaces cannot drift.
2. Fix the NAME mismatch, which is the reconciliation signal that actually matters. Rename the LinkedIn page from "Myyogaclasses.fit" to "My Yoga Classes" so it matches the Organization `name` and the Instagram display name. This is a LinkedIn admin change, not a code change. If the owner wants to keep the domain-style string discoverable, add it to the code as `alternateName: "Myyogaclasses.fit"` (the string that actually exists in the wild) rather than the invented "MyYogaClasses".
3. If you want the tagline unified, put it in the right property: add `slogan: "Your body is different. Your yoga should be too."` to the Organization node and make Instagram's bio use that same line. Leave og:description alone, it is the SERP snippet and is carrying the keywords.

DO NOT:
- Do not add address / PostalAddress. It contradicts the deliberate `areaServed: "Worldwide"` decision documented in the comment right above it in app/layout.tsx, and it risks a local-business read that works against global SEO.
- Do not add legalName or foundingDate until real values exist. Inventing them is fabricated structured data.
- Do not make og:description identical to the social tagline.

### [MEDIUM] Correction: yogaia.com and allyogatraining.com are structurally unpitchable, and no tier-1 publication ranks for the head term

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** medium
- **Locations:** https://yogaia.com/blog/best-online-yoga-classes, https://www.allyogatraining.com/best-online-yoga-classes

**Evidence.** yogaia.com/blog/best-online-yoga-classes is published by Yogaia, a competitor platform; author Kaisa Soininen; Yogaia is its own #1 pick with repeated "Start Your Free Trial" buttons; the nine entries are Yogaia, Alo Moves, Yoga with Adriene, Down Dog, Yoga with Kassandra, DoYogaWithMe, Peloton, Five Parks Yoga, Sarah Beth Yoga. It contains no mention of 1:1 private yoga or Indian teachers. allyogatraining.com/best-online-yoga-classes carries "Last Updated | January 1, 2025", author "Ysabel", copyright "All Yoga International ltd" (a Thailand-based YTT school); its nine entries are Omstars, Alo Moves, Yoga with Adriene, Yoga with Tim, DoYogaWithMe, Yoga with Kassandra, Sarah Beth Yoga, Boho Beautiful, Five Parks Yoga, all on-demand video or YouTube channels, none 1:1. Separately, a targeted search for Verywell Fit, Healthline, Forbes Health or Wirecutter roundups of online yoga returned none of them in the ranking set for this term.

**Recommendation.** Keep the diagnosis, fix the reason and replace the target list.

Reason (corrected): yogaia.com and allyogatraining.com are unpitchable because both publishers are self-interested, not because the SERP is on-demand-only. Yogaia's own comparison table advertises live two-way-camera classes and allyogatraining's #1 Omstars has "live sessions every single day", so a live product is not category-excluded from this SERP. Yogaia is a competitor platform that self-ranks #1 with 8 "Start Your Free Trial" buttons on the page; allyogatraining is All Yoga International ltd, a Bali/Thailand YTT school monetising the page toward its own teacher trainings, last substantively updated January 1, 2025. Neither will add a competitor or a business outside its funnel. That is the whole argument, and it generalises to any roundup owned by a platform or a school.

Target list (corrected): do NOT reallocate to the 1om1.net pages. https://1om1.net/blogs/private-yoga-blog/best-5-online-private-yoga-platforms and https://1om1.net/blogs/private-yoga-blog/top-10-interactive-online-yoga-platforms-us rank #1 and are both published by ONE OM ONE and authored by its founder Ito Jimmy, each self-ranked #1. ONE OM ONE sells 1-on-1 yoga using teachers in lower-cost regions for students in higher-cost markets at $68/mo for 30 classes, which is this site's model. Those are strictly worse pitch targets than Yogaia.

Pitch instead the independent, non-platform pages that surfaced on the same searches:
1. healthynexercise.com/best-yoga-classes/myyogateacher-review/ ("MyYogaTeacher & 29+ Top Yoga Classes Like MyYogaTeacher.com") — an affiliate review site with no competing yoga product, already ranking on "myyogateacher alternatives", and already structured as a 29-entry list where one more inclusion costs the publisher nothing. Highest-probability single placement.
2. yogitimes.com/article/best-top-online-yoga-video-home-streaming-classes-practice-apps-platforms — independent yoga media, ranks on both the head term and the private-yoga term, no platform of its own.
3. cbinsights.com/company/my-yoga-teacher/alternatives-competitors — not an editorial pitch at all, a claimable company profile in the competitor set for the exact query. Claim the listing rather than emailing anyone.

Keep the finding's advice to stop pitching Verywell Fit, Healthline, Forbes Health and Wirecutter on this term, but state it accurately: none of them appears in the current ranking set for "best online yoga classes" or the private-yoga variants, so an inclusion request has no page to be included in. That is not the same as "they have no online-yoga coverage" (their sites block automated checks and were not verified), and the "weeks for a low hit rate" figure should be dropped as unmeasured. The health-desk angle is still the better tier-1 route and is genuinely specific to this site: 200-hr certified teachers in India teaching condition-specific 1:1 yoga, with the nine existing condition pages (/classes/diabetes, /classes/hypertension, /classes/prenatal and the rest) as the supporting body of work.

### [MEDIUM] Global visitors are shown rupee prices, which silently kills the price-arbitrage pitch and every roundup submission

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/pricing, https://www.myyogaclasses.fit/api/region, /Users/shalomp/YOGA_WEBSITE/lib/razorpay/catalog.ts, /Users/shalomp/YOGA_WEBSITE/supabase/migrations/0036_international_currencies.sql

**Evidence.** Live /pricing renders only INR: "1-Session Pack ... ₹999", "5-Session Pack ... ₹4,499", "10-Session Pack ... ₹7,999", and a footnote "Prices shown in INR. One-time payment, no subscription. Book from anywhere in the world." GET /api/region returns {"country":"IN","currency":"INR","locale":"en-IN"}. supabase/migrations/0036_international_currencies.sql widens the CHECK to ('INR','AED','USD','GBP','EUR') but states in its own header "this migration deliberately inserts NO prices" and "A currency only goes live once EVERY active plan has a plan_prices row for it". lib/razorpay/catalog.ts resolvePackBySlug returns null when no plan_prices row exists for a currency, and effectiveCurrency downgrades to INR. So a US, UK or EU visitor sees rupees.

**Recommendation.** CORRECTED FINDING: Global visitors see rupee prices and a two-market meta description, which reads as a domestic Indian service. Severity medium, not high.

CORRECTED EVIDENCE: live /pricing (prerendered, x-nextjs-prerender: 1) shows ₹999 / ₹4,499 / ₹7,999. Only six plan_prices rows exist live, INR 99900/449900/799900 and AED 5900/27500/49900. No USD, GBP or EUR rows, so effectiveCurrency() downgrades those visitors to INR. The /pricing meta description is "Honest yoga pricing in AED and INR. One-time session packs, no subscription."

CORRECTED PRICE MATH at USD/INR 96.07 (2026-09-15): 5-pack ₹899.80/session = $9.37. 10-pack ₹799.90/session = $8.33. 1-pack ₹999 = $10.40. Versus the $60-120 US private rate that is a 6.4x to 14.4x gap. Brief item 12's "$23-24/session" is wrong and is NOT the current AED figure either: live AED 5-pack is AED 275, i.e. AED 55/session = $14.98. $23-24 is the retired AED 435 pricing. Item 12 should be struck and replaced with "$8.33 to $10.40 per 60-minute live 1:1".

CORRECTED RECOMMENDATION, in this order.

Step 1, ship now, zero dependencies, both ISR-safe static strings. (a) app/(marketing)/pricing/page.tsx line 15: replace the description with one that carries no market signal, e.g. "One-time packs of live 60-minute 1:1 yoga sessions with teachers in India. No subscription, book in your own time zone." (b) components/marketing/PricingTeaser.tsx line 411: the footnote currently reads "Prices shown in {displayCurrency}. One-time payment, no subscription. Book from anywhere in the world." Make the rupee deliberate instead of accidental, e.g. "Prices shown in {displayCurrency}. Your card converts automatically at your bank's rate. One-time payment, no subscription, students in every time zone." No em-dashes, no free-trial wording, and neither string is DB-driven so the edit actually lands.

Step 2, do NOT add USD or GBP plan_prices rows until Razorpay International acceptance is live on the account. create-order (app/api/razorpay/create-order/route.ts:84-94) builds the order in the resolved currency, and the bank-transfer rail is AED-only (app/api/payments/intent/route.ts:129,173), so pricing USD today replaces a cosmetic problem with declined payments for exactly the US and UK visitors the outreach is meant to attract. Sequence: enable International, then price all three active plans in USD and GBP together in /admin/plans (pricedCurrencies() requires full coverage or the currency stays dark), then test a live USD order.

Step 3, separately worth doing and independent of currency: add Product + AggregateOffer JSON-LD to /pricing. The live page has zero Product or AggregateOffer markup. Emit one Offer per pack with priceCurrency set to whatever effectiveCurrency resolves, and availability https://schema.org/OnlineOnly.

The pitch line to lead with, once step 1 ships, is "$8-10 per 60-minute private 1:1 against a $60-120 US studio rate", which is a stronger number than the brief or the original finding claimed.

### [MEDIUM] Doctor-credentialed yoga teachers is the one genuinely novel PR hook, and nothing on the site packages it for a journalist

- **Verdict:** partially-correct | **Effort:** substantial | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/teachers, https://www.myyogaclasses.fit/teachers/dr-vaishnavi-mayya, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages

**Evidence.** All three teachers hold Indian medical or clinical qualifications, stated on the live site. /teachers/dr-vaishnavi-mayya: "MD in Clinical Yoga & Naturopathy ... holding an MD in Clinical Yoga and a Bachelor of Naturopathy and Yogic Sciences. With 9 years of personal practice and 6 years of clinical teaching experience, I specialize in evidence-based yoga interventions for lifestyle disorders, including cardiovascular, respiratory, and musculoskeletal conditions, as well as women's health." /teachers listing also shows "Dr Sangeeta, Yoga and Naturopathy Doctor, Prenatal and Postnatal Yoga" and "Dr Hima Bindu, Medical Yogic Sciences · 8 years". By contrast the competitor positioning that dominates this space is volume-based: MyYogaTeacher markets "450+ expert Indian teachers" and "240,000+ students", and Shvasa markets "50,000+ students, 40+ countries". Neither claims clinical credentials. There is a real peer-reviewed spine to attach this to: PMC7981931 (health worker-led 3-month yoga intervention on blood pressure, randomised controlled multicentre trial in primary care), PMC4029555 (yoga on blood pressure and quality of life, controlled primary-care trial), PMC6963794 (NMB-2017 India trial, validated yoga protocol on dyslipidemia in diabetes patients), PMC8330799 (barriers and facilitators to implementing yoga for hypertensive patients in primary care).

**Recommendation.** CORRECTED FINDING
Title: The site's clinical credentials are real and verifiable, but the site's own copy describes those teachers by the weakest credential they hold, and there is no page that collects the clinical angle.

Corrected evidence: the three teacher records and Dr Vaishnavi Mayya's bio reproduce exactly as quoted. No /evidence, /research or /press page exists (23 sitemap URLs, zero repo hits for trial or PMC terms). All four PMC citations are real and correctly characterised. BUT the differentiation claim is wrong: MyYogaTeacher already publishes BNYS and "Naturopathy and Yoga Physician" teacher profiles (Dr. Ganavi, Srishti, Dr. Kaviya) across 116 teacher URLs, and its live homepage says "200+ expert Indian teachers", not 450+. Shvasa already cites research percentages on its homepage. So the credential is a differentiator of concentration (3 of 3 clinically qualified vs a minority of 200) rather than a category-unique hook, and a health desk can source "the yoga teacher who is also a doctor" from a bigger, US-marketed competitor. Severity is medium, not high.

Corrected recommendation, in priority order:

1. Do the in-code copy fix first. It costs one PR, needs no outreach, and is where the credential is currently being thrown away. Replace the 200-hr framing at app/(marketing)/teachers/page.tsx:21, app/(marketing)/about/page.tsx:24 and :37, and components/marketing/HowItWorks.tsx:10. Suggested subhead for /teachers, no em-dashes: "All three of our teachers hold Indian clinical qualifications in yoga and naturopathy, BNYS or MD in Clinical Yoga, on top of Yoga Alliance certification." Update the /teachers and /about meta descriptions in the same files to carry "clinically qualified" rather than "Yoga Alliance trained". These are code, not admin_settings, so the edit does reach the live site.

2. Shift the claim from "our teachers are doctors" to the one thing the competitor cannot match: every teacher on the roster is clinically qualified, and each condition page is taught by the teacher whose clinical speciality matches it. Add a teacher-to-condition cross-link block on each /classes/[slug] page (Dr Vaishnavi Mayya to diabetes, hypertension and pain-relief per her stated cardiovascular, respiratory and musculoskeletal specialities; Dr Sangeeta to prenatal). This also fixes the dead-end internal linking already logged as item 3, so it pays twice.

3. Build the evidence hub, but scope it down and expect on-page and AI-citation value, not press. One /evidence route in (marketing), anon client, revalidate 300, generateStaticParams over the same 9 slugs, reading lib/data/condition-pages/*.json. Reuse the existing disclaimer block verbatim from the condition pages. Critical framing constraint the original finding understates: PMC7981931, PMC4029555 and PMC8330799 study group, health-worker-led, in-person yoga in primary care in Nepal and Sweden, and PMC6963794 is a stratified India protocol trial. None studies cross-border live 1:1 online yoga, and none involves this service. Attribute every effect to the named trial and its population, never to a My Yoga Classes session, and keep migration 0024's positive-but-hedge-free house style with the caveat only in the bottom disclaimer, so the page does not reintroduce per-claim medical hedging or drift into a therapeutic claim under UAE and India ad rules.

4. Drop pitch shape (2) as written, or fix its dependency first. The $10 per session figure is correct at current INR pricing (₹4,499 for 5, ₹7,999 for 10, so ₹900 and ₹800 per session), which also corrects the first-pass audit's stale "$23-24". But the live pricing page renders INR only and states "Prices shown in INR", so there is no dollar number for a US journalist to quote. Price at least USD in plan_prices (never via the price_base_cents fallback, which is INR) before pitching an arbitrage story.

5. Before any outreach, fix the free link that is already pointing at this brand: github.com/Shalom-P/yoga-website is public, outranks the site for brand-adjacent queries, and its description still says PayPal and AU customers with a dead homepage link.

### [MEDIUM] Correction: the Yoga Alliance route is the RYT teacher directory, not an RYS school listing

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** medium
- **Locations:** https://www.myyogaclasses.fit/teachers, https://www.myyogaclasses.fit/about

**Evidence.** Yoga Alliance's directory policy describes the directory as a listing of Registered Yoga Schools, Registered Yoga Teachers and approved Continuing Education Providers, and states that RYS registration requires that "the school's syllabus, trainers, and faculty have been assessed and verified by Yoga Alliance", with the designation existing to attract teacher-training trainees. This business runs no teacher training: /about describes it as "a small studio with real teachers", and /pricing sells only 1:1 session packs. The site does however claim "Every teacher is at least 200-hr Yoga Alliance certified" on /teachers and "Every teacher is a 200-hr Yoga Alliance certified professional" on /about.

**Recommendation.** CORRECTED FINDING: the site makes an unsubstantiated Yoga Alliance claim in four public locations, and the teachers appear ineligible for the RYT directory that would back it up.

Evidence: /teachers and /about state every teacher is "200-hr Yoga Alliance certified" (verified live). But the teachers' own credential data on that same page lists only Indian university degrees: BNYS + MD in Clinical Yoga, Doctor of Yogic Sciences, and one empty array. Yoga Alliance requires proof of completion of a Registered Yoga School training for RYT registration and does not accept yoga or naturopathy university degrees. So the claim is very likely false as written, and none of the three is findable in the YA directory.

RECOMMENDATION, in priority order.

STEP 1 (do this week, zero dependencies). Fix the claim in all four hardcoded locations. These are in code, not admin_settings, so a deploy actually changes the live site. Replace the Yoga Alliance assertion with the credentials the teachers demonstrably hold, which are a STRONGER E-E-A-T signal for a site whose best content is nine medical-condition pages. An MD in Clinical Yoga outranks an RYT-200 for "yoga for diabetes" trust. Proposed copy, no em-dashes, "1:1" framing kept, no free-trial wording:
- app/(marketing)/teachers/page.tsx:10 (meta description): "Meet our qualified yoga teachers from India. Each holds a university qualification in yoga or naturopathic science and teaches live 1:1 sessions to students around the world."
- app/(marketing)/teachers/page.tsx:21 (subhead): "Every teacher holds a university qualification in yoga or naturopathic science, with years of in-studio experience translated to live online sessions."
- app/(marketing)/about/page.tsx:24: "...brilliant university-qualified yoga teachers in India were teaching empty rooms."
- app/(marketing)/about/page.tsx:37: "Every teacher is a university-qualified yoga professional. Between them they hold a Bachelor of Naturopathy and Yogic Sciences, an MD in Clinical Yoga, and a Doctorate in Yogic Sciences."
- components/marketing/HowItWorks.tsx:10: "Tell us your level and goals. We'll pair you with the right qualified teacher from India, or pick your own."
Also change the placeholder at components/admin/TeacherFormDialog.tsx:347 from "RYT-200 (Yoga Alliance)" to "MD in Clinical Yoga" so the admin UI stops seeding a credential the roster does not have.

STEP 2 (the real off-page win, replacing the RYT idea). Fill in each teacher's empty or thin `certifications` array with the issuing INSTITUTION name, then mark those up. Right now Person JSON-LD on /teachers/[slug] carries no `hasCredential`. Add a `hasCredential` EducationalOccupationalCredential node per teacher with `credentialCategory` and a `recognizedBy` Organization naming the issuing university. That is a verifiable, entity-linkable authority signal that costs one deploy, versus months and tuition for RYT.

STEP 3 (conditional, not now). The RYT directory route stays available and the mechanism is real: app.yogaalliance.org/robots.txt blocks nothing and publishes sitemap_teachers_1.xml and _2.xml, and profiles are indexed. But it only unlocks if a teacher actually completes an RYS-registered 200-hr training. Treat it as a hiring or professional-development decision, not an SEO task. Do not budget it as a citation-building sprint.

Do NOT apply for RYS. That part of the original finding is correct and verified: /pricing sells only 1:1 session packs (₹999 / ₹4,499 / ₹7,999), there is no syllabus to submit.

### [MEDIUM] Verified directory targets, including one dead one that appears on every yoga-directory listicle

- **Verdict:** unverified | **Effort:** moderate | **Impact:** medium
- **Locations:** https://happytrainers.com/blog/3-best-platforms-for-online-yoga-classes/, https://healthynexercise.com/best-yoga-classes/myyogateacher-review/, https://www.crunchbase.com/, https://vendordirectory.shrm.org/category/employee-wellness-fitness, https://www.yogatrail.com/

**Evidence.** Liveness checked by HTTP request. DEAD: www.yogatrail.com returns 301 to https://www.buzzwoo.de/projekte-kunden/yogatrail, the portfolio page of the agency that built it, so the directory no longer exists. LIVE and relevant: happytrainers.com (Brampton, Ontario marketplace; explicitly offers "Become a yoga instructor" and "Join as a professional" enrolment paths, and runs the "3 Best Platforms for Online Yoga Classes (2026 Review)" article that already ranks); healthynexercise.com/best-yoga-classes/myyogateacher-review/ (titled "MyYogaTeacher & 29+ Top Yoga Classes Like MyYogaTeacher.com", run by "Mr. Healthy" and "Ms. Exercise", lists 28+ platforms each with an "Open website" button that appears to carry no rel=nofollow); yogafinder.com (200); vendordirectory.shrm.org/category/employee-wellness-fitness (407 listed employee wellness and fitness providers, accepts vendor listings). Crunchbase and Tracxn both carry full profiles for the direct competitors (Shvasa: founded 2021, Vikalp Jain and Arunima Singhdeo, $717K over 2 rounds; Ompractice: Northampton US, 2017, Christopher Lucas and Sam Tackeff), and both accept self-submitted company profiles.

**Recommendation.** Work them in this order, all after the legal-entity string is fixed so the citations are consistent from the start. (1) happytrainers.com: create three instructor profiles, one per teacher, since it is a marketplace with an open provider path and it already ranks for the target term, so you get both a citation and referral traffic. (2) healthynexercise.com: email the contact form asking to be added to the "29+ alternatives" list; the page has 28 entries and near-zero editorial standard, so inclusion is close to automatic, and the "Open website" links appear dofollow. Value is low but cost is ten minutes. (3) Crunchbase and Tracxn: self-submit the company profile with founder, founding date, headquarters and website. These are the two strongest entity corroborators available without press coverage, and Google reads Crunchbase for organisation reconciliation. (4) SHRM vendor directory under employee wellness and fitness, once the entity exists. Skip yogatrail.com entirely and delete it from any directory list you are working from.

### [MEDIUM] The iOS app is on TestFlight but has no App Store listing, forfeiting a free high-authority entity citation

- **Verdict:** unverified | **Effort:** moderate | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_IOS_APP/submission/BLOCKERS.md, /Users/shalomp/YOGA_IOS_APP/README.md, /Users/shalomp/YOGA_IOS_APP/capacitor.config.ts

**Evidence.** An iTunes lookup for bundleId fit.myyogaclasses.app returns {"resultCount":0,"results":[]}. A store search for "my yoga classes" returns five results, none of which is this business: MyYogaTeacher: Live Yoga Class (Myyogateacher, Inc.), ClassPass, Mindbody, Yoga Anytime, The Yoga Collective. ~/YOGA_IOS_APP/submission/BLOCKERS.md records "**1.0 (3) is on TestFlight**". ~/YOGA_IOS_APP/README.md confirms Bundle ID fit.myyogaclasses.app, display name "My Yoga Classes", web origin https://www.myyogaclasses.fit. Competitor MyYogaTeacher holds both an App Store listing (id1452509353) and a Google Play listing (com.myyogateacher.studentapp), which is part of why its entity is unambiguous to Google.

**Recommendation.** Ship the App Store submission and treat it as an SEO and entity task, not only a product one. An App Store product page is a high-authority, independently-verified page carrying the exact brand name, the developer legal name and a link to the site, and Apple's developer name field is one of the corroborating sources Google uses when deciding whether an entity is real. Two specifics once it is live: put the App Store URL into the sameAs array from the LinkedIn finding, and make the App Store "Developer Website" field point at https://www.myyogaclasses.fit exactly, not a Vercel preview, since the same mistake already made on GitHub would be repeated. Also note the app's own capacitor.config.ts comment claiming the marketing pages "render fully dynamically, a cookies() call in the marketing layout defeats their declared ISR windows" is now stale: live headers on /, /pricing, /teachers, /classes/diabetes and /about all return x-nextjs-prerender: 1 with x-vercel-cache: HIT and /about at age 255494, so ISR is intact and that comment should be corrected before it misleads a future change.

### [MEDIUM] No Wikidata entity exists, and it is the cheapest structural step toward a knowledge panel

- **Verdict:** unverified | **Effort:** moderate | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts, https://www.wikidata.org/

**Evidence.** The Wikidata API (action=wbsearchentities, search="My Yoga Classes", language=en) returns an empty search array, so no item exists. The live Organization JSON-LD supplies name, url, logo, description, areaServed "Worldwide", knowsLanguage ["en"] and a contactPoint, but no legalName, no address, no founder, no foundingDate, no alternateName and no identifier, so there is nothing for an external knowledge base to reconcile against.

**Recommendation.** Do not create a Wikidata item yet. Wikidata requires structural notability, meaning at least one serious independent source, and a self-created item for a company with no press coverage will be nominated for deletion, which is a worse outcome than absence. Sequence it: fix the legal entity, get the App Store listing and Crunchbase profile live, land one or two genuine press or roundup placements from the PR angles above, then create the Wikidata item citing those. In the meantime do the on-site half now, since it costs nothing: extend the Organization node in lib/seo/structuredData.ts with legalName, alternateName, foundingDate, founder, address and a sameAs array covering LinkedIn, Instagram and later Crunchbase and the App Store. Google forms entities from the intersection of your own markup and independent corroboration, and right now only one side of that intersection is even attempted.

### [MEDIUM] Partnership link angles need a citable asset first, and 107 unpublished pose entries are the obvious raw material

- **Verdict:** unverified | **Effort:** substantial | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages, https://www.myyogaclasses.fit/classes/diabetes, https://www.myyogaclasses.fit/classes/prenatal

**Evidence.** lib/data/condition-pages/ holds structured pose data (per the established audit, 107 entries across 36 poseGroups with Sanskrit name, English name and description) that is not published. The nine live condition pages at /classes/{diabetes,hypertension,prenatal,hormonal-health,pain-relief,mental-health,weight-loss,geriatric,kids-yoga} run roughly 930-980 words each and are internal-linking dead ends reachable only from nav and footer. The teacher roster maps cleanly onto the highest-value conditions: Dr Vaishnavi Mayya covers "cardiovascular, respiratory, and musculoskeletal conditions, as well as women's health", Dr Sangeeta covers "Prenatal and Postnatal Yoga".

**Recommendation.** Patient communities and telehealth blogs link to references, not to booking pages, so give them a reference. Publish the pose data as a free, non-gated, printable per-condition sequence on each condition page (Sanskrit name, English name, description, contraindication note), with a plain HTML page anyone can cite. Then approach in this order, leading with the resource and not with the service: diabetes and hypertension patient organisations and their resource pages, where the ask is inclusion in an existing "exercise and movement" resource list; prenatal communities, where Dr Sangeeta's postnatal specialisation is the differentiator and the sequence-plus-contraindication format is what moderators will accept; corporate wellness and employee benefit marketplaces, via the SHRM vendor directory and the vendor lists at wellable.co and myshortlister.com, where the pitch is a per-session price that fits a benefits budget without a subscription commitment; telehealth adjacency, where the angle is that a doctor-credentialed teacher is a referral endpoint a clinician can actually name. In every case attribute claims to the named trials and never to the service, and keep the claim-safe framing already used on /classes/[slug].

### [LOW] The public GitHub repo owns the brand SERP, and the live site is absent from it entirely

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** https://github.com/Shalom-P/yoga-website, https://raw.githubusercontent.com/Shalom-P/yoga-website/main/README.md, /Users/shalomp/YOGA_WEBSITE/README.md

**Evidence.** A web search for the exact string "myyogaclasses.fit" returns github.com/Shalom-P/yoga-website as result #1, titled "GitHub - Shalom-P/yoga-website: Conversion-first yoga studio web app — Next.js 16 + Supabase + PayPal + Google Meet. AU customers, IN teachers." www.myyogaclasses.fit does not appear anywhere in the result set. The search summariser concluded: the domain "appears in GitHub documentation" and is "primarily referenced in technical development documentation rather than as an active public website." GitHub API confirms: description contains "PayPal" and "AU customers" (both retired: the repo's own README now says "UAE + India customers" and "Razorpay"); homepage=https://yoga-website-seven-mocha.vercel.app which returns status=404; topics=[]; stargazers_count=0; forks_count=0; created_at=2026-05-28; pushed_at=2026-09-13 (actively pushed, so it keeps getting recrawled). The raw README at raw.githubusercontent.com exposes hello@myyogaclasses.fit, the /admin and /teacher route structure, and the full architecture.

**Recommendation.** Retitle: "Stale public repo metadata points at a dead 404 and is the only indexed document mentioning the domain (cosmetic; the real issue is that the site is not indexed at all)."

Severity: low. Not critical. Verified zero traffic impact: the repo appears only for the raw domain string "myyogaclasses.fit", which has effectively no search volume, and it does not appear for any commercial query (a search for 1:1 online yoga with Indian teachers returns myyogateacher.com eight times out of nine and no GitHub result).

Corrected evidence:
- Keep: repo public, description names retired PayPal/"AU customers", homepage = https://yoga-website-seven-mocha.vercel.app which returns 404, topics empty, 0 stars/forks/watchers/subscribers.
- DROP the "leaked support address" claim. hello@myyogaclasses.fit is printed in plain text on the live homepage, /contact and /faq. It is the published support address, not a leak.
- DROP the "exposed admin route map" claim as a finding of its own. Live robots.txt already publishes Disallow: /admin, /dashboard, /api, and those routes are gated by middleware plus requireAdmin()/requireTeacher().
- DROP "the homepage field is what Google reads as the canonical destination." The rendered link carries rel="noopener noreferrer nofollow". It transmits no ranking signal and is not a canonical.
- ADD the decisive fact: `site:myyogaclasses.fit` returns zero URLs from the domain. The site is not in the index. GitHub is not outranking it, it is filling a vacuum.

Corrected recommendation:
1. Do NOT make the repo private as an SEO action. It removes the one result and the SERP goes empty; the live site still will not appear, because it is not indexed. Private-vs-public is a security and portfolio decision, not a ranking one, and should be argued on its own merits.
2. Do fix the metadata, as 30-second housekeeping that also stops the repo describing a retired payment processor and a retired market. The exact commands in the finding are fine and I confirmed the proposed description contains no em-dash (the CURRENT description does contain one):
   gh repo edit Shalom-P/yoga-website --description "Source for myyogaclasses.fit, a live 1:1 online yoga studio. Next.js 16, Supabase, Razorpay." --homepage "https://www.myyogaclasses.fit" --add-topic yoga --add-topic nextjs --add-topic supabase
   Expected benefit: the one indexed document describing the brand stops saying "PayPal" and "AU customers", and the dead 404 link is replaced. Expect no ranking movement.
3. Promote the real item to critical in its own finding: the site has no Google Search Console verification anywhere in the codebase (no google-site-verification string in the repo; app/layout.tsx metadata at lines 63-75 has metadataBase/template/locale but no `verification` key) and consequently the 23-URL sitemap at https://www.myyogaclasses.fit/sitemap.xml has never been submitted. The technical baseline is fine (HTTP 200, x-nextjs-prerender: 1, no x-robots-tag, no meta robots, robots.txt allows /), so verification plus sitemap submission is what will actually put the domain in the index. Add `verification: { google: "<token>" }` to the existing metadata export in app/layout.tsx. This is a static metadata field, so it does not call cookies() and does not force the (marketing) group dynamic, and it adds no third-party origin so the CSP in next.config.ts needs no change.

### [LOW] 1om1.net is the single highest-return roundup target, and it is being missed in favour of unpitchable head-term pages

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** https://1om1.net/blogs/private-yoga-blog/best-5-online-private-yoga-platforms, https://1om1.net/blogs/private-yoga-blog/top-10-interactive-online-yoga-platforms-us, https://1om1.net/blogs/private-yoga-blog/7-great-online-personal-training-platforms-for-u-s-yoga-enthusiasts-in-2025

**Evidence.** For "best online private yoga 1-on-1" and for "myyogateacher alternatives", 1om1.net occupies three separate ranking URLs: /blogs/private-yoga-blog/best-5-online-private-yoga-platforms, /blogs/private-yoga-blog/top-10-interactive-online-yoga-platforms-us, and /blogs/private-yoga-blog/7-great-online-personal-training-platforms-for-u-s-yoga-enthusiasts-in-2025. The 5-platform page is run by ONE OM ONE, founder Ito Jimmy, parent company UTL which operates yoga teacher training schools in Japan and Malaysia, offices in Palo Alto, Kuala Lumpur and Tokyo. It self-discloses the conflict: "The first service is operated by my own company, but I aim to provide objective and unbiased information." It links out to all five listed platforms, including two direct competitors (MyYogaTeacher at $89/month, Mywowfit at $158/month, Superprof at $88/month average, Yoga Beyond The Studio at $476/month). The entire page is organised around price per 1:1 session, which is exactly this site's strongest number.

**Recommendation.** CORRECTED FINDING (severity: low)

Title: 1om1.net's private-yoga roundups are a real but minor link target, and the pitch must not be built on price.

Corrected evidence:
- All three URLs are live (HTTP 200) and all three carry followed outbound links to listed platforms (rel="noopener noreferrer", no nofollow). The 5-platform page links to four external competitors; one href is malformed as "https://https://myyogateacher.com/".
- Ranking reality: for "best online private yoga 1-on-1", 1om1.net holds four slots (best-5, top-10, /collections/all_publish, homepage). The 7-platform personal-training URL does NOT rank for that query, and 1om1.net does NOT rank at all for "myyogateacher alternatives", which is owned by ProductHunt, craft.co, ZoomInfo, SaaSHub, Tracxn, Growjo and healthynexercise.com. Drop the "three ranking URLs across both queries" claim.
- The comparison table is organised by monthly cost at a cadence ("Cost for Weekly Sessions", "Cost for 3 Weekly Sessions"), not by price per session.
- The conflict disclosure is real and verbatim, but it is a one-line hedge inside a page whose only stated advantage for the house product is price. Treat it as boilerplate, not as evidence of editorial openness.

Corrected recommendation:
1. Do NOT pitch on price. ONE OM ONE's own pricing page sells up to 30 private 45-min sessions for $68, about $2.27 per session. This site's best rate is ₹799.90 per 60-min session (10-pack), about $9.10. The site is roughly 3x more expensive per hour than the page owner's headline. Any email claiming to undercut every row gets refuted in one reply and burns the contact.
2. If pitching 1om1.net at all, pitch on the axis where the page is genuinely thin and where the house product cannot compete: no listed platform offers condition-specific 1:1 programming. Offer the nine condition pages (diabetes, hypertension, prenatal, hormonal health, pain relief, mental health, weight loss, geriatric, kids yoga) as a "best for a specific health goal" row, plus the doctor-credentialed teacher roster and the 60-minute session length against their 45. Frame it as a category the page is missing, not a row that beats his.
3. Reprioritise the target list. healthynexercise.com/best-yoga-classes/myyogateacher-review/ is the better first pitch: it ranks for the literal "myyogateacher alternatives" head query, runs a 29-entry "Best Yoga Classes" directory with an obvious inclusion path, and is not operated by a competitor. Pitch it before 1om1.net.
4. Before any outreach, fix the asset being pitched. There is no comparison or alternatives page on the site to link to, and /pricing renders INR to a US visitor, so a US reader following a link lands on rupee pricing. Verify the landing surface first.
5. Expected value: one followed link from a low-authority Shopify blog, plus one directory listing. Worth an hour, not a sprint. This ranks below Search Console verification, the bare condition-page titles, and the stale public GitHub repo description.

### [LOW] Correction: a Google Business Profile is not available to this business, and attempting one risks suspension

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** medium
- **Locations:** https://www.myyogaclasses.fit/

**Evidence.** Google's own eligibility guidance states that only businesses which make face-to-face contact with customers are eligible for a Business Profile, and explicitly lists brands, organisations, artists and other online-only businesses as ineligible: an online-only business with no physical location customers can visit and no in-person visits to customers does not qualify. This business delivers 100% of sessions over Google Meet. The live Organization JSON-LD sets areaServed "Worldwide" with no address, and the footer reads "Teachers in India · Students everywhere".

**Recommendation.** Severity: low (informational guardrail, not a site defect).

Title: Google Business Profile is not an available channel for this business. Spend the effort on entity corroboration instead.

Evidence (tightened): Google's Business Profile eligibility page states the test as "If your business either has a physical location that customers can visit, or travels to customers where they are, you can create a Business Profile on Google", and separately rules out rented mailing addresses ("also known as a virtual office, that location isn't eligible") and unstaffed virtual offices for service-area businesses. This business meets neither limb: /about tells visitors the offer is to "bring those teachers to your home (live, online) for less than the price of a single in-person studio class", the sitewide Organization JSON-LD in app/layout.tsx:84-104 carries areaServed "Worldwide" with no PostalAddress, a repo-wide grep finds no LocalBusiness or address markup at all, and the footer reads "Teachers in India · Students everywhere". A brand search returns no existing profile, so nothing is currently at risk.

Recommendation (made specific): Do not create a Business Profile and specifically do not register one against a coworking space, a virtual office or a teacher's home address in India. That fails the eligibility test above and gets suspended at verification or re-verification.

Instead, do the two things that are actually in code and actually move entity corroboration:
1. app/layout.tsx:91 is `sameAs: [INSTAGRAM_URL]` — one edge for the entire brand. Extend that array with profiles that exist or can be created this week and that Google already treats as identity anchors: a LinkedIn company page, a YouTube channel, and the Instagram already there. Keep INSTAGRAM_URL and its siblings as exported constants in lib/seo/structuredData.ts so the footer links and the JSON-LD cannot drift, matching the comment already at lines 17-19.
2. lib/seo/structuredData.ts:35-47 builds Person nodes for /teachers/[slug] with no sameAs. Teachers are the strongest E-E-A-T asset on the site. Add an optional sameAs fed from a teacher profile-links column so a named teacher's own public profile corroborates the Person node.

Drop Crunchbase and Wikidata from the plan for now: both have inclusion bars this entity does not yet clear, and a deleted Wikidata item is a worse signal than no item. Revisit App Store as a citation only once the iOS app actually ships.

Both changes are pure code edits in the (marketing)-adjacent layout and the SEO builder, so they do not touch admin_settings, plan_features or reviews, add no third-party origin to the CSP, and do not force any marketing route dynamic.

---

## conversion (16)

### [CRITICAL] All three legal pages publicly state "Pending legal review", and /legal/refund is submitted to Google in sitemap.xml

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/legal/refund, https://www.myyogaclasses.fit/legal/terms, https://www.myyogaclasses.fit/legal/privacy, https://www.myyogaclasses.fit/sitemap.xml

**Evidence.** Live text at https://www.myyogaclasses.fit/legal/refund: "Pending legal review. This is a good-faith draft for a service that accepts students worldwide, operated from India with payments settled in INR and AED. It has not yet been reviewed by a qualified lawyer in any relevant jurisdiction and must be verified before launch." The same two strings appear on /legal/terms and /legal/privacy (verified by grep on both live responses). All three URLs appear in sitemap.xml (23 <loc> entries total, including https://www.myyogaclasses.fit/legal/refund).

**Recommendation.** CORRECTED FINDING
Title: Three live legal pages open with a "Pending legal review ... must be verified before launch" callout, and two of them also carry an unfilled "registration / trade-licence details to be inserted" placeholder. Terms and Privacy are linked from the login consent line, so every signup passes them.

Corrected evidence:
- Banner renders as the first content block under the H1 on all three pages (amber callout, class "mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10"), verified live on /legal/refund, /legal/terms, /legal/privacy (all HTTP 200).
- Shared strings across all three: "Pending legal review." and "has not yet been reviewed by a qualified lawyer in any relevant jurisdiction and must be verified before launch." The middle sentence DIFFERS on privacy (no INR/AED clause), so do not write a single-string find-and-replace.
- Second leak, terms and privacy only: "My Yoga Classes (registration / trade-licence details to be inserted)".
- Exposure path is the login page, not the sitemap: app/(auth)/login/page.tsx:38-39 renders "By continuing you agree to our Terms and Privacy Policy", confirmed in the live /login HTML. Footer links all three (components/marketing/Footer.tsx:79-81). Sitemap membership is normal and is not the defect.

Corrected recommendation (specific, constraint-safe):
1. Delete the callout div in all three files. It is hardcoded, not DB-driven, so the edit does change the live site: app/(marketing)/legal/refund/page.tsx:19-24, app/(marketing)/legal/terms/page.tsx:21-26, app/(marketing)/legal/privacy/page.tsx:19-23. Edit each file separately, the privacy wording differs.
2. Replace "(registration / trade-licence details to be inserted)" in terms and privacy with the real registered entity name and registration or trade-licence number, or cut the parenthetical entirely and name the operating entity plainly. Shipping a live policy that says its own company details are missing is worse than the banner and is a payment-processor and consumer-law exposure, not just a conversion one.
3. Keep the pages in sitemap.xml. Do not deindex them. Legal pages are a trust signal a global buyer looks for, and removing them from the sitemap addresses nothing.
4. If the legal review genuinely has not happened, commission it. Until it lands, ship the policies without advertising their draft status. Removing an internal caveat does not reduce the policies' force, and the "Last updated: 21 June 2026" line already dates them honestly.
5. While in these files, drop the per-page brand suffix so the layout template is not doubled: change the metadata titles from "Refund policy | My Yoga Classes", "Terms of service: My Yoga Classes", "Privacy policy | My Yoga Classes" to bare "Refund policy", "Terms of service", "Privacy policy", letting app/layout.tsx's "%s · My Yoga Classes" supply the brand once.

No em-dashes used, no free-trial or "no credit card" wording reintroduced, no new third-party origin so next.config.ts CSP is untouched, no cookies() call so (marketing) ISR is preserved (verified these routes are currently x-nextjs-prerender: 1).

### [CRITICAL] The homepage asserts "4.9 · 1,200+ reviews" against 6 published reviews, and fabricates a live availability slot that is hardcoded in the component

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/, https://www.myyogaclasses.fit/reviews, /Users/shalomp/YOGA_WEBSITE/components/marketing/Hero.tsx

**Evidence.** Live homepage above the fold: "★★★★★ 4.9 · 1,200+ reviews". Counting quote glyphs on both pages: `grep -o '“' pg.html | wc -l` = 6 and `grep -o '“' pg_reviews.html | wc -l` = 6. This CORRECTS first-pass item 9, which said 12 reviews; the live count is 6, identical on / and /reviews. Directly below the rating claim the hero renders "Next available / Gentle Hatha with Aarti / Today · 7:00 PM your time · 60 min". That string is hardcoded at /Users/shalomp/YOGA_WEBSITE/components/marketing/Hero.tsx:188 and :194, not read from any availability source, so it shows "Today · 7:00 PM your time" to every visitor in every timezone regardless of whether any teacher is free. "Aarti" is not one of the three teachers on /teachers (Dr Vaishnavi Mayya, Dr Sangeeta, Dr Hima Bindu).

**Recommendation.** Corrected finding: The homepage asserts "★★★★★ 4.9 · 1,200+ reviews" and the site publishes six named testimonials while the reviews table holds ZERO approved featured rows. The six testimonials are hardcoded mock data, and the hero also fabricates a live availability slot.

Corrected evidence:
- Live server HTML on /: "4.9 · 1,200+ reviews" then "Next available / Gentle Hatha with Aarti / Today · 7:00 PM your time · 60 min".
- Hero.tsx:191 ("Gentle Hatha with Aarti") and Hero.tsx:194 ("Today · 7:00 PM your time · 60 min") are string literals with no availability lookup, shown identically to every visitor in every timezone.
- "Aarti" is not a teacher. /teachers = Dr Vaishnavi Mayya, Dr Sangeeta, Dr Hima Bindu.
- The six reviews on / and /reviews carry ids r1-r6 with empty customer_id and empty created_at and match MOCK_REVIEWS at lib/data/landing.ts:274-280 verbatim. Supabase is live (teachers are real UUID rows), so these render via the empty-table fallback at lib/data/landing.ts:384. Real published review count is 0, not 6.
- No AggregateRating JSON-LD anywhere (confirmed 0 occurrences).

Corrected recommendation, in priority order:

1. Remove the fabricated testimonials first. This is a CODE change, not an admin change. In lib/data/landing.ts, keep `if (!isSupabaseConfigured) return MOCK_REVIEWS;` (line 376) so the zero-env preview story survives, and delete the empty-table fallback on line 384 so it returns `[]`. Then give the reviews section and /reviews a real empty state. Suggested copy, no em-dashes: "The first reviews will appear here as students finish their sessions." Keep /reviews in the sitemap only if it carries that honest state plus genuine supporting content, otherwise drop it from the sitemap until real reviews exist rather than shipping a thin page.

2. Fix the trust bar at /admin/settings, where the finding correctly says it lives: set landing.trust_rating and landing.trust_count to empty strings. Hero.tsx already guards on `trustRating &&` at lines 161 and 167, so emptying the setting cleanly removes the stars and the number with no code change. Note that trustCount renders unguarded, so if you want the whole row gone, also empty landing.trust_count. Do not substitute "Every session rated by the student," which is equally unsubstantiated at zero reviews. If a replacement trust signal is wanted, use a fact that is verifiably true from the DB, for example "Three qualified teachers, every session 1:1, 60 minutes."

3. Replace the hardcoded hero card. Either wire it to a real next-available lookup, or replace the two literals with a non-factual line. Suggested: "Sessions from early morning to late evening, in your time zone." Any real lookup must stay out of the (marketing) ISR group's dynamic path: do not call cookies() and do not make the card a server-side per-request read, or ISR dies group-wide. Fetch it client-side after mount from an API route, or drop the claim.

4. Keep the existing decision not to add AggregateRating JSON-LD. There is none on the site today, which is the only reason this is not also a structured-data manual-action risk. Do not add it until the reviews table holds real rows.

### [HIGH] A US, UK or EU visitor is shown INR prices, because zero USD/GBP/EUR rows exist in the live plan_prices table

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/pricing, https://www.myyogaclasses.fit/api/region, /Users/shalomp/YOGA_WEBSITE/lib/razorpay/catalog.ts, /Users/shalomp/YOGA_WEBSITE/supabase/migrations/0036_international_currencies.sql, /Users/shalomp/YOGA_WEBSITE/components/marketing/PricingTeaser.tsx

**Evidence.** Live prerendered /pricing (x-nextjs-prerender: 1, 93,405 bytes) embeds the full plan payload. `grep -o '\\"currency\\":\\"[A-Z]*\\"' pricing.html | sort | uniq -c` returns exactly: 3 AED, 3 INR. No USD, GBP or EUR row exists. amount_cents values present: 99900/5900 (pack-1), 449900/27500 (pack-5), 799900/49900 (pack-10). Chain: lib/razorpay/catalog.ts pricedCurrencies() adds a currency only when `[...activeIds].every((id) => covered.has(id))`, so it returns {INR, AED}; effectiveCurrency() then returns DEFAULT_CURRENCY for USD/GBP/EUR. app/api/region/route.ts applies effectiveCurrency() before responding, so a US visitor gets `{"country":"US","currency":"INR","locale":"en-IN"}`. components/marketing/PricingTeaser.tsx amountIn() returns null for an unpriced currency and gridCurrency falls back to DEFAULT_CURRENCY, so the grid is INR even if the API disagreed. Rendered live text: "₹999 ... ₹4,499 ... ₹7,999" and "Prices shown in INR. One-time payment, no subscription. Book from anywhere in the world." I could not fetch from a US IP (my egress is bom1; /api/region returned {"country":"IN","currency":"INR"} and Vercel stripped a forged `x-vercel-ip-country: US` header, returning IN both times), so the US result is derived from live data plus code, not observed. supabase/migrations/0036_international_currencies.sql says so itself: "this migration deliberately inserts NO prices."

**Recommendation.** TITLE: Every US, UK and EU visitor is quoted in rupees, because no USD/GBP/EUR plan_prices rows exist. Severity: high (on-page conversion only, no search-result surface affected).

EVIDENCE (keep, with two corrections): live prerendered /pricing (93,405 bytes, x-nextjs-prerender: 1) embeds the full plan payload; `grep -o '\\"currency\\":\\"[A-Z]*\\"'` returns exactly 3 AED and 3 INR. The payload is complete because lib/data/landing.ts:360 selects plan_prices with no currency filter. Add: /pricing carries NO Product/Offer/priceCurrency JSON-LD at all (only Organization + FAQPage), so this costs nothing in SERP — it is a checkout-page trust problem, not an SEO one. Add: because /pricing is prerendered, ₹ is in the static HTML for every visitor and is only swapped client-side after /api/region resolves (PricingTeaser.tsx:78-101), so even AED visitors see a rupee flash. Drop the unevidenced "reads as a scam" line.

RECOMMENDATION (sequenced, not a one-step SQL insert):
1. FIRST confirm Razorpay International / multi-currency acceptance is actually live on the account by placing a test USD order. Until it is, inserting the rows makes things worse: app/api/payments/intent/route.ts:101-105 routes every non-AED buyer to Razorpay, create-order (:91-94) would mint a USD/GBP/EUR order, and the AED-only bank-transfer rail (BANK_TRANSFER_CURRENCY = "AED", UAE account in lib/payments/bankTransfer.ts) cannot catch them. Today the INR downgrade at least produces an order the account can capture.
2. If International is NOT imminent, ship the cheap interim instead: the live line already reads "Prices shown in INR. One-time payment, no subscription. Book from anywhere in the world." Extend it with an approximate figure in the visitor's own currency plus a plain statement that the charge settles in INR. That needs no plan_prices rows, no schema change, no new CSP origin, and does not force the (marketing) group dynamic. It removes the unexplained-rupee friction without creating a payment that fails.
3. Once International is live, insert all 9 rows (pack-1, pack-5, pack-10 x USD, GBP, EUR) in one transaction. Partial coverage is silently useless: pricedCurrencies() withholds a currency unless every active plan has a row. 0036 already widened the CHECK, so no deploy is needed for the schema.
4. Expect the flip within ~60s on /api/region (pricedCache TTL) but up to 5 min on /pricing itself (x-nextjs-stale-time: 300), or bust it with POST /api/admin/revalidate.
5. Do not convert the INR figures at spot rate; 0036:14-16 deliberately refuses to guess prices from an exchange rate. Price the international tiers as a commercial decision anchored against the USD 60-120/hr US private-yoga rate. Any specific numbers (e.g. USD 39/175/320) are an illustration for the owner, not a recommendation from this audit.

### [HIGH] There is no working payment rail for any customer outside India and the UAE; the US/UK/EU path ends at an INR Razorpay order on an account without International acceptance

- **Verdict:** partially-correct | **Effort:** substantial | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/api/payments/intent/route.ts, /Users/shalomp/YOGA_WEBSITE/app/api/razorpay/create-order/route.ts, /Users/shalomp/YOGA_WEBSITE/lib/payments/bankTransfer.ts, /Users/shalomp/YOGA_WEBSITE/next.config.ts

**Evidence.** app/api/payments/intent/route.ts gates the entire bank-transfer rail on one line: `if (preferred !== "AED") { const currency = await effectiveCurrency(preferred); return Response.json({ method: "razorpay", currency }); }`. `preferred` for the US is "USD", so a US buyer is routed to Razorpay with currency downgraded to INR. app/api/razorpay/create-order/route.ts then does `const currency = await effectiveCurrency(preferred)` and `resolvePackBySlug(planSlug, currency)`, producing an INR order for ₹4,499. The repo states the account limitation twice: intent/route.ts header comment "AED-via-Razorpay is intentionally NOT offered here — Razorpay International is not enabled", and lib/geo/region.ts "Razorpay settles INR on an Indian account, and International/AED acceptance is an account-level setting." lib/payments/bankTransfer.ts exports BANK_TRANSFER_CURRENCY = "AED" and is only ever reached on the AED branch. The live key rzp_live_T72Mp2h6OQISe1 is present in the shipped JS chunks, so Checkout does open. Inference I could not verify without dashboard access: an international card presented against an INR order on an Indian account without International enabled is declined at the gateway.

**Recommendation.** CORRECTED FINDING (severity: high, dimension: conversion)

Title: Customers outside India and the UAE are quoted and charged in rupees; USD/GBP/EUR are schema-ready but unpriced, so every international checkout downgrades to an INR Razorpay order.

Verified evidence:
- app/api/payments/intent/route.ts:101-106 routes every non-AED customer to Razorpay with `effectiveCurrency(preferred)`.
- app/api/razorpay/create-order/route.ts:91,94 resolves the pack in that downgraded currency.
- Live plan_prices (Supabase REST, 2026-09-16) has INR and AED rows only, for all three active plans. pricedCurrencies() = {INR, AED}, so effectiveCurrency("USD"|"GBP"|"EUR") returns "INR".
- Live /pricing serves ₹999 / ₹4,499 / ₹7,999 with no local-currency equivalent. A US buyer sees a rupee figure on the card and, if they pay, a rupee figure with a cross-border/DCC markup on their statement.
- migration 0036 widened the currency CHECK but inserted no prices, by design.

Not verified, and must not be stated as fact: that an international card is declined. Razorpay's public preferences endpoint for the live key returns activated:true, merchant_country:IN, global:true with VISA/MC/AMEX enabled. Whether International acceptance is actually on is a dashboard fact nobody in this audit can read. Treat it as the first thing to check, not as a finding.

Corrected recommendation, in order:
1. Check the Razorpay dashboard for International payments and multi-currency status on merchant POSHITH SUCHENDRA (key rzp_live_T72Mp2h6OQISe1). Five minutes, and it decides everything below. Confirm by attempting one test-mode order in USD: if International is off the API returns an error on the currency, if it is on the order is created.
2. If International is on: price the three packs in USD, GBP and EUR in /admin/plans. No deploy, no migration (0036 and 0037 are already applied), no code change. pricedCurrencies() picks the rows up within its 60s TTL, effectiveCurrency() stops downgrading, and /api/region plus the pricing grid and create-order all move to local currency together. Set the amounts as a commercial decision, not an FX conversion: ₹4,499 for five sessions is about $53, roughly $10.60 a session, against a $60-120 US private-yoga rate. A US-facing price of $99 for five is still a strong discount and reads as credible where $53 reads as suspect. Note the first-pass audit item 12 is wrong: the 5-pack is about $10.60 a session, not $23-24.
3. If International is off: request it from Razorpay support (KYC, GSTIN/PAN), and until it is granted leave the INR downgrade in place. It is the least-bad state, since an INR order is at least payable by anyone whose card allows international use.
4. Only if Razorpay refuses, add Stripe. CSP edits in /Users/shalomp/YOGA_WEBSITE/next.config.ts, with the correct lines: add `https://js.stripe.com` to the script-src host string on line 16 (not 14), add `https://api.stripe.com https://m.stripe.network` to connect-src on line 32, add `https://js.stripe.com https://m.stripe.network` to the existing frame-src on line 33, and add `https://q.stripe.com` to img-src on line 29. Missing any of these fails only in production.
5. Drop the SWIFT interim entirely. Widening the bank-transfer rail is not configuration: "AED" is hardcoded at intent/route.ts:101,129,173,196,248 and checkout.ts:92, and it would still ask a US consumer to wire $53 to a personal-name account at The Currency Cloud Limited.

Impact framing: this gates paid global acquisition, not organic indexing. Content and internal-linking work on the nine condition pages can proceed in parallel, because the traffic they build takes months to arrive and pricing rows can be added the day acceptance is confirmed. Do not hold the content programme behind this.

### [HIGH] The cross-timezone story, the single biggest objection for a Western buyer of India-based teachers, is one sentence in a collapsed accordion and all real availability is behind two auth gates

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/data/faqs.ts, https://www.myyogaclasses.fit/faq, https://www.myyogaclasses.fit/dashboard/book, /Users/shalomp/YOGA_WEBSITE/app/(auth)/onboarding/page.tsx

**Evidence.** The entire public answer is lib/data/faqs.ts:21-22: q "How does the time-zone thing work?" a "All times you see are in your local time. Your teacher's calendar handles the conversion to IST automatically." That says how conversion works, not which hours exist. No marketing page states a single concrete hour. /dashboard/book returns `307 https://www.myyogaclasses.fit/login?next=%2Fdashboard%2Fbook`, and app/(auth)/onboarding/page.tsx renders "Step 1 of 2" with a mandatory form, so a visitor must sign up AND complete onboarding before seeing one bookable slot. The underlying reality is workable and unsaid: IST is UTC+5:30, so 07:00 America/New_York is 16:30 IST and 07:00 America/Los_Angeles is 19:30 IST, both comfortably inside an Indian teacher's working evening; 19:00 Europe/London is 23:30 IST.

**Recommendation.** CORRECTED FINDING

Title: The cross-timezone story is unanswered in public copy, and the real answer is unusually good: 5am to 11pm IST, seven days. Today no public page states one hour, and all real availability sits behind login plus a mandatory onboarding step.

Corrected evidence:
- lib/data/faqs.ts:21-22 is the entire public answer, and it explains the mechanism, not the hours. On /faq and /pricing the answer text is not in the server HTML at all, only inside the FAQPage JSON-LD; the accordion renders answers client-side on expand.
- Partial mitigations the original finding missed, none of which name an hour: the sitewide footer ("Teachers in India · Students everywhere", "Book a session in your local time") and components/marketing/HowItWorks.tsx:17 ("Choose a slot from live availability, shown in your local time").
- Teacher detail pages (/teachers/dr-sangeeta, /teachers/dr-hima-bindu, /teachers/dr-vaishnavi-mayya) show specialties and languages and no timezone or availability whatsoever.
- Gate: GET /dashboard/book returns 307 to the relative `/login?next=%2Fdashboard%2Fbook`; lib/auth/redirects.ts postAuthTarget() then forces /onboarding ("Step 1 of 2") for anyone without profiles.experience_level.
- CORRECTION to the original: faqs.ts does NOT feed the condition pages. Only /, /faq and /pricing import FAQS; /classes/[slug] emits courseJsonLd only and live /classes/diabetes has zero FAQPage nodes. (This also corrects item 7 of the first-pass audit.)
- CORRECTION to the original: do not justify this by FAQ rich results. Google retired FAQ rich results in Search on 7 May 2026. FAQPage is still parsed for understanding, but there is no SERP feature to win.

Ground truth from the live DB (anon PostgREST, 210 teacher_availability rows, 3 active teachers, all Asia/Kolkata): hour starts 05:00 to 22:00 IST on all 7 days. Converted at current DST: London bookable 00:30 to 17:30 (evening NOT available), New York 19:30 through 12:30 next day (gap 13:00-19:00), Los Angeles 16:30 through 09:30 (gap 10:00-16:00). DST moves these by an hour twice a year, so published copy must stay qualitative.

Corrected recommendation:

1. Rewrite lib/data/faqs.ts:21-22 to state hours honestly and without the UK-evening falsehood:
   q: "I am not in India. What times can I actually book?"
   a: "Your teacher is in India, and live slots run from 5am to 11pm India time, seven days a week. You always see them in your own time zone, so there is nothing to convert. In the UK and Europe that covers the whole morning and afternoon. In the US it lands as early morning through midday, plus a late evening block."
   (No em-dashes, no free-trial wording, "1:1" framing untouched.)

2. Add that same block as static code copy on /pricing and, because condition pages do NOT inherit the shared FAQ, add it explicitly to ConditionLanding.tsx so all nine /classes/* pages carry it. Above the fold on mobile. This is code, not admin_settings or plan_features, so the DB-override constraint does not bite.

3. While editing ConditionLanding, note the separate gap this surfaced: condition pages render `d.faqs` with no FAQPage JSON-LD and no BreadcrumbList. Add both (for parsing and breadcrumb display, not for a retired FAQ rich result).

4. Publish a read-only availability preview at a public URL. Keep the original's architecture: a client component in the (marketing) group fetching a new public GET /api/availability/preview. Middleware skips /api/, so the handler must not call cookies() and the marketing route stays static and ISR-safe. Prefer the route over a direct browser Supabase read even though teacher_availability (0002_teachers.sql:64, `using (true)`) and scheduled sessions (0007) are already anon-readable, because only a server-side join can subtract booked sessions and avoid exposing raw teacher ids. No CSP change is required; `connect-src https://*.supabase.co` is already in the live header.

### [MEDIUM] Production has zero analytics: no PostHog key, no GA4, no GTM, no Search Console tag. Every track() call is a silent no-op

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/lib/analytics/events.ts, /Users/shalomp/YOGA_WEBSITE/next.config.ts, https://www.myyogaclasses.fit/

**Evidence.** I downloaded all 28 chunks referenced by the homepage (1.5 MB total). `grep -ohE 'rzp_(test|live)_[A-Za-z0-9]+'` returns rzp_live_T72Mp2h6OQISe1, proving NEXT_PUBLIC_* inlining works at build. `grep -ohE 'phc_[A-Za-z0-9]{8,}'` returns nothing, and `grep -l "posthog-js\|i.posthog"` matches no chunk at all, meaning the minifier dropped the whole `if (!key) return;` branch in lib/analytics/events.ts because NEXT_PUBLIC_POSTHOG_KEY was undefined at build. The event-name literals survive (hero_cta_click, landing_view, paid_plan_clicked, cta_click all present), so track() runs and returns early at `if (!client) return;`. Homepage HTML: `grep -ci "googletagmanager|gtag|google-analytics"` = 0, `grep -o 'google-site-verification[^>]*'` = empty.

**Recommendation.** CORRECTED FINDING: "Client-side product analytics is dead in production: NEXT_PUBLIC_POSTHOG_KEY was undefined at build, so all 11 track() call sites are silent no-ops. Search Console IS already verified; the gap is product analytics and server-side revenue events, not search reporting."

Corrected evidence: of the 28 homepage chunks (1.5 MB unique), rzp_live_T72Mp2h6OQISe1 proves NEXT_PUBLIC_* inlining works, while the substring "posthog" appears zero times anywhere, including the default api_host literal "https://us.i.posthog.com" from lib/analytics/events.ts:22. That, not the absence of a posthog-js chunk, is the proof: the dynamic import at events.ts:20 would never be in the static homepage chunk list regardless. Event-name literals survive, so track() runs and exits at events.ts:74. The same root cause leaves NEXT_PUBLIC_SENTRY_DSN unset, so client error monitoring is also dark.

Corrected severity: medium, not critical. Zero ranking impact, and Google Search Console (the only tool that reports impressions, clicks, position and CTR split by query and by country, which is precisely the global-SEO metric this owner needs) is already collecting. Do not gate content work on this.

Corrected recommendation, in priority order:
1. DROP the "verify in Search Console by DNS TXT" action. Already done: TXT on myyogaclasses.fit is google-site-verification=-KzwTiCrZvl1upIYAYmy7wbuW46q6lBdxuaRT1GZSVk, a Domain property that covers www. The sitemap is already declared in robots.txt. Replace this with: open the existing property and read the Performance report filtered by Country to see which of the worldwide markets already produce impressions, since that decides which currencies and which condition pages to invest in first.
2. Set NEXT_PUBLIC_POSTHOG_KEY in the Vercel production env and redeploy. No CSP change needed: script-src already allows https://*.posthog.com (next.config.ts:16) and connect-src allows https://*.posthog.com https://*.i.posthog.com (next.config.ts:32). Verify after deploy by re-grepping a homepage chunk for phc_.
3. Add the missing revenue event SERVER-side, not in the client union. Call trackServer(customerId, "pack_purchased", { currency, amount_cents, plan_slug, country }) inside fulfillRazorpayPayment in lib/razorpay/fulfillment.ts (the single idempotent fulfilment point, so both the verify-payment and webhook rails are covered) and in the verify branch of app/api/admin/payments/[id]/route.ts for the bank-transfer rail. trackServer takes a free-form event string, so no EventName edit is required. Also set POSTHOG_SERVER_KEY, which lib/analytics/server.ts:12 prefers. While there, either wire the already-declared-but-never-called checkout_completed or delete it from the union.
4. DROP the GA4 proposal, or make it conditional on first shipping a consent gate. There is no cookie-consent component in the repo, and with EUR and GBP in SUPPORTED_CURRENCIES and no service-area gate, GA4 plus PostHog's localStorage+cookie persistence (events.ts:24) sets non-essential cookies on EU/UK visitors without consent. PostHog alone already gives referrer and UTM channel attribution and can break revenue out by country, so GA4 adds a third-party origin to the hand-maintained CSP for little marginal insight.
Constraint checks: none of this touches admin_settings/plan_features/reviews DB copy, adds no cookies() call to the (marketing) group (x-nextjs-prerender: 1 confirmed live, ISR intact), introduces no user-facing copy and therefore no em-dash or free-trial risk, and adds no new CSP origin if step 4 is dropped.

### [MEDIUM] The refund policy grants no EU or UK statutory cancellation right and names only UAE and Indian consumer law, so a European buyer's single strongest protection is absent

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high
- **Locations:** https://www.myyogaclasses.fit/legal/refund

**Evidence.** /legal/refund Section 5 names exactly two statutes: "the UAE Consumer Protection Law (Federal Law No. 15 of 2020) for customers in the UAE and the Consumer Protection Act 2019 for customers in India". Section 3: "We do not provide refunds for unused prepaid sessions except as required by law... or at our discretion." Section 2: "one-time session packs in AED or INR (by region) via Razorpay." There is no 14-day cooling-off clause, no mention of the UK Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013, and no mention of the EU Consumer Rights Directive 2011/83/EU. For a distance-sold service to an EU or UK consumer both give a 14-day right to withdraw, and the trader must obtain express consent to begin performance within that window or the right survives in full.

**Recommendation.** Corrected finding (severity: medium, dimension: conversion/trust, not a ranking issue).

Title: The refund policy preserves EU and UK statutory rights only through a generic savings clause and never names them, and all three legal pages carry a "pending legal review, must be verified before launch" banner.

Corrected evidence:
- /legal/refund Section 5 opens with a NON-EXHAUSTIVE savings clause: "Nothing in this Refund Policy limits or excludes any rights you have under the mandatory consumer-protection law that applies to you, including the UAE Consumer Protection Law (Federal Law No. 15 of 2020) ... and the Consumer Protection Act 2019 ...". EU/UK rights are therefore legally preserved but never stated, so a European reader sees only Section 3's "We do not provide refunds for unused prepaid sessions".
- app/(marketing)/legal/refund/page.tsx:19-24, terms/page.tsx:22, privacy/page.tsx:20 all render: "Pending legal review. This is a good-faith draft ... must be verified before launch."
- Live /pricing renders ₹999 / ₹4,499 / ₹7,999 and "Prices shown in INR"; zero £ or € in the HTML. Only INR and AED have plan_prices rows, so effectiveCurrency() downgrades everything else to INR.
- All three pages are static JSX with no Supabase read, x-nextjs-prerender: 1, so code edits do reach the live site.

Corrected priority order:

1. FIRST and highest value, remove the "Pending legal review ... must be verified before launch" banner from all three legal pages once a lawyer has signed off, or at minimum soften it to a "Last updated" line. Shipping a live commercial site whose refund page says it is not launched undercuts every other trust signal. Three-file change, no DB dependency.

2. Add a named EU/UK clause as Section 5b, but treat it as a gated prerequisite rather than an immediate fix. It should land in the same change that adds GBP or EUR plan_prices rows, because until then effectiveCurrency() bills those buyers in INR and the clause describes a purchase path that does not exist. Proposed copy (no em-dashes, no free-trial wording):
"If you are a consumer in the United Kingdom or the European Union, you have 14 days from the date of purchase to cancel a session pack. If you have not booked or attended any session from that pack, we will refund it in full. If you ask us to start early by booking a session inside those 14 days, we will refund the balance of the pack, less a proportionate amount for the sessions you have already used."
Keep the existing Section 5 savings clause above it and add the UK and EU to its list so the enumeration stops implying a closed set.

3. Do NOT change Section 2's "in AED or INR (by region)" now. It is accurate today. Make that edit part of the same currency-enablement change as item 2, never ahead of it, since claiming GBP or EUR while only INR and AED are priced would advertise a currency the checkout refuses.

4. Drop the proposed "satisfaction guarantee" line from this finding. Offering refunds on unused packs is a pricing and business-policy decision for the owner, not an SEO or copy fix, and Section 3's "at our discretion" plus Section 6's make-good already cover goodwill cases. If the owner does want a guarantee, it belongs on /pricing where the buying decision happens, not buried in the refund policy.

### [MEDIUM] The mobile sticky CTA renders only on the homepage, and is absent from every page organic traffic will actually land on

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high
- **Locations:** /Users/shalomp/YOGA_WEBSITE/components/marketing/StickyMobileCTA.tsx, /Users/shalomp/YOGA_WEBSITE/app/(marketing)/page.tsx, https://www.myyogaclasses.fit/pricing, https://www.myyogaclasses.fit/classes/diabetes

**Evidence.** components/marketing/StickyMobileCTA.tsx is imported and mounted in exactly one place: `grep -rn "StickyMobileCTA" app components` returns only app/(marketing)/page.tsx:9 (import) and :64 (render). Verified live: the homepage contains `fixed inset-x-0 bottom-0 z-40 p-3 transition-transform duration-300 md:hidden translate-y-full`; the same grep against /pricing returns 0 and against /classes/diabetes returns 0. So /pricing, all nine /classes/* condition pages, all three /teachers/* pages, /faq and /reviews render no sticky CTA at all on mobile. The condition pages are the site's best content (978 words on /classes/diabetes) and are precisely where a global organic searcher arrives. CLAUDE.md calls the mobile sticky CTA "non-negotiable" at 75% mobile traffic.

**Recommendation.** TITLE: On mobile, every marketing page except the homepage leaves the booking CTA behind a hamburger tap, because StickyMobileCTA is mounted on the homepage only.

EVIDENCE (corrected): `grep -rn "StickyMobileCTA" app components lib` returns only app/(marketing)/page.tsx:9, :64 and the component file. Live, the class string `fixed inset-x-0 bottom-0 z-40` appears once on / and zero times on /pricing, /classes/diabetes, /teachers, /teachers/dr-vaishnavi-mayya, /faq, /reviews. Those pages are not CTA-less: each carries the fixed nav (`fixed inset-x-0 top-0 z-40`), an end-of-page FinalCTA, and on condition pages an above-fold "Book a 1:1 session" (app/(marketing)/classes/[slug]/page.tsx:61-66). The specific mobile deficit is that MarketingNav's "Book a session" button sits in a `hidden items-center gap-3 md:flex` container, so below md the only persistent booking affordance is the hamburger. /pricing is the worst case: on mobile its only booking CTA above the fold is inside that closed menu.

FIX (two parts, do both):
1. Move `<StickyMobileCTA />` out of app/(marketing)/page.tsx:64 and into app/(marketing)/layout.tsx, rendered as a sibling of `<Footer />` and `<WhatsAppButton />`. Verified safe for ISR: it is a client component reading window.scrollY and useViewer(), the layout already mounts MarketingNav (also a client component using useViewer, with a module-level roleCache), and nothing here calls cookies(). No CSP change, no DB-driven surface touched. Delete the page.tsx import so it does not render twice.
2. Because WhatsAppButton is positioned `fixed bottom-24 right-4 z-40 ... md:bottom-6` precisely to clear this bar, and currently renders nothing live (NEXT_PUBLIC_WHATSAPP_NUMBER is unset, 0 `wa.me` hits on all six pages), confirm the two do not collide before that env var is ever set, and add bottom spacing on the short pages (/reviews, /legal/*) so the bar does not cover footer links.

Cheaper complementary fix the original missed: surface a compact "Book" button in the mobile nav row itself rather than only inside the opened menu, so the CTA is visible before the 600px scroll threshold that gates the sticky bar.

DROP the copy rewrite from this finding. "Live online · 60 min" breaks no constraint and there is no evidence it underperforms. If it is worth testing, raise it separately as a hypothesis, not as part of a verified mechanical defect.

KEEP the doc note: `grep -o "Book my 1:1"` = 0 on every live page. CLAUDE.md's "Book my 1:1 session" string is stale; the live above-fold CTA is "Book a 1:1 session" and it does render in viewport 1.

### [MEDIUM] A phone number is mandatory at signup before any availability is visible, and the error message shows a UAE example number

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/components/shared/OnboardingForm.tsx, /Users/shalomp/YOGA_WEBSITE/lib/validation/phone.ts, /Users/shalomp/YOGA_WEBSITE/CLAUDE.md

**Evidence.** components/shared/OnboardingForm.tsx:43-44 "Mandatory at sign-up", and :69-77 blocks submission when toE164(phone) is null, focusing the field and toasting an error. lib/validation/phone.ts PHONE_ERROR_MESSAGE = "Enter a valid mobile number including your country code, for example +971 50 123 4567." Phone is never an auth factor: LoginForm.tsx:159 uses signInWithOtp({ email }) and :56 offers Google OAuth. CORRECTION to CLAUDE.md, which states lib/validation/phone.ts "restricts country codes to [\"AE\",\"IN\"]": it no longer does. The current file header reads "Customers are welcome from any country, so <PhoneField> offers every calling code rather than an allow-list." CLAUDE.md is stale on this point. Signup itself is otherwise excellent for international users: Google OAuth plus 6-digit email OTP, no password, no SMS.

**Recommendation.** A phone number is a hard requirement at /onboarding, which is the last gate before any bookable slot is visible anywhere on the site.

Evidence (all reproduced): components/shared/OnboardingForm.tsx:43-44 ("Mandatory at sign-up"), :71-79 (blocks submit on toE164(phone) === null, focuses the field, toasts), :144 (required asterisk). The gate is unavoidable: lib/auth/redirects.ts:26 routes any profile without experience_level to /onboarding?next=..., /onboarding 307s to /login when signed out, and no page under app/(marketing) renders availability, so a prospect cannot see a single time slot without supplying a phone number. Phone is not an auth factor (LoginForm uses signInWithOtp({ email }) and Google OAuth) and is not required by the booking route.

Correction to CLAUDE.md, in two places, not one: line 186 says lib/validation/phone.ts "restricts country codes to ["AE","IN"]" — it does not, the header at :7-11 now says every calling code is offered and phone-field.tsx defaults both `countries` and `defaultCountry` to undefined. Line 38 says profiles.phone is "optional ... and not required to book" — it is mandatory at onboarding, which stands between the customer and booking.

Downgrade two sub-claims. The "+971 50 123 4567" example in PHONE_ERROR_MESSAGE is a low-severity nit, not part of the medium finding: OnboardingForm.tsx:77 only shows it when the user typed something invalid, an empty field gets the neutral "Please enter your mobile number.", and the label hint at :142 has no country bias. And the number is not "never used" — components/admin/CustomersTable.tsx:155-157 renders it as a tel: click-to-call for the studio, though nothing else reads it (no email, no reminder, no teacher UI).

Recommendation: make the field optional at onboarding by removing the reject at OnboardingForm.tsx:72-79 and the asterisk at :144, keeping the PhoneField so anyone who wants to give a number still can. If it must stay collected, note that the proposed /dashboard/profile fallback is already gated identically at components/dashboard/ProfileForm.tsx:36-39, so that check has to be relaxed in the same change or the wall simply moves. If the string is touched at all, "Enter a valid mobile number including your country code." drops the geographic tell at zero cost.

Before any of that, fix the measurement gap, which is the larger problem: I fetched all 19 JS chunks served on /login and none contains "posthog" or a phc_ key, although AnalyticsProvider is mounted in app/layout.tsx:137. NEXT_PUBLIC_POSTHOG_KEY is unset in production, so initPosthog() at lib/analytics/events.ts:15-18 returns early and the existing signup_started (LoginForm.tsx:83, :170) and onboarding_completed (OnboardingForm.tsx:111) events are no-ops. Set that env var, and the login-to-onboarding-to-book drop-off becomes measurable, which also gives the email-OTP deliverability worry (Resend sender domain, Supabase built-in throttle) a detector instead of a guess. posthog.com and i.posthog.com are already in the next.config.ts CSP connect-src and script-src, so nothing breaks in production when the key is added.

### [MEDIUM] Condition pages are confirmed internal-linking dead ends, with zero contextual links in 978 words of body copy

- **Verdict:** unverified | **Effort:** moderate | **Impact:** medium
- **Locations:** https://www.myyogaclasses.fit/classes/diabetes, /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/, /Users/shalomp/YOGA_WEBSITE/app/layout.tsx

**Evidence.** Every internal href on /classes/diabetes appears exactly once or twice, which is the nav-plus-footer signature: 2× /teachers, 2× /reviews, 2× /pricing, 2× /faq, 2× /classes, 2× /about, 2× /, 1× /login, 1× /legal/terms, 1× /legal/refund, 1× /legal/privacy, 1× /contact. Not one link originates in the body. Body length is 978 words. There are no links to the eight sibling condition pages, none to Dr Vaishnavi Mayya whose live /teachers specialties are "Clinical Yoga, Lifestyle Disorders, Cardiovascular Health" and who is the obvious authority link for the diabetes and hypertension pages, and none to /pricing from inside the argument. Title is "Diabetes · My Yoga Classes" with no keyword, as first-pass item 2 reported. This confirms items 2 and 3 with direct evidence.

**Recommendation.** Three changes to the condition page template. (1) Titles: change the per-page title so app/layout.tsx's "%s · My Yoga Classes" produces "Yoga for Diabetes: Live 1:1 Online Classes · My Yoga Classes" rather than "Diabetes · My Yoga Classes". (2) Add a "Related practices" block linking three sibling condition pages chosen by affinity (diabetes → hypertension, weight-loss, geriatric), which turns nine orphans into a linked cluster. (3) Add a "Your teacher for this" card linking the matching /teachers/[slug], which passes authority into the teacher pages and answers the credibility question in the same scroll. Then publish the 107 structured pose entries across 36 poseGroups already sitting unused in lib/data/condition-pages/*.json: each poseGroup is a natural /poses/[slug] page with Sanskrit and English names, which is exactly the shape of myyogateacher.com's 84-URL /yoga-asana directory, and it is the only route from 23 indexable URLs to a competitive footprint without writing new content from scratch.

### [MEDIUM] Zero social proof from any Western market: five of six reviews are UAE, one is India

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** https://www.myyogaclasses.fit/reviews, https://www.myyogaclasses.fit/, https://www.myyogaclasses.fit/teachers

**Evidence.** All six reviews on both / and /reviews carry UAE or Indian attributions: "Emma R., Dubai, AE", "James P., Abu Dhabi, AE", "Fatima H., Abu Dhabi, AE", "Noor S., Sharjah, AE", "Mohammed A., Dubai, AE", "Priya N., Bengaluru, IN". Supporting copy reinforces it: the /teachers hero says "Every teacher is at least 200-hr Yoga Alliance certified, with years of in-studio experience translated to live online sessions", and the footer says "Teachers in India · Students everywhere" while every named student is in the Gulf or India. One review says "Worth every cent", which does not match a dirham or rupee price.

**Recommendation.** A US or UK visitor scanning for someone like themselves finds nobody. Reviews are DB-driven (reviews table), so this is an /admin edit, not a code change: as soon as the first US, UK or EU students exist, surface them, and until then reorder so the India review is not last. The 200-hr Yoga Alliance line is the strongest asset here and it is buried on /teachers: Yoga Alliance is a US organisation and it is the one credential a US searcher recognises instantly. Promote it into the homepage trust bar in place of the fabricated "4.9 · 1,200+ reviews", where it is both true and more persuasive to the target market. Note also that /teachers lists only three teachers, all IST, which is the real capacity ceiling on any global acquisition push and should be sized before spend, not after.

### [MEDIUM] og:locale is the invalid value "en" and there is no hreflang anywhere, on a site explicitly targeting multiple English-speaking markets

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/layout.tsx, /Users/shalomp/YOGA_WEBSITE/lib/geo/region.ts, https://www.myyogaclasses.fit/pricing

**Evidence.** Live on /pricing and /: `<meta property="og:locale" content="en"/>`. The Open Graph spec requires language_TERRITORY, so "en" is invalid and Facebook, LinkedIn and WhatsApp fall back to a default rather than honouring it. No hreflang link elements or headers on any page fetched. Meanwhile lib/geo/region.ts already carries the exact locale map needed: LOCALE_BY_CURRENCY = { INR: "en-IN", AED: "en-AE", USD: "en-US", GBP: "en-GB", EUR: "en-IE" }.

**Recommendation.** Set og:locale to "en_US" in the root metadata in app/layout.tsx, and add og:locale:alternate entries for en_GB, en_IN and en_AE. Do not build per-country URL variants: there is one English site and hreflang would be pointing at itself. Instead add a single self-referential `<link rel="alternate" hreflang="x-default" href="...">` per page alongside the existing self-referential canonical, which is the correct signal for one page serving all English markets. The currency swap is client-side via /api/region and correctly does not fork the URL, so this stays compatible with ISR.

### [MEDIUM] Scaling global acquisition into the free-trial mismatch converts a documentation inconsistency into a per-signup cash cost, with three distinct options

- **Verdict:** unverified | **Effort:** moderate | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/api/bookings/confirm/route.ts, https://www.myyogaclasses.fit/pricing, https://www.myyogaclasses.fit/legal/refund

**Evidence.** app/api/bookings/confirm/route.ts:22 `isFreeTrial: z.boolean().default(true)` — the field DEFAULTS to true, so any booking request that omits it is free. Line 231 passes `p_is_free_trial: parsed.data.isFreeTrial` into the book_session RPC, and line 241 translates PG 23505 into `trial_already_claimed`, the bookings_one_free_trial_per_customer partial unique index. Meanwhile no public page mentions a free session: /pricing says "Pay only when you're ready", the homepage trust bar says "No subscription", and the /teachers CTA says "Pay only for what you book". So the grant exists and is invisible.

**Recommendation.** This is a decision with three real options, not a bug to fix. (1) Keep it silent. Cost scales linearly with acquisition: every new signup from paid or organic global traffic consumes one 60-minute teacher hour against three IST teachers, with no offsetting conversion lift because nobody knows it is on offer. At global volume this is the most expensive option and the only one that buys nothing. (2) Turn it off. Change the zod default at route.ts:22 from `default(true)` to `default(false)` so omission fails closed, and require an explicit eligibility check. This removes the cost and matches the copy exactly, at the price of losing the single strongest tool for converting a stranger who has never heard of the brand and is being asked to wire money to India. (3) Turn it into something nameable that is not a free trial. The copy constraint is against free-trial and no-credit-card wording, not against risk reversal. A first-session satisfaction guarantee on the 1-Session Pack, "Book your first 1:1. If it is not right for you, tell us within 48 hours and we will refund it", is a paid transaction, so the customer's card clears before a teacher hour is spent, it reads as confidence rather than a giveaway, it is the framing US and UK buyers already expect, and it doubles as the EU/UK cooling-off language the refund policy is missing. My recommendation is (3) paired with (2): close the backend grant, and buy the same conversion effect with a guarantee that filters for intent. Whichever is chosen, decide before scaling acquisition, because option (1) is what happens by default.

### [LOW] /pricing has no Product or Offer structured data and shows no per-session price, so it cannot win a price-rich result and does not answer the comparison question a global searcher is asking

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** medium
- **Locations:** /Users/shalomp/YOGA_WEBSITE/app/(marketing)/pricing/page.tsx, /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts, https://www.myyogaclasses.fit/pricing

**Evidence.** JSON-LD types on live /pricing: `grep -o '"@type":"[A-Za-z]*"' pricing.html | sort | uniq -c` returns 9 Answer, 1 ContactPoint, 1 FAQPage, 1 Organization, 9 Question. No Product, no Offer, no AggregateOffer. The visible page shows "₹999", "₹4,499", "₹7,999" and never a per-session figure, although ₹7,999 for 10 sessions is ₹800 per session and the 10-pack bullet already claims "Lowest price per session" without showing it. Meta description is "Honest yoga pricing in AED and INR. One-time session packs, no subscription.", which names two currencies a global searcher does not use and omits the product entirely.

**Recommendation.** CORRECTED FINDING
/pricing emits only FAQPage and Organization JSON-LD, so the three session packs carry no machine-readable price for any search or AI answer surface, and the visible cards hide the per-session number even though the 10-pack bullet already claims "Lowest price per session". Severity: low. Rich-result upside is minimal (Google scopes product rich results to a single product or its variants, and there is no aggregateRating or merchant-listing data here); the real payoff is a correct price for AI answer surfaces plus a genuine on-page conversion gain from showing the per-session maths.

CORRECTED RECOMMENDATION

1. Per-session price on the cards (the actual conversion win, do this first).
   Everything needed is already in scope in components/marketing/PricingTeaser.tsx: `planAmount(p)` (line 164), `p.session_credits` (used at line 355), `displayCurrency` (line 170) and `formatMoney` from lib/i18n/money.ts. Render, under the existing price:
     formatMoney(Math.round(planAmount(p) / p.session_credits), displayCurrency) + " per session"
   Gives "₹800 per session" for INR and "AED 50 per session" for AED, and it automatically follows the client-resolved currency, so ISR is untouched.
   Do NOT try to do this by editing the "Lowest price per session" bullet: that string is a plan_features row and is DB-driven, so a code edit changes nothing on the live site.

2. Product + AggregateOffer, built from DB data, INR only, static.
   Add `packOffersJsonLd(plans, currency, siteUrl)` to lib/seo/structuredData.ts and emit it alongside the existing faqPageJsonLd in app/(marketing)/pricing/page.tsx. Build the Offer nodes from the `plans` array getPlansWithFeatures() already returns, never hard-coded:
     Product name "1:1 Online Yoga Session Pack", description, url https://www.myyogaclasses.fit/pricing
     offers: AggregateOffer with priceCurrency "INR", lowPrice "999", highPrice "7999", offerCount 3
     three Offer nodes, one per pack, each { name: p.name, price: (amount_cents/100).toFixed(2), priceCurrency: "INR", availability: "https://schema.org/InStock", url: "https://www.myyogaclasses.fit/pricing" }
   Emit INR and only INR, at build/ISR time. Do NOT gate this on USD/GBP/EUR rows existing, and do NOT resolve the currency per visitor. INR is what effectiveCurrency() downgrades every unpriced market to, so INR is the honest price a US or UK buyer is actually charged today, and it is also what the statically prerendered HTML already shows. A per-visitor variant would require headers() in the (marketing) group and kill ISR group-wide. Revisit only if an admin later prices every active plan in USD/GBP/EUR in /admin/plans.

3. Meta description, currency-neutral (app/(marketing)/pricing/page.tsx:13).
   Replace with: "Live 1:1 online yoga with expert teachers in India. One-time packs of 1, 5 or 10 sessions, no subscription, sessions never expire."
   No price at all, because no single currency is correct for a global searcher and no USD price exists in the catalog. No em-dash, no free-trial wording, keeps the "1:1" framing, and it names the product, which the current string does not.

4. BreadcrumbList on the nine condition pages (unchanged, this part of the original was correct).
   app/(marketing)/classes/[slug]/page.tsx:48 already imports JsonLd; add a second `<JsonLd data={breadcrumbJsonLd([...])} />` using the existing helper at lib/seo/structuredData.ts:68, with Home > Classes > {category name}. Pure code, no DB copy, no ISR impact.

Validate with Google's Rich Results Test after deploy; expect the Product to be picked up as data even if no visual rich result renders.

### [LOW] Availability windows that cross IST midnight are silently rejected, which blocks the exact window that would serve US afternoon

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** low
- **Locations:** /Users/shalomp/YOGA_WEBSITE/supabase/functions/_shared/availability.ts, /Users/shalomp/YOGA_WEBSITE/lib/booking/availability.ts, /Users/shalomp/YOGA_WEBSITE/app/api/bookings/confirm/route.ts

**Evidence.** supabase/functions/_shared/availability.ts, slotInsideAvailability(): `const dow = teacherDayOfWeek(start, tz); if (dow !== teacherDayOfWeek(end, tz)) return false;` and the window match requires `startHms >= padHms(w.start_time) && endHms <= padHms(w.end_time)` within a single day_of_week (0=Sun..6=Sat, supabase/migrations/0002_teachers.sql:50). lib/booking/availability.ts is a pure re-export of this one canonical copy. Consequence: a teacher window of 22:00-02:00 IST, which is 12:30-16:30 America/New_York and the natural slot for a US working-afternoon session, cannot be expressed and every booking inside it fails the check.

**Recommendation.** Do not change the rule; changing it risks double-booking, and the module header explicitly warns there is exactly one copy. Instead document the workaround for whoever sets teacher availability in /admin: a window crossing IST midnight must be entered as two rows, 22:00-23:59:59 on day N and 00:00-02:00 on day N+1. Better, enforce it in the admin availability UI by splitting automatically and showing the resulting pair, so the constraint is visible at data-entry time rather than as a booking failure a customer sees. This only becomes revenue-relevant once US traffic exists, which is why it ranks low today.

### [LOW] CORRECTION to the first-pass audit: the per-session price is about $10, not $23-24, and UAE customers pay 47% more than Indian customers for the same pack

- **Verdict:** unverified | **Effort:** quick-win | **Impact:** low
- **Locations:** https://www.myyogaclasses.fit/pricing

**Evidence.** Live plan_prices from the /pricing RSC payload: pack-1 99900 INR / 5900 AED, pack-5 449900 INR / 27500 AED, pack-10 799900 INR / 49900 AED. That is ₹4,499 for five sessions = ₹899.80 per session, and ₹7,999 for ten = ₹799.90 per session. At roughly ₹88 per USD that is about $10.22 and $9.09 per 60-minute private session, not the $23-24 in first-pass item 12. The AED figures are AED 55 and AED 49.90 per session, roughly $15.00 and $13.59. AED 275 is about ₹6,600 against the ₹4,499 Indian price for the identical pack, a 47% premium.

**Recommendation.** Correct the working assumption before setting international prices. Against a US private-yoga rate of $60-120/hr, a downgraded-to-INR US buyer today would pay about $10 per session, which is 6-12x below market and reads as implausible rather than as a bargain. That is a second, independent reason not to set USD/GBP/EUR by converting the INR figures at spot: the existing AED tier is already the better anchor, and even it is well below Western market. Treat the international price as a positioning decision. Also note the AED/INR gap is intentional regional pricing and is fine, but it means any "international" price set by analogy to INR will be roughly one third of what it should be.

---

## BACKFILL: ai-search (8)

### [HIGH] Zero Review, AggregateRating, Service or Offer markup sitewide, and three mutually contradictory review counts are rendered as plain text

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high

**Evidence.** Live JSON-LD inventory by page: / = ['Organization','FAQPage']; /pricing = ['Organization','FAQPage']; /faq = ['Organization','FAQPage']; /teachers = ['Organization']; /teachers/dr-sangeeta = ['Organization','Person','BreadcrumbList']; /about = ['Organization']; /reviews = ['Organization']; /classes = ['Organization']; /classes/diabetes = ['Organization','Course']. app/(marketing)/reviews/page.tsx has no JsonLd import at all. Meanwhile the homepage renders "★★★★★ 4.9 · 1,200+ reviews", /teachers/dr-sangeeta renders "5.0 · 312 reviews", and /reviews contains exactly 6 ★★★★★ blocks (grep -c on the live HTML). All six are UAE or India: Dubai, Abu Dhabi, Abu Dhabi, Sharjah, Dubai, Bengaluru.

**Recommendation.** Retitle and re-scope to two separable items.

ITEM A (the real one, high): the site publishes review data it cannot substantiate, and some of it is fabricated. /reviews serves six invented testimonials (MOCK_REVIEWS, lib/data/landing.ts:275-280) because the reviews table is empty and getFeaturedReviews falls back to mocks (lib/data/landing.ts:384). /teachers/dr-sangeeta shows "5.0 · 312 reviews" from a seeded rating_count (supabase/seed.sql:38). The homepage shows "4.9 · 1,200+ reviews". Fix in three places, not one:
  1. DB, not code: at /admin/settings → Landing copy, blank landing.trust_rating and landing.trust_count. A repo edit alone will not change the live hero (proven above by the subhead mismatch). Also drop the code fallbacks at app/(marketing)/page.tsx:42-43 and lib/data/landing.ts:287-288 so the value cannot reappear.
  2. DB: UPDATE public.teachers SET rating_avg = 0, rating_count = 0 for every teacher carrying a seeded figure. The renders at app/(marketing)/teachers/[slug]/page.tsx:89 and components/marketing/TeacherGrid.tsx:93 are already gated on rating_count > 0, so the badges disappear with no code change. This also fixes the /teachers listing inconsistency the original finding missed.
  3. Code: delete MOCK_REVIEWS and change lib/data/landing.ts:384 from "if (!data || data.length === 0) return MOCK_REVIEWS" to returning an empty array, then have TestimonialWall render an honest empty state. Serving invented named testimonials is the part with actual legal exposure (India's CCPA dark-patterns guidelines, UAE consumer protection, and the FTC's Rule on Consumer Reviews and Testimonials for the US traffic this project is targeting). Replacement copy, no em-dashes: "Every session is 1:1, so every review comes from someone who practised with that teacher."
Caveat to check before shipping step 3: confirm the reviews table is genuinely empty rather than merely un-approved, since the query filters on is_featured AND is_approved. If real rows exist but are unflagged, approve them instead of deleting the wall.

ITEM B (medium, not critical): missing commercial and entity markup. Do the parts that actually render:
  - /pricing: add a Product (or Service with hasOfferCatalog) carrying an AggregateOffer with lowPrice 999, highPrice 7999, priceCurrency resolved through effectiveCurrency() so it never disagrees with the visible grid, wrapping three Offer nodes for pack-1 ₹999, pack-5 ₹4,499 and pack-10 ₹7,999. This is the one item with a real SERP payoff.
  - Add a Service node at @id https://www.myyogaclasses.fit/#service, serviceType "Online private yoga instruction", provider referencing the Organization @id, areaServed consistent with the no-service-area-gate reality.
  - Add BreadcrumbList to the condition pages (already flagged as established item 7 and still absent).
  Do NOT attach aggregateRating to that Service expecting stars. Self-serving reviews have been ineligible for Google review rich results since 2019 and Service is not a supported review-snippet type. Emit individual Review nodes only once real reviews exist, and then for entity and AI-retrieval value, not for rich results.
  Drop the Google Business Profile suggestion, the business is ineligible as a purely online operation with no in-person contact. Keep Trustpilot, which accepts online-only businesses.
Both items must respect the stated constraints: no cookies() in the (marketing) group, and any new third-party origin added to the CSP in next.config.ts. Neither recommendation above requires either.

### [HIGH] CORRECTION to established item 12: a global visitor is quoted roughly $10 per session in rupees, not $23-24

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high

**Evidence.** Fetching https://www.myyogaclasses.fit/pricing over a US-routed request renders "₹999", "₹4,499", "₹7,999" and the literal sentence "Prices shown in INR ." The 5-pack is ₹4,499 for 5 sessions = ₹899.80 per session, roughly $10.20 at about 88 INR/USD. The first-pass audit's "$23-24/session" is the AED price (AED 435 for the 5-pack per the migration history), which a non-AED visitor never sees. effectiveCurrency() in lib/razorpay/catalog.ts is downgrading every USD, GBP and EUR visitor to INR because only INR and AED have plan_prices rows, exactly as SUPPORTED_CURRENCIES in lib/geo/region.ts and migration 0036 imply.

**Recommendation.** CORRECTED FINDING (severity: high, not critical)

Item 12 of the first-pass audit is wrong. A visitor in the US, UK or eurozone is not quoted $23-24 per session. They are quoted rupees. Verified on the live site and in the live database.

Evidence. The live database has plan_prices rows in only two currencies for the three active plans: pack-1 INR 99900 / AED 5900, pack-5 INR 449900 / AED 27500, pack-10 INR 799900 / AED 49900. pricedCurrencies() in lib/razorpay/catalog.ts therefore returns {INR, AED}, and effectiveCurrency() downgrades every USD, GBP and EUR visitor to INR. https://www.myyogaclasses.fit/pricing returns 200 with x-nextjs-prerender: 1 and ships ₹999, ₹4,499, ₹7,999 plus the sentence "Prices shown in INR. One-time payment, no subscription. Book from anywhere in the world." The 5-pack works out to ₹899.80 per session, roughly $10.20 at 88 INR/USD. That is about a sixth of the $60-120 US private-yoga rate.

Where $23-24 came from. It is the AED 435 five-pack from migration 0022, which was retired. 0031_pack_pricing_update.sql:7 re-priced it: "5-Session Pack : AED 275 (was AED 435)", and the live DB confirms 27500 fils. The current AED price is AED 55 per session, about $15. So $23-24 is not the AED price either. It matches nothing a customer can see today.

Why this is NOT a pure admin data task. The recommendation to simply enter USD, GBP and EUR prices at /admin/plans would break checkout rather than fix it. app/api/payments/intent/route.ts:101 routes every non-AED currency to Razorpay, and app/api/razorpay/create-order/route.ts:136 passes that currency straight into orders.create. Razorpay International acceptance is not enabled on this account, which is precisely why AED was given its own manual SWIFT rail in migration 0030, and 0036_international_currencies.sql says so explicitly in its header. Adding a USD price today turns "quoted in rupees" into "order creation fails", which is worse.

Correct sequencing, in order:
1. Enable Razorpay International acceptance on the account, or extend the bank-transfer rail in app/api/payments/intent/route.ts to cover USD/GBP/EUR the way it covers AED. Until one of these is true, no non-INR price should be entered for a Razorpay-routed currency.
2. Decide the regional-pricing stance, reconciling the three currencies rather than pricing USD in isolation. The live AED five-pack is AED 275, about $75, and it is publicly visible. A $175 USD five-pack next to it is a 2.3x spread on the same product from the same India-based teachers. Either accept and be able to defend that spread, or set USD nearer the AED anchor, for example single $19, 5-pack $85 at $17 per session, 10-pack $155 at $15.50 per session, which still reads as a credible India-delivered price rather than an implausible one.
3. Only then enter the prices at /admin/plans. No code change and no deploy is needed for step 3 alone; SUPPORTED_CURRENCIES already lists USD, GBP and EUR, and the plan_prices CHECK constraint was widened by 0036.

Relationship to the rest of the SEO work. This is a conversion and credibility defect, not a discovery one. It should not block the content and internal-linking work: 23 indexable URLs against a competitor's 613 is what determines whether a global visitor ever reaches the pricing page at all. Run both tracks in parallel, with the currency work gated on the Razorpay acceptance decision above.

### [MEDIUM] A brand-name search resolves to the public GitHub repo, not the business, and the AI answer concludes the company is not a real yoga service

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high

**Evidence.** WebSearch for the exact string "myyogaclasses.fit" returned 9 results, 0 of which were the live site. Result #1 was https://github.com/Shalom-P/yoga-website. GitHub API (fetched 2026-09-18) returns description: "Conversion-first yoga studio web app — Next.js 16 + Supabase + PayPal + Google Meet. AU customers, IN teachers.", homepage: "https://yoga-website-seven-mocha.vercel.app", private: false, pushed_at: 2026-09-16. The generated summary stated the domain "appears to be a web application framework designed for yoga studios rather than an active yoga class website itself." Every fact in that description is retired: PayPal was replaced by Razorpay, and AU was dropped on 2026-06-21.

**Recommendation.** CORRECTED FINDING
Title: The brand term "myyogaclasses.fit" has no indexed presence, and the only artifact that does rank is a stale public GitHub repo that describes the business as a software project.
Severity: medium (real, reproducible, cheap to fix, but near-zero current search volume and it does not move traffic on its own).

Corrected diagnosis: the site is absent from the index for its own brand term AND for its own verbatim meta description. The GitHub repo is not outranking the site, it is filling a vacuum. Two separable problems: (A) a wrong artifact is answering the brand query, (B) the site is not indexed. Fixing A without B leaves zero results.

RECOMMENDATION, REORDERED BY ACTUAL LEVERAGE.

1. Get the site indexed. This is the real fix and it is the prerequisite for everything else.
   - Verify www.myyogaclasses.fit in Google Search Console. Cheapest route is a DNS TXT record, which needs no code and cannot affect ISR. If you prefer the meta-tag route, Next has first-class support: add `verification: { google: "<token>" }` to the `metadata` export in app/layout.tsx. That is a static metadata field, it does not call cookies() and does not force the (marketing) group dynamic. Do not add a third-party SEO script or tag manager for this, any new origin would have to be added to the hand-maintained CSP in next.config.ts or it breaks in production only.
   - Submit https://www.myyogaclasses.fit/sitemap.xml in GSC and use URL Inspection to request indexing on the 9 condition pages, which are the strongest content on the site.
   - Do the same in Bing Webmaster Tools, which is what several AI answer engines read.

2. Fix the GitHub metadata. Do this regardless of whether the repo goes private, because a private repo's old description can persist in third-party caches, and because it costs 60 seconds.
   - homepage: change https://yoga-website-seven-mocha.vercel.app (currently HTTP 404) to https://www.myyogaclasses.fit
   - description: "Source for My Yoga Classes, a live 1:1 online yoga service. Teachers in India, students worldwide. Book at https://www.myyogaclasses.fit"
   Note the repo README will also need a pass, the search snippet I got was drawn partly from README text about Resend SMTP setup, not only from the description field.

3. On making the repo private: reasonable, but for hygiene, not security, and do not expect an SEO gain from it. Drop the stated rationale. The CSP allow-list is already a public response header on every request, and RLS policy text is not a credential, it is enforced by Postgres server-side. No secrets are tracked in the repo (.gitignore covers .env*, only .env.local.example is committed). The honest reasons to go private are that a commercial booking product's full schema, cron endpoint design and admin surface are free reconnaissance for an attacker, and that the repo is the only thing currently speaking for the brand. If you do flip it, the description fix in step 2 becomes moot for new crawls but still helps caches drain.

4. Entity building, as a slower track. The Organization JSON-LD already carries sameAs with the Instagram profile (verified live), so there is no code change needed there yet. What is missing are the profiles themselves: create a Google Business Profile (service-area business, no storefront) and a LinkedIn company page, then add those URLs to the existing INSTAGRAM_URL pattern in lib/seo/structuredData.ts so the Organization sameAs array lists all three. Skip Crunchbase and Wikidata until the business has independent coverage to cite, an unsourced Wikidata item will be deleted and a thin Crunchbase page adds nothing.

Constraint check on the above: no DB-driven surface is touched (no admin_settings, plan_features or reviews copy), nothing calls cookies() in the (marketing) group, no new third-party origin is introduced so the CSP is untouched, no free-trial or "no credit card" wording is proposed, and there are no em-dashes in any proposed copy.

### [MEDIUM] CORRECTION to established item 7: condition pages carry NO FAQPage schema. 45 question-answer pairs ship as HTML only

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high

**Evidence.** The first-pass audit states FAQPage is present on "/ /faq /pricing and condition pages". That is wrong for condition pages. Live /classes/diabetes JSON-LD contains exactly two nodes: Organization and Course. app/(marketing)/classes/[slug]/page.tsx:48 emits only `<JsonLd data={courseJsonLd(c, ...)} />`. Counting the `faqs` arrays across lib/data/condition-pages/*.json gives 45 question-answer pairs total, and they do render as visible HTML: the diabetes page has an h2 "Questions people ask first." followed by five h3 questions including "Can yoga replace my diabetes medication?" and "Is it safe if I have neuropathy or eye concerns?". BreadcrumbList is also absent from all nine condition pages, confirming that half of item 7.

**Recommendation.** Corrected finding: established item 7 is wrong. None of the nine condition pages emit FAQPage or BreadcrumbList; live /classes/diabetes carries only Organization + ContactPoint + Course + CourseInstance. FAQPage ships on / , /faq and /pricing only (9 Q/A each); BreadcrumbList on /teachers/[slug] only. The 45 question-answer pairs across lib/data/condition-pages/*.json are NOT fully rendered as visible HTML: only the 5 questions per page render (accordion triggers), while every answer exists solely inside the RSC flight payload (`accordion-content` appears 0 times in the served HTML). Severity is medium, not high, because Google has limited FAQ rich results to government and health-authority sites since August 2023, so no rich result will appear for this site; the genuine gains are (a) making 45 answers machine-readable to crawlers and AI answer engines that never click an accordion, and (b) breadcrumb display, which is still supported for all sites.

Corrected fix for app/(marketing)/classes/[slug]/page.tsx — extend the line 6 import to `import { courseJsonLd, faqPageJsonLd, breadcrumbJsonLd } from "@/lib/seo/structuredData";`, then replace the single JsonLd call with:

      <JsonLd data={courseJsonLd(c, `${siteUrl}/classes/${c.slug}`)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Classes", url: `${siteUrl}/classes` },
          { name: c.name, url: `${siteUrl}/classes/${c.slug}` },
        ])}
      />
      {rich ? <JsonLd data={faqPageJsonLd(rich.faqs)} /> : null}

The `rich &&` guard is required: getConditionPage returns ConditionPage | null and strict mode will reject `rich.faqs`. `rich.faqs` is typed `Faq[]`, exactly what faqPageJsonLd accepts, so no adaptation is needed. Verify afterwards with `npm run typecheck`.

Optional follow-up worth more than the schema itself: the answers never reach the DOM. Either render them server-side (Radix `forceMount` on the accordion content, or a plain details/summary) or accept that the JSON-LD is the only crawlable copy. Add a visible breadcrumb link back to /classes as well, which also fixes the "internal-linking dead end" in established item 3.

### [MEDIUM] Course provider.sameAs points at the class page, so nine pages each assert a different identity for the same Organization

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high

**Evidence.** lib/seo/structuredData.ts:58 reads `provider: { "@type": "Organization", name: ORG_NAME, sameAs: url },` where `url` is the class page URL. Live /classes/diabetes emits `"provider":{"@type":"Organization","name":"My Yoga Classes","sameAs":"https://www.myyogaclasses.fit/classes/diabetes"}`. sameAs means "this is another authoritative URL for this same entity", so the markup currently claims the diabetes class page IS the organization. Across nine condition pages that is nine conflicting identity assertions. Separately, no node anywhere on the site carries an @id, so there is no stable entity to reference; the Organization block is re-declared inline on every page as an anonymous node.

**Recommendation.** Finding (corrected): lib/seo/structuredData.ts:58 misuses `sameAs` on the Course provider, pointing it at the class page URL, so each of the nine condition pages asserts a different reference URL for the same Organization. Live output confirms it. Separately, no JSON-LD node on the site carries an @id, so the Organization is re-declared as an anonymous node on every page and nothing links the Course, Person and Organization into one entity. Severity medium, not high: no rich result consumes provider.sameAs, nothing errors in the Rich Results Test, and the correct sitewide Organization node (url = homepage, sameAs = Instagram) ships on every page alongside it. The gain is entity consolidation for knowledge-graph and LLM consumers, not a recovery from active damage.

Recommendation (corrected):
1. app/layout.tsx, in `orgJsonLd`: add `"@id": `${siteUrl}/#organization`,` next to `"@type": "Organization"`. Do NOT touch `sameAs` there, it is already correct at line 91 (`sameAs: [INSTAGRAM_URL]`); extend it later with LinkedIn, Google Business Profile or Wikidata when those exist.
2. lib/seo/structuredData.ts:58: `provider: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: ORG_NAME, url: SITE_URL },`. Keep name (Google requires provider.name for Course) and add url, which is currently missing entirely. The @id makes it resolve to the same entity; the inline name/url keep the node self-sufficient for consumers that do not merge blocks.
3. lib/seo/structuredData.ts:43: same treatment for `worksFor` on Person.
4. Introduce a single exported `SITE_URL` constant in lib/seo/structuredData.ts (or import the existing siteUrl from app/layout.tsx's source) so the @id string is defined once rather than duplicated in three places.
schema-dts accepts all of this (provider and worksFor both admit IdReference). No CSP change, no cookies(), no copy change. Redeploy is needed for the ISR-prerendered condition pages to pick up the new markup.

### [MEDIUM] Teacher pages render "Meet Dr , a quick hello." and "Book a 1:1 with Dr" in the server HTML because the name split takes the honorific

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** medium

**Evidence.** app/(marketing)/teachers/[slug]/page.tsx:56 renders `Meet {t.display_name.split(" ")[0]}, a quick hello.` and line 126 renders `Book a 1:1 with {t.display_name.split(" ")[0]}`. display_name is "Dr Sangeeta", so [0] is "Dr". Confirmed in the live prerendered HTML of /teachers/dr-sangeeta, which extracts to "Meet Dr , a quick hello." and "Book a 1:1 with Dr". All three teachers are titled "Dr", so all three profile pages are affected. Same pattern at components/dashboard/TeacherSlotPicker.tsx:70 and components/admin/SessionRosterDrawer.tsx:83.

**Recommendation.** Corrected finding: Teacher profile pages render "Meet Dr, a quick hello." and "Book a 1:1 with Dr" in the visible server HTML on all three teacher URLs, because the first-name split takes the honorific. Severity: medium, not high. Title, H1, meta description, Person JSON-LD and BreadcrumbList all carry the correct full name ("Dr Sangeeta: Yoga Teacher · My Yoga Classes"), so there is no crawl, index, snippet or ranking impact. This is a credibility and conversion defect confined to body copy on 3 of 23 indexable URLs. Note also that the live string is "Meet Dr, a quick hello." with no space before the comma; the doubled space in the original evidence comes from stripping React's <!-- --> SSR text-node separators, not from the page.

Corrected call-site list. Affected by teacher honorifics:
- app/(marketing)/teachers/[slug]/page.tsx:56 (public, SEO-visible)
- app/(marketing)/teachers/[slug]/page.tsx:126 (public, SEO-visible)
- components/dashboard/TeacherSlotPicker.tsx:70, used at lines 254 and 258 ("with Dr" / "for Dr" in the booking confirm bar) - auth-gated, robots-disallowed, UX only
- app/(teacher)/teacher/page.tsx:19 - MISSED by the original finding; greets the teacher as "Dr"

Not affected, drop from the finding: components/admin/SessionRosterDrawer.tsx:81-85 splits a customer's full_name, not a teacher display_name, already uses split(/\s+/), and sits behind /admin. app/(dashboard)/dashboard/page.tsx:51 is the same customer-name case.

Recommendation stands as written. Add to lib/utils.ts (client-safe, no server-only import, sits alongside cn):

export function friendlyName(full: string) {
  const parts = full.trim().split(/\s+/).filter((p) => !/^(dr|mr|mrs|ms|prof)\.?$/i.test(p));
  return parts[0] ?? full;
}

Apply it at all four teacher-name sites above. Keep the full display_name in the H1, title, meta description and JSON-LD, which are already correct. Priority: ship it, but rank it below the coverage and internal-linking items, not above them.

### [MEDIUM] Teacher entity pages total 171 words including navigation and footer, and the Person markup carries no credentials

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high

**Evidence.** Full visible-text extraction of https://www.myyogaclasses.fit/teachers/dr-sangeeta yields 171 words, of which the unique bio is roughly 75 words. The Person JSON-LD contains name, url, jobTitle "Yoga Teacher", worksFor, knowsAbout: ["Prenatal and Postnatal Yoga"], knowsLanguage: ["English"], image and description "Yoga and Naturopathy Doctor". It has no sameAs, no hasCredential, no alumniOf, no nationality, no yearsOfExperience equivalent. The rendered page claims "Yoga and Naturopathy Doctor" and the homepage claims "MD in Clinical Yoga & Naturopathy" for Dr Vaishnavi Mayya and "Medical Yogic Sciences · 8 years" for Dr Hima Bindu, none of which reach the structured data.

**Recommendation.** Corrected finding: teacher entity pages carry 171-210 total words with only 61-110 unique, and the Person JSON-LD expresses credentials as an untyped `description` string rather than typed properties, while two credential-bearing DB columns the admin UI already writes are never rendered or mapped at all.

Corrected recommendation, ordered by cost:

1. Render what already exists (no migration, no new data). `certifications` (jsonb, string array, written by components/admin/TeacherFormDialog.tsx:337-345) and `years_experience` (integer, written at :310 and by teachers themselves in components/teacher/TeacherProfileForm.tsx:41) are already on the object returned by getTeacherBySlug's `.select("*")`. Add a "Training and certifications" block and a years-practising line to app/(marketing)/teachers/[slug]/page.tsx beside the existing Specialties and Languages blocks. Note lib/supabase/types.ts:55 types certifications as `unknown`, so narrow it with an Array.isArray guard before mapping.

2. Map those same two fields into personJsonLd(t, url) in lib/seo/structuredData.ts, emitting each certification string as `hasCredential: [{ "@type": "EducationalOccupationalCredential", credentialCategory: "certification", name: <string> }]`. Omit `recognizedBy` entirely unless a teacher supplies a verified issuing institution. Do not add `alumniOf` or `sameAs`: there are no columns for them and no evidence these teachers have public professional profiles. Treat this as entity-graph hygiene, not a rich-result play, since no Google rich result consumes hasCredential.

3. Expand the bios, but book it correctly. It is an admin DB edit at teachers.bio plus an information-gathering task with three real doctors, not an afternoon of code. Target roughly 250-350 words of true, specific detail (training, years practising, conditions worked with, what a first session looks like) rather than a 400-word floor, which is not a ranking factor. Keep it claim-safe in line with migration 0024_category_copy_positive, and no em-dashes.

4. Higher-value adjacent fix the finding did not raise: fix app/(marketing)/teachers/[slug]/page.tsx:113 and :139, where display_name.split(" ")[0] renders "Meet Dr , a quick hello." and "Book a 1:1 with Dr" on all three live pages. That is visible broken copy on the primary conversion CTA of every teacher entity page and is strictly cheaper than any schema work above.

5. Also reconcile the per-teacher rating_count values (312 and 98) with the 12 reviews /reviews actually renders, before adding any further trust markup to these pages.

### [MEDIUM] /pricing renders three purchasable packs with zero Offer, Product or PriceSpecification markup

- **Verdict:** partially-correct | **Effort:** moderate | **Impact:** high

**Evidence.** Live /pricing JSON-LD is exactly ['Organization','FAQPage']. app/(marketing)/pricing/page.tsx:21 emits only `<JsonLd data={faqPageJsonLd(FAQS)} />`. The page body renders three packs with prices ₹999, ₹4,499 and ₹7,999 and the terms "no subscription", "Sessions never expire", "60-min sessions online", none of which is machine-readable.

**Recommendation.** Finding stands as written. Severity high -> medium. Replace the recommendation with:

Add an `offersJsonLd()` builder to lib/seo/structuredData.ts and render it from app/(marketing)/pricing/page.tsx alongside the existing FAQPage node, built from the `prices` array that `getPlansWithFeatures()` already returns. Three changes to the proposed shape:

1. Give the Organization node an `@id`. In app/layout.tsx:85 add `"@id": "https://www.myyogaclasses.fit/#organization"` to orgJsonLd, then `provider: {"@id": "https://www.myyogaclasses.fit/#organization"}` resolves instead of dangling.

2. Do not use AggregateOffer, and do not try to resolve currency per request. AggregateOffer carries a single `priceCurrency`, so it cannot express both live currencies. Emit a flat `offers` array of six Offer nodes directly on the Service, one per pack per priced currency, read straight from plan_prices at build time:
   INR 999.00 / 4499.00 / 7999.00 and AED 59.00 / 275.00 / 499.00.
   Each node: `{"@type":"Offer","name":"<pack name>","price":"...","priceCurrency":"INR"|"AED","availability":"https://schema.org/InStock","url":"https://www.myyogaclasses.fit/pricing","eligibleQuantity":{"@type":"QuantitativeValue","value":<1|5|10>,"unitText":"session"}}`.
   Multiple currencies on one item is valid schema.org and sidesteps the ISR problem entirely: nothing reads headers, the (marketing) group stays static, and the markup is a superset of what the page can render rather than a claim that contradicts it for AED visitors.

3. Higher-value placement exists and the finding missed it. Google's Course rich result DOES support `offers`, and lib/seo/structuredData.ts:49-65 already emits Course on all nine /classes/[slug] condition pages with no offers property. Adding `offers` there (plus the `provider` @id fix) targets a rich result Google actually renders, unlike Service.offers on /pricing. Do both; prioritise the Course one.

No new third-party origin is involved, so next.config.ts CSP is untouched. No user-facing copy changes, so the DB-driven-copy and no-em-dash constraints do not apply.

---

## BACKFILL: critic-gaps (8)

### [CRITICAL] The site is absent from both Google and Bing. Nothing on this domain can rank because nothing is indexed.

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high

**Evidence.** Google exact-phrase test on the unique live H1 "Yoga for diabetes, shaped around you" returns healthline.com, myyogateacher.com, redcliffelabs.com, shvasa.com, webmd.com and stanford.edu. Zero URLs from myyogaclasses.fit. `site:myyogaclasses.fit` returns the GitHub repo and unrelated yoga domains, no page from the site. Bing: I fetched https://www.bing.com/search?q=site%3Amyyogaclasses.fit (HTTP 200) and the rendered result text is 10 Microsoft Windows-support and elevenforum.com results, i.e. Bing has no rows for the host and fell through to generic matches. Bing exact-phrase query for the same H1 returns 0 occurrences of the string "myyogaclasses" in the SERP HTML. `whois myyogaclasses.fit` → Creation Date: 2026-06-01T15:22:17Z (3.5 months as of 2026-09-18).

**Recommendation.** Keep the finding and the critical severity. Replace the recommendation as follows.

1. DROP THE CONTENT FREEZE. "Freeze all content expansion until at least 15 of the 23 sitemap URLs report Indexed" and "Do not add a single new page until the index count is non-zero" are wrong, and they contradict the audit's own item 3. A 3.5-month-old domain with 23 URLs, no backlink profile and nine orphaned condition pages is the exact profile Google parks in "Discovered, currently not indexed". Crawl demand on such a domain is driven by external links, internal link depth and topical footprint, none of which a GSC submission supplies. "Request indexing" is quota-capped at roughly 10 URLs per day per property and confers no guarantee of indexing. Freezing content removes the only lever the owner actually controls. Fixing the internal link graph (item 3) and publishing the 107 already-written pose entries (item 4) IS the indexation work, not a thing to hold back until indexation happens.

2. CORRECT THE GSC PRECONDITION. The parenthetical "the DNS TXT is already in place" overstates it. `dig +short TXT myyogaclasses.fit` returns two records: `"v=spf1 include:_spf.google.com ~all"` and `"google-site-verification=-KzwTiCrZvl1upIYAYmy7wbuW46q6lBdxuaRT1GZSVk"`. Given the Google SPF include, that token is almost certainly the Google Workspace domain-verification token, not a GSC-issued one. GSC auto-verifies a Domain property only when the token it issues for that account matches an existing record. Plan on adding a second TXT record. Separately I confirmed established item 11: no `google-site-verification` meta tag exists in the repo (grep over app/ and lib/) and none is present in the served homepage HTML.

3. ADD: apex to www is a 307, and should be 308 or 301. Verified live: `curl -sSI https://myyogaclasses.fit/` returns `HTTP/2 307` with `location: https://www.myyogaclasses.fit/`, and `https://myyogaclasses.fit/pricing` also returns `HTTP/2 307`. Meanwhile `http://myyogaclasses.fit/` returns `HTTP/1.0 308 Permanent Redirect` and `https://www.myyogaclasses.fit/pricing/` returns `HTTP/2 308`. Established item 5 credited "308 trailing-slash redirects" and is correct on that point, but it missed that the host-consolidation redirect, the one redirect that most needs to be permanent, is the temporary one. Fix it in the Vercel domain settings (set the apex redirect to permanent), not in code.

4. ADD: the sitemap reports a fake lastmod for all 11 static URLs. `app/sitemap.ts` sets `lastModified: new Date()` on every entry in `STATIC_ROUTES` (lines 7 to 70). Verified live: /, /about, /classes, /pricing, /teachers, /reviews, /faq, /contact, /legal/privacy, /legal/terms and /legal/refund all carry `2026-09-18`, today, while the 12 DB-driven URLs carry real dates (/teachers/dr-vaishnavi-mayya 2026-06-17, /teachers/dr-sangeeta and /teachers/dr-hima-bindu 2026-08-02, all nine /classes/* 2026-06-21). Google discards lastmod it judges unreliable, and "every static page changed today, every time you ask" is the textbook unreliable case. Replace with a hardcoded per-route date constant bumped on real edits. Note the interaction with the DB-driven copy constraint: hero and subhead come from admin_settings, so a code constant will not reflect an admin copy edit. That is acceptable, an approximately correct lastmod beats a provably false one.

5. MINOR, informational: sitemap.xml is fully dynamic. `app/sitemap.ts:2` imports `createSupabaseServerClient`, which calls `cookies()`. Live headers show `x-vercel-cache: MISS`, `cache-control: public, max-age=0, must-revalidate`, `age: 0`, and no `x-nextjs-prerender`, versus `x-nextjs-prerender: 1` on /. It sits at the app root so it does NOT poison the (marketing) ISR group, no constraint is violated, but each crawler fetch is an uncached DB round trip. Switch to the anon client if you touch the file for item 4.

6. KEEP, unchanged: the GSC Domain property plus sitemap submission, URL Inspection on /, /classes/diabetes, /classes/prenatal, /pricing and /teachers, Bing Webmaster Tools via Google import, and the IndexNow POST of all 23 URLs. IndexNow is the highest-value item on that list because Bing acts on it directly and it costs one static key file, which needs no CSP change since it is same-origin.

### [CRITICAL] The site publishes fabricated social proof in four separate places, including a literal "Placeholder, swap for a real review" on all nine condition pages. This is a launch blocker, not an SEO nit.

- **Verdict:** confirmed | **Effort:** moderate | **Impact:** high

**Evidence.** Homepage visible text: "★★★★★ 4.9 · 1,200+ reviews" (source: lib/data/landing.ts:288 `"landing.trust_count": "1,200+ reviews"`, overridable from admin_settings). /reviews renders exactly SIX review cards (Emma R. Dubai, James P. Abu Dhabi, Fatima H. Abu Dhabi, Noor S. Sharjah, Mohammed A. Dubai, Priya N. Bengaluru) — the established list's "12 reviews" and offpage's "12 published" are both wrong; the critic's 6 is correct. Teacher pages publish per-teacher counts the site cannot support: /teachers/dr-sangeeta renders "5.0 · 312 reviews", /teachers/dr-vaishnavi-mayya renders "4.8 · 98 reviews". The homepage "Next available" card reads "Gentle Hatha with Aarti / Today · 7:00 PM your time · 60 min", hardcoded at components/marketing/Hero.tsx:191 — "Aarti" is a mock-data name (lib/data/landing.ts:26 `display_name: "Aarti Deshmukh"`) and is not one of the three live teachers. And live on https://www.myyogaclasses.fit/classes/diabetes, directly under the testimonial: "Placeholder, swap for a real review. Member · practising for 5 months" — present in all 9 files as `testimonialWho`.

**Recommendation.** Before any indexation push: (1) set admin_settings `landing.trust_count` to the true figure or remove the trust bar; (2) remove or source the per-teacher rating/review counts; (3) replace the Hero "Next available" card with a real next-open-slot render or delete it, since it names a nonexistent teacher; (4) replace `testimonialWho` in all 9 lib/data/condition-pages/*.json with a real attribution or delete the testimonial block from ConditionLanding. Getting indexed while shipping "Placeholder, swap for a real review" on your nine best pages is worse than not being indexed.

### [HIGH] ADJUDICATION — the critic is right on the title fix, and `technical` is wrong. Adding `seoTitle` to the 9 JSON files is a pure code change with no DB write.

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high

**Evidence.** app/(marketing)/classes/[slug]/page.tsx:32-33 reads `title: c?.name ?? "Class"` from the DB row but `description: rich?.metaDescription ?? c?.long_description ?? c?.description` from repo JSON. lib/data/condition-pages/diabetes.json already ships a `metaDescription` key: "Gentle 1:1 yoga for diabetes: easy movement, breathwork, and rest to support steady energy and calmer days, practised alongside your medical care." Live result today: `<title>Diabetes · My Yoga Classes</title>` — 29 characters, one of which is a keyword, on the site's single best page.

**Recommendation.** Finding stands at high severity with corrected numbers and a completed recommendation.

Corrected evidence: the live title is 26 characters, not 29. The brand suffix is 18 characters, so the usable budget is 42.

Implementation, three files not two:
1. lib/data/condition-pages.ts — add `seoTitle: string;` to the `ConditionPage` type next to `metaDescription`. Required or typecheck fails.
2. lib/data/condition-pages/*.json (all 9) — add a `seoTitle` key beside the existing `metaDescription`.
3. app/(marketing)/classes/[slug]/page.tsx:32 — `title: rich?.seoTitle ?? c?.name ?? "Class",` and add `openGraph: { title: rich?.seoTitle ?? c?.name, description: rich?.metaDescription }` in the same returned object, so social and LLM crawlers stop seeing the generic sitewide OG title.

Replacement example titles, all measured at or under 42 characters:
- diabetes: "Online 1:1 Yoga for Diabetes" (28 → 46 rendered)
- hypertension: "Online 1:1 Yoga for High Blood Pressure" (39 → 57)
- prenatal: "Online 1:1 Prenatal & Postnatal Yoga" (36 → 54)
- geriatric: "Chair-Friendly 1:1 Yoga for Seniors" (35 → 53)
Drop "Live with a Yoga Doctor" from the prenatal title: it is true today but depends on one teacher's live DB record and on migration 0024's compliance line.

Alternative if the full keyword phrase is wanted: set `title: { absolute: "..." }` in generateMetadata to bypass the parent template. That frees the whole ~60-character budget and makes the original 49-character examples viable, at the cost of dropping the brand from the SERP title on those 9 pages.

### [HIGH] VERIFIED as requested: only INR and AED actually render. USD, GBP and EUR are schema-enabled but unpriced, so every US, UK and EU visitor is quoted rupees.

- **Verdict:** confirmed | **Effort:** moderate | **Impact:** high

**Evidence.** `GET https://www.myyogaclasses.fit/api/region` returned `{"country":"IN","currency":"INR","locale":"en-IN"}` from my request. The /pricing RSC payload contains exactly two currency values across six rows: `\"currency\":\"INR\"` ×3 and `\"currency\":\"AED\"` ×3. lib/razorpay/catalog.ts:177-182 adds a currency to the priced set only when every active plan id is covered, so with 3 active plans and rows in 2 currencies only, USD/GBP/EUR fail the `.every()` check and effectiveCurrency() downgrades to INR. The visible footer line on /pricing confirms it: "Prices shown in INR." Migration 0036 states this explicitly in its own header: "this migration deliberately inserts NO prices."

**Recommendation.** Keep the finding and the recommendation as written. Repair the evidence chain and add the rail:

Evidence (replace the /api/region line): lib/data/landing.ts:360 selects plan_prices unfiltered, so the live /pricing payload contains every price row in the DB. It contains exactly six, three INR and three AED, across three active plans (pack-1 ₹999/AED 59, pack-5 ₹4,499/AED 275, pack-10 ₹7,999/AED 499). Zero USD, GBP or EUR rows exist. lib/razorpay/catalog.ts:177-180 therefore fails its `.every()` coverage check for those three currencies and effectiveCurrency() (catalog.ts:196-200) downgrades to INR, on the server and again client-side at components/marketing/PricingTeaser.tsx:160-162, which prints "Prices shown in INR" at line 411. Migration 0036's header confirms the intent: "this migration deliberately inserts NO prices."

Add to the finding: it is not only the quote that is wrong for Western visitors, it is the rail. app/api/payments/intent/route.ts:101-105 sends every non-AED visitor to Razorpay, and line 35 of the same file records that Razorpay International is not enabled on the account, which is the entire reason UAE buyers get a manual SWIFT rail instead. A US, UK or EU buyer gets an INR Razorpay order on an Indian account with no International acceptance and no bank-transfer fallback. UAE has a working path; the West has none.

Add to the recommendation, sequenced before (a): confirm migration 0036 is applied to the live DB (psql check on the plan_prices_currency_check constraint), or the USD price an admin types in /admin/plans will be rejected by the CHECK. The admin UI itself is ready: components/admin/PlansAdmin.tsx:400 already renders a field per SUPPORTED_CURRENCIES entry.

Separable quick win the finding did not include, shippable today and independent of the currency decision: app/(marketing)/pricing/page.tsx:13 currently reads "Honest yoga pricing in AED and INR. One-time session packs, no subscription." That is the SERP snippet for every US and UK searcher. Titles and meta live in code, not the DB, so rewrite it to something currency-neutral, for example "One-time packs of live 1:1 yoga sessions with teachers in India. No subscription, sessions never expire." Note this is cosmetic while the rail is broken, so do not treat it as a substitute for the currency work.

Price benchmark correction for the surrounding audit: the 5-pack is roughly USD 10 per session in INR and USD 15 in AED, not the "$23-24/session" the first pass recorded.

### [MEDIUM] ADJUDICATION — the critic is right that mass page production is the wrong bet, and the pose corpus proves it quantitatively.

- **Verdict:** partially-correct | **Effort:** substantial | **Impact:** high

**Evidence.** I re-derived the corpus from lib/data/condition-pages/*.json: 9 files, 35 poseGroups (not 36 as established item 4 states), 107 pose entries, 55 unique Sanskrit names, 65 unique English names, 1,070 total description words, mean 10.0 words per entry. Worse for the scaling case: 17 poses already appear on more than one condition page, and the reuse is concentrated — Shavasana on 8 of 9 pages, Bhramari on 7, Yoga Nidra on 7, Nadi Shodhana on 6, Marjaryasana-Bitilasana on 6, Tadasana on 5, Balasana on 5. So an /yoga-asana/shavasana page built from this seed would be spun from a single ~10-word description that is already duplicated eight times on the site. Meanwhile the existing condition page is genuinely substantial: /classes/diabetes renders 978 visible words.

**Recommendation.** Keep the verdict, fix the evidence and the framing.

Restated evidence: the 107 pose entries across 35 poseGroups are already live, not held back. They supply 1,070 words at a mean of 10.0 per entry, and 17 Sanskrit names repeat across pages with heavy internal near-duplication, for example Shavasana on 8 pages with only 4 distinct descriptions and 5 of those byte-identical. An /yoga-asana/shavasana page spun from this seed would not publish new text, it would re-publish roughly 45 words already served on 8 URLs of the same domain. That is internal near-duplicate generation, which is a stronger argument against the plan than "thin new page."

Extra nail the finding missed: 55 unique Sanskrit names is a hard ceiling on corpus-seedable asana pages. myyogateacher.com carries 84 /yoga-asana URLs. The 97-page target cannot be filled from this seed even at one page per unique name.

Recommendation, amended: reject the 40-to-97-page plan and ship 6 to 10 finished pages. Order them behind the two blockers first. Before any new page, remove the placeholder testimonial from all 9 condition JSONs and correct the homepage review claim, because a YMYL health page carrying "Placeholder, swap for a real review." in visible text and a "4.9 · 1,200+ reviews" bar over an empty reviews table is a live trust and advertising problem, not a ranking one. Then submit the sitemap in the existing Search Console property so there is a crawl path at all.

Then the page work: finish the 9 condition pages in place with original images, a real testimonial, a named teacher credential, citations, and contextual cross-links out of the pose sections, plus one "private 1:1 online yoga" pillar, one cross-timezone page, and one cost-comparison page. If asana pages are ever built, each needs original photography and 400 or more words of its own, and the condition pages must then link to them rather than repeat them.

On price: put a static INR "from" figure on the condition pages or fetch /api/region from a client component. Do not read request headers in a server component under app/(marketing), which would force those ISR routes dynamic group-wide with no build error.

### [MEDIUM] CORRECTION to the audit: the 5-pack is $9.38 per session, not "$23-24". The audit priced it off a stale AED figure that migration 0031 already replaced.

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high

**Evidence.** Live /pricing renders ₹999 / ₹4,499 / ₹7,999 and the RSC payload carries exactly six plan_prices rows: INR 99900 / 449900 / 799900 and AED 5900 / 27500 / 49900. At the live rate I pulled (open.er-api.com, 2026-09-18, USD→INR 95.957, USD→AED 3.6725): the INR 5-pack is $46.88 total, $9.38 per session; the 10-pack is $8.34 per session; the AED 5-pack is $14.98 per session. The audit's "$23-24" corresponds to the retired AED 435 5-pack (AED 87 ÷ 3.6725 = $23.69), which migration 0031_pack_pricing_update.sql superseded. Against the audit's own US benchmark of $60-120/hr the real gap is 6x to 13x on INR, not 2.5x to 5x.

**Recommendation.** Keep the price correction verbatim, it is right: the 5-pack is ₹4,499, i.e. ₹899.80 or $9.38 per 60-minute session; the 10-pack is ₹799.90 or $8.34; the AED 5-pack is AED 55 or $14.98; "$23-24" is the retired AED 435 price that migration 0031 superseded.

Restate the gap against a benchmark the audit agrees on. Say: "$8.34 to $10.41 per live 1:1 session, against roughly $21 list at the nearest comparable platform and $60-120/hr for an independent US teacher." Do not lead with "6x to 13x" while another finding in the same audit calls that comparison set wrong. Resolve which benchmark stands before either number ships.

Rewrite the recommendation with its precondition first: (1) confirm Razorpay International/multi-currency acceptance is live on the account, because app/api/payments/intent/route.ts:101 sends every non-AED visitor to Razorpay at the effective currency and create-order mints the order in it, so adding a USD row without International turns a downgraded-but-working checkout into a failing one for exactly the US, UK and EU visitors this is meant to win; (2) only then price all three active packs in USD, GBP and EUR in /admin/plans (partial coverage is a no-op, pricedCurrencies requires every active plan to have a row); (3) set the amounts as a commercial decision, not an FX conversion, since a literal $46.88 five-pack reads as a quality signal problem in a market anchored at $21 to $120.

Separately, and independent of the currency question, the SEO-actionable part is that the prerendered /pricing a crawler indexes shows only ₹ figures and "Prices shown in INR", so the indexed snapshot leads with a symbol foreign to the target searcher. That is fixable in code today, without touching prices or the payment rail, by replacing the meta description at app/(marketing)/pricing/page.tsx:13 (currently "Honest yoga pricing in AED and INR. One-time session packs, no subscription.", 76 chars) with one that leads on the product, and by adding Product/AggregateOffer JSON-LD. Do that first; the currency rollout is gated on a payments decision that is not an SEO call.

### [LOW] CORRECTION to the audit: Google verification already exists as a DNS TXT record. Item 11 ("no GSC verification tag found") is true of the codebase but wrong about the property.

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high

**Evidence.** `dig +short TXT myyogaclasses.fit @8.8.8.8` returns `"google-site-verification=-KzwTiCrZvl1upIYAYmy7wbuW46q6lBdxuaRT1GZSVk"` alongside `"v=spf1 include:_spf.google.com ~all"`. Separately, `grep -rn "google-site-verification|msvalidate" app/ lib/` over the repo returns zero verification tags, which is why the code-only audit missed it. No BingSiteAuth.xml (404), no /indexnow.txt (404).

**Recommendation.** Corrected finding: The original audit item 11 ("no GSC verification tag found in the codebase") is factually accurate. What it could not see is that a Google verification token already exists at the DNS layer: myyogaclasses.fit has TXT "google-site-verification=-KzwTiCrZvl1upIYAYmy7wbuW46q6lBdxuaRT1GZSVk", almost certainly minted by Google Workspace setup (it sits alongside "v=spf1 include:_spf.google.com ~all"). This means ownership is already provable, but it does NOT mean a Search Console property exists or that the 23-URL sitemap was ever submitted. Severity: low, because the only thing it changes is skipping about three lines of metadata.

Corrected recommendation:

1. Do not add a `verification` block to app/layout.tsx. Instead, in Search Console, add a Domain property for myyogaclasses.fit. It will verify instantly against the existing TXT, and sc-domain: covers apex, www and any future subdomain across http and https, which a URL-prefix meta tag would not. Note the apex already 307s to www, so www is the only surface that matters today. This is an owner-console task, zero code, zero deploy.

2. Once the property exists, submit https://www.myyogaclasses.fit/sitemap.xml and read the Pages report. That report, not the presence of a TXT record, is the thing item 11 was really pointing at, and it is still entirely unknown. Confirming whether all 23 URLs are indexed is the actual next step.

3. Bing: use "Import from Google Search Console" once step 1 is done. This needs no BingSiteAuth.xml and no code. Currently /BingSiteAuth.xml returns 404, consistent with no Bing property.

4. IndexNow: optional and low priority, since Google does not consume it. If it is done anyway, do not hook it to app/api/admin/revalidate/route.ts alone. That route only fires from the teacher-media save path and only revalidates "/", "/teachers" and "/teachers/{slug}", so it would never ping Bing about the nine condition pages or any new content page. A deploy-time or sitemap-diff-driven submitter covers the pages that actually matter. The CSP and ISR analysis in the original recommendation is correct either way: a static public/<key>.txt and a server-side fetch touch neither next.config.ts nor the (marketing) render mode.

### [LOW] Zero inbound hyperlinks. The only crawl entry point is a sitemap Google has no reason to have fetched, and the one asset that ranks does not link to the site.

- **Verdict:** partially-correct | **Effort:** quick-win | **Impact:** high

**Evidence.** I fetched https://github.com/Shalom-P/yoga-website: the About homepage field is `yoga-website-seven-mocha.vercel.app`; there are ZERO hyperlinks on the page whose href resolves to myyogaclasses.fit (the domain appears only as plain text in the description and README). The About description is verbatim "Conversion-first yoga studio web app — Next.js 16 + Supabase + PayPal + Google Meet. AU customers, IN teachers." — stale on three counts (PayPal was replaced by Razorpay, AU was replaced by worldwide, and it advertises a dead URL). This repo is the top result for `site:myyogaclasses.fit` on Google, so it is the domain's most visible web asset and it is not a link.

**Recommendation.** Corrected finding: "The GitHub repo is the #1 result for the brand string `myyogaclasses.fit` and it advertises a 404 URL with a stale description. Separately, Google has indexed 2 of the 23 sitemap URLs."

Severity: low for the GitHub item, medium for the index-coverage item they conflated it with.

Corrected evidence: the About payload is `"website":"https://yoga-website-seven-mocha.vercel.app"` (HTTP 404) and `"description":"Conversion-first yoga studio web app — Next.js 16 + Supabase + PayPal + Google Meet. AU customers, IN teachers."`. Zero hrefs resolve to the canonical host (only `href="#myyogaclasses"`). Repo is 0 stars / 0 watchers / 0 forks and GitHub nofollows the About link, so no link equity is at stake. The cost is purely that someone searching the brand name sees the wrong stack and clicks a dead link.

Corrected recommendation:
1. Keep only the first half of the original: set the About homepage field to https://www.myyogaclasses.fit and replace the description with "Live 1:1 online yoga, teachers in India, students worldwide. Next.js 16 + Supabase + Razorpay." (This is repo metadata, not site copy, so the DB-driven-copy and scrubRetiredCopy constraints do not apply; the proposed string already avoids em-dashes and free-trial wording.) Treat it as 60 seconds of housekeeping, not a critical path.
2. Drop the "build the Instagram bio link" item. It exists: `l.instagram.com/?u=https%3A%2F%2Fwww.myyogaclasses.fit%2F`, and it is already mirrored by `sameAs` in the live Organization JSON-LD.
3. Drop the Google Business Profile item. An online-only worldwide service with no location and no service area is not eligible, and filing one invites suspension.
4. Replace the whole premise. The real problem is index coverage, not discovery: Google has crawled the site and holds 2 URLs (/ and /legal/terms) against 23 in the sitemap. The correct next action is Google Search Console verification (established-list item 11 says no verification tag exists in the codebase) so the owner can read the actual Page Indexing report and see why 21 URLs are Discovered or Crawled but not indexed. Add the verification via a `google-site-verification` meta tag in the root `metadata.verification` in app/layout.tsx, which is a static string and does not touch cookies(), so ISR in the (marketing) group is unaffected and no CSP origin is added.
5. Add as a new item: the Bing/DDG index is serving pre-scrub condition-page descriptions containing "First session free." and em-dashes, while live HTML is clean. Request re-crawl of the nine /classes/* URLs via Bing Webmaster Tools URL submission so the retired free-trial wording stops appearing in public SERPs.

---

## Refuted by adversarial verification

- **[eeat-ymyl]** The medical disclaimer is section 10 of 11, below the fabricated testimonial and below the FAQ accordion, roughly eight screens down on mobile
  - Why refuted: WHAT I CHECKED

1. Read /Users/shalomp/YOGA_WEBSITE/components/marketing/condition/ConditionLanding.tsx in full. The structural claim reproduces exactly: file is 287 lines, `{/* 10 · SAFETY */}` is at line 267, `{/* 11 · FINAL CTA */}` at line 283, testimonial at 231, FAQ at 241. That part of the evidence is correct.

2. Read lib/data/condition-pages/diabetes.json. safetyText matches the quoted string verbatim. safetyTitle is "Yoga supports your care, it doesn't replace it".

3. Fetched all nine live condition pages with curl (HTTP 200, ~90 KB each) and extracted rendered text. THE FINDING'S CENTRAL PREMISE IS FALSE. The live markup on /classes/diabetes is:

   `<h1 ...>Yoga for <em>diabetes</em>, shaped around you.</h1><p class="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground text-pretty">Gentle 1:1 sessions of easy movement, breathwork, and rest, built around your body, your routine, and how you feel each day. Practised alongside the care your doctor provides.</p>`

   The qualifier is the immediate next sibling of the H1, at rendered word ~60 of 857, in `text-lg` (18px body type, not a micro-font). The finding recommends adding "a short qualifier in viewport 1, directly under the H1 byline, in normal body type". That is already shipped.

4. Swept all nine live pages for a doctor/midwife/therapist qualifier in the hero lead paragraph. 8 of 9 have one: diabetes, hypertension, hormonal-health, geriatric ("Practised alongside the care your doctor provides"), pain-relief ("alongside any care from your doctor"), mental-health ("alongside any care from a doctor or therapist"), weight-loss ("alongside your doctor's guidance"), prenatal ("Practised once your doctor or midwife has cleared you"). Only kids-yoga lacks it, and kids-yoga makes no health claim (focus, flexibility, calm for children).

5. The prenatal sub-claim is specifically wrong. The finding says the clearance requirement "is currently buried in the session checklist roughly 700 words in". I measured it: the checklist item at prenatal.json:143 is the SECOND mention. The FIRST is prenatal.json:7 heroLead, rendered at word ~66, above the fold, and reinforced at word ~113 in the empathy band ("always within what your doctor or midwife has cleared"). The exact remedy the finding proposes for prenatal is already live.

6. The "only other medical disclaimer on the whole site" claim is wrong twice. app/(marketing)/classes/[slug]/page.tsx:145-150 carries a second disclaimer in the SimpleDetail fallback. And legal/terms §9 is two paragraphs at lines 222-232, not the single one cited at 226-231; the first paragraph ("we strongly recommend you consult a medical professional before beginning any exercise programme") is the one that actually matters and the finding omitted it.

7. The "fabricated testimonial" characterization is inverted, and materially so. diabetes.json testimonialWho is literally `<strong>Placeholder, swap for a real review.</strong> Member · practising for 5 months`, and I confirmed the string "Placeholder" renders in the live HTML of all nine pages. The testimonial is not fabricated; it is an unfilled placeholder shipped to production. That is a genuine E-E-A-T defect, but it is a different finding and the opposite of the one claimed.

8. Measured the real depth: 857 rendered words precede the safety block on /classes/diabetes, 858 on /classes/prenatal. I also confirmed the FAQ accordion answers are NOT server-rendered (zero `data-state="closed"` nodes; the answer text is absent from the DOM), so that 857 is the true visible-text depth, not inflated by hidden FAQ copy.

CONCLUSION

The structural observation reproduces, but the entire actionable payload of the finding is already implemented and the finding missed it, which is an explicit refutation condition. The "high" severity rests on the assertion that no proximate disclosure exists anywhere near the claim; on 8 of 9 pages a proximate disclosure sits one DOM node below the H1. Under the FTC .com Disclosures proximity standard the finding invokes, a qualifier adjacent to the H1 is about as proximate as it gets. There is no compliance gap of the size claimed, and no SEO or revenue impact. The only residual item is kids-yoga, which makes no health claim, so severity is low at most.

- **[kw-informational]** Pose pages need a Precautions section as the primary conversion wedge, not as a disclaimer footnote.
  - Why refuted: WHAT I CHECKED

1. The three cited JSON files, parsed directly (python json.load on /Users/shalomp/YOGA_WEBSITE/lib/data/condition-pages/*.json).
2. The live page https://www.myyogaclasses.fit/classes/diabetes (curl, 90,549 bytes of server-rendered HTML, x-nextjs-prerender: 1).
3. The renderer /Users/shalomp/YOGA_WEBSITE/components/marketing/condition/ConditionLanding.tsx lines 133-172.
4. The external source the finding cites (yogauonline.com Viparita Karani page).
5. The named competitor's equivalent page (myyogateacher.com/yoga-asana/legs-up-the-wall-pose).
6. Whether /poses/[slug] exists at all.

WHAT REPRODUCES (the quotes are accurate)

All four quoted strings are verbatim correct. diabetes.json poseGroup index 2 note: "Stronger practices like Kapalbhati are introduced only after your teacher checks they're right for you. They're skipped if you also have high blood pressure or a heart condition." prenatal.json Malasana desc: "With support, and only later in pregnancy when baby is head-down, skipped in early pregnancy or if advised." prenatal.json Supta Baddha Konasana desc: "Restful and bolster-supported on an incline (never flat on your back) to open and ease the hips." All nine files carry `selectionNote`. Viparita Karani is present in hormonal-health.json and mental-health.json and absent from hypertension.json.

Everything the finding builds on top of those quotes fails.

FAILURE 1 - "the repo writes the argument and then hides it" is false. Both strings are published and server-rendered on the live site. grep of the fetched /classes/diabetes HTML returns the Kapalbhati note inside `<p class="mt-4 max-w-3xl text-sm italic text-muted-foreground">`, and the selectionNote inside `<p class="max-w-2xl font-[family-name:var(--font-heading)] text-xl leading-snug text-foreground">`. The selectionNote is not a footnote at all: it renders in the heading font at text-xl as a pull-quote, the most prominent non-H2 text in that section. ConditionLanding.tsx:167-171 confirms. There is also already a live safety block (ConditionLanding.tsx:277-278 rendering safetyTitle/safetyText).

FAILURE 2 - the external corroboration says the opposite of what the finding claims. I fetched the exact YogaUOnline page. It does NOT list hypertension as a pose to avoid. Its contraindication list is glaucoma, detached retina, hiatal hernia, heart conditions, menstruation, spondylolisthesis/spondylolysis, 2nd/3rd trimester pregnancy. For blood pressure it gives a modification, not an exclusion: "People with controlled high blood pressure can modify by lying flat on the floor with their legs up the wall." Yoga International, Boldsky and Cleveland Clinic all present legs-up-the-wall as neutral-to-helpful for BP. The proposed public copy ("it is one of the poses commonly avoided with uncontrolled high blood pressure") would therefore be a disease-specific medical warning published on a marketing page on the strength of a citation that does not support it.

FAILURE 3 - the "cross-condition contradiction" is manufactured. hypertension.json's own poseGroup note states the actual rule: "We keep the head at or above heart level and leave out full inversions and any breath-holding." Viparita Karani keeps the head level with the heart and is not a full inversion, so that file's stated rule permits it. Its absence is an authoring gap, not a curated avoid decision, and there is nothing in the repo to indicate otherwise.

FAILURE 4 - the proposed source material does not exist at the required scale. Only 14 of 35 poseGroups carry a `note` at all (diabetes 1/4, mental-health 1/4, pain-relief 1/4, weight-loss 1/4, hypertension 2/3, others 2/4). Across all 107 pose entries, exactly 3 descriptions contain any precaution wording (regex on skip|avoid|never|only after|caution). "Reuse the existing note and selectionNote strings as the source" would populate 3 of 107 pose pages. The other ~104 need newly authored per-pose contraindication copy for named diseases, which is precisely the writing that supabase/migrations/0024_category_copy_positive.sql was built to constrain (its header records a "vetted by an adversarial UAE (DHA/MOH) + India (ASCI / Drugs & Magic Remedies Act) compliance pass"). The finding presents a large net-new medical-copy authoring and legal-review project as a string-reuse task.

FAILURE 5 - the differentiation claim is flatly wrong, and this is what kills the severity. The finding asserts this is "content no competitor page surfaces" and "the one section an AI Overview will not confidently answer." I fetched myyogateacher.com/yoga-asana/legs-up-the-wall-pose, one of the 613-URL competitor's 84 asana pages. It already carries a dedicated H2 "Viparita Karani Precautions & Contraindications", an "Avoid Viparita Karani If You Have:" list whose entries include "Uncontrolled high blood pressure", a separate "Practice With Caution If You Have:" subsection covering mild hypertension, and an attached 1:1 booking CTA. The recommendation is a near-reproduction of the market leader's existing template. It is table stakes for the vertical, not a wedge, and the specific example chosen is the exact pose the competitor already covers.

FAILURE 6 - severity is misassigned to a page type that does not exist. `find app -type d -name "*pose*"` returns 0, no .tsx in app/ references poses, and live /poses and /poses/viparita-karani both return 404. All 23 sitemap URLs are the known set. A "high" severity cannot attach to a section on pages nobody has decided to build. Whatever value exists here is entirely downstream of the separate, already-established finding that 107 pose entries sit unpublished.

CONSTRAINT CHECK (for completeness): the proposed CTA copy "A teacher can see whether this is right for you" contains no em-dash and no free-trial wording, so it clears those rules. Condition-page copy is JSON-in-repo, not admin_settings, so the DB-driven-copy constraint does not bite. No CSP or ISR impact. The constraints are not what refutes this; the evidence is.

CORRECTION TO THE FIRST-PASS AUDIT: item 4 says "36 poseGroups". The actual count is 35 (4+4+4+3+4+4+4+4+4; hypertension has 3). The 107 pose figure is correct.

WHAT SURVIVES, IF ANYTHING: only the generic and already-known observation that pose pages should exist and should route to a 1:1 CTA. That is audit item 4, not a new finding, and the precautions angle as described is competitor parity rather than advantage.

- **[competitor]** myyogateacher.com's 116 teacher pages and its /pricing page are client-rendered shells with 18 and 20 words of server HTML, no H1 and no schema
  - Why refuted: I reproduced the finding's numbers exactly, then discovered they measure the wrong thing. myyogateacher.com does UA-based dynamic rendering, and the auditor fetched the browser shell, not what a crawler receives.

WHAT I RAN (all curl, same URL, only the User-Agent varied):
https://myyogateacher.com/yoga-teachers/divya-1
- no UA / Chrome UA: 11,873 bytes, 18 words, h1=0, ld+json=0  <- exactly the finding's numbers
- Googlebot UA: 131,697 bytes, 631 words, h1=1, ld+json=2
- bingbot UA: 131,697 bytes, 631 words, h1=1, ld+json=2

The crawler-served HTML contains `<h1 ...>Divya K</h1>` and two parsed JSON-LD blocks: a valid BreadcrumbList (3 ListItems) and a VideoObject carrying a full spoken-intro transcript ("Hi...I'm Divya, a certified advanced yoga instructor from The Yoga Institute, Mumbai...").

https://myyogateacher.com/pricing
- Chrome UA: 23,136 bytes, 20 words, h1=0  <- the finding's numbers
- Googlebot UA: 86,334 bytes, 690 words, h1=1 `<h1 ...>Membership Pricing</h1>`, and the plan prices ARE in the server HTML (grep found $84, $99, $46, $138, $177, $252). The finding's claim that "the actual plan grid only appears after JS executes" is false for crawlers.
- ld+json=0 even for Googlebot. This one sub-claim survives: /pricing genuinely has no schema.

CONFIRMED INDEXED: a web search for their teacher URLs returns rich indexed results with full profile content extracted, e.g. "Jeevitha M | Certified Yoga Teacher | MyYogaTeacher ... Rated 4.9/5 from 36+ students ... certified Ashtanga yoga teacher from Mysore". Google is demonstrably reading this content. Separately, Googlebot renders JS anyway, so even the shell would index.

THE STAT-COUNTER CLAIM IS MIS-TRANSCRIBED: there is no "0+ Happy Students / 0+ Yoga Teachers" string anywhere. The actual strings are "0+ Certified Teacher" (homepage) and "0+ students on MyYogaTeacher" (teacher page). This is real and appears in BOTH the browser and crawler HTML, so it is a genuine (tiny) competitor defect, but the quoted evidence is inaccurate.

TARGET-SIDE EVIDENCE MOSTLY CHECKS OUT: https://www.myyogaclasses.fit/teachers/dr-sangeeta returned 63,436 bytes (exact match), 172 words (finding said 171), one `<h1 ...>Dr Sangeeta</h1>`, and three JSON-LD blocks that parse as Organization, Person, BreadcrumbList. Header `x-nextjs-prerender: 1` confirmed; `x-vercel-cache` was STALE on my fetch, not HIT (trivial).

WHY THE CONCLUSION INVERTS: on crawler-visible text the target is BEHIND, not ahead. 172 words vs 631 words, and 0 `<h2>` on the target vs 5 on theirs. The target's genuine edges are narrower than claimed: it emits Person (they do not) and it is honestly prerendered for everyone. The finding frames this as "a real but narrow win" and rates it low; that framing is backwards and would cause the owner to under-prioritize a real content deficit.

RECOMMENDATION PROBLEMS:
1. Partly already implemented. The finding asks to add "languages". /Users/shalomp/YOGA_WEBSITE/app/(marketing)/teachers/[slug]/page.tsx already renders `{t.languages.join(" · ")}` and `{t.specialties.join(" · ")}`, and /Users/shalomp/YOGA_WEBSITE/lib/seo/structuredData.ts:45 already emits `knowsLanguage` (and `:44` `knowsAbout`).
2. Wrong surface for most of the fix. Teacher bio/headline/specialties come from the `teachers` DB table via `getTeacherBySlug` (lib/data/landing.ts:327, `.from("teachers").select("*")`). "Take the page from 171 to 450+ words" is an admin content task, not an edit to the cited repo file. The finding's Locations field points only at the page component.
3. It missed the actual cheap win. supabase/migrations/0002_teachers.sql already defines `years_experience int` and `certifications jsonb`, both admin-editable in components/admin/TeacherFormDialog.tsx (lines 310 and 337-345). A grep across app/, lib/, components/ shows NEITHER is rendered on the public teacher page and neither reaches personJsonLd. `certifications` is precisely the source the finding wants for `hasCredential`, and it is sitting there already populated-capable. That is a code change, no new columns, no DB copy edit.

`hasCredential` is genuinely absent (grep count 0 in the live HTML and in personJsonLd), so that half of the schema suggestion is valid and not already done.
