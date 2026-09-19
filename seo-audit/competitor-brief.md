## 4. Competitive positioning

### 4.1 Where the site actually stands

Four comparators. `myyogateacher.com` is the category leader and the direct format match (live 1:1, Indian teachers, English-speaking markets). `patanjaleeyoga.com` is the closest architectural rival, the only site in the set that has built a real condition-page template. The fourth slot goes to **`shvasa.com`**, not `shyambhai.yoga`: shyambhai is a same-operator twin of patanjalee running the identical 42-page marketing shell, whereas Shvasa is a funded Indian-teacher platform that explicitly sells into "US, UK, Canada, UAE and Australia" and publishes its own `/shvasa-vs-others` comparison page. Shvasa is the business this site will actually be compared against by a Western buyer.

All counts fetched live on 2026-09-16 with a full browser user agent.

| Dimension | myyogaclasses.fit | myyogateacher.com | patanjaleeyoga.com | shvasa.com | Winner |
|---|---|---|---|---|---|
| **Indexable URLs (sitemap)** | **23** | **613** (232 main + 381 articles) | **417** | **547** | MYT (26.7x the target) |
| **Article / blog pages** | **0**. No `/blog`, `/articles`, `/guides` route exists in `app/(marketing)` | **241** `/articles` + 14 category hubs | 222 posts | **449** `/yoga-blog` | MYT (best structured: category hubs + author + schema) |
| **Teacher pages** | **3** | **116** | 3 authors, no teacher template | 0 public teacher URLs | MYT |
| **Pose pages** | **0** dedicated URLs. 107 pose entries exist but render inside condition pages | **84** `/yoga-asana`, e.g. `/yoga-asana/bhujangasana` at 2,325 words | 0 | 0 | MYT (uncontested) |
| **Condition pages** | **9** `/classes/*` | **3** `/yoga-for-specific-goals/*` (back-pain, thyroid-issues, plus the hub) | **26** `/online-yoga-classes-for-*` incl. three separate trimester pages | **3** real (`/yoga-for-arthritis`, `-women`, `-men`) plus 16 paid-ad `/join/...-v2..v10` duplicates | Patanjalee. **Target is a clear second and beats the category leader 3 to 1** |
| **Content depth (same query, diabetes/condition)** | **973 words** | **2,099** | **1,957** | **2,258** (arthritis) | Shvasa. Target is roughly half of every rival |
| **Technical execution** | CSP, `strict-transport-security: max-age=63072000; includeSubDomains; preload`, `x-frame-options: DENY`, nosniff, referrer-policy, permissions-policy. `x-nextjs-prerender: 1`, `x-vercel-cache: HIT` | **Zero** security headers (`server: BunnyCDN`). `/pricing` server-renders **10 words**, fully client-side | XFO SAMEORIGIN + nosniff + referrer-policy only. No HSTS, no CSP | HSTS only | **Target, decisively** |
| **Structured data (condition page)** | Organization, ContactPoint, Course, CourseInstance. **No FAQPage, no BreadcrumbList** | Article, FAQPage, BreadcrumbList, Person, ImageObject, WebPage | BreadcrumbList, WebPage, WebSite, ImageObject, SearchAction | **None at all** on a 2,258-word page | MYT on the page; **target wins on validity**, since MYT's homepage Organization and BreadcrumbList blocks are unparseable leaked `{JSON.stringify(...)}` |
| **Global positioning** | Organization `areaServed: Worldwide`, but `og:locale` is the invalid bare `"en"`, no hreflang, and `/pricing` meta reads "Honest yoga pricing in AED and INR" | USD only, `addressCountry: "United States"` | `/online-yoga-classes-usa`, `/uk`, and a 3,086-word `/time-zones` page | "Students across US, UK, Canada, UAE and Australia", "24 timezones" claimed on the homepage | Patanjalee (only one with shipped geo + timezone URLs) |
| **Payment reach** | **INR + AED only.** Live `/pricing` payload contains exactly 3 AED and 3 INR `plan_prices` rows. `/api/region` returns `{"country":"IN","currency":"INR"}`; USD/GBP/EUR downgrade to INR via `effectiveCurrency()` | USD | INR + USD (WooCommerce) | USD | Patanjalee / MYT. **Target is last: it quotes rupees to the entire world** |
| **Price per 60-min 1:1** | **$9.37** (5-pack ₹4,499) / **$8.33** (10-pack ₹7,999) / $14.98 for a UAE buyer in AED | **$21.00** list ($84/mo ÷ 4 private), $14.75 on the 3-month intro | Rs 8,999/mo for 1:1, monthly commitment | $20 to $25 starting, subscription, group-first | Target on the number, but see 4.2: this is a closer, not a wedge |
| **Authority signals** | 1 `sameAs` (Instagram, 40 followers), 0 real reviews in the DB, no press, no external citations found | Press bar (Men's Health, Well+Good, Yahoo Life), `/press-media`, App Store 4.9 from 1,010 reviews, Product Hunt launch, `aggregateRating 4.9 / 360000` | Offline retreats across 5 cities, `/testimonials` | "Trusted by 10,000+ Members Worldwide", funded, self-published comparison page | MYT by a wide margin |
| **SERP feature presence** | **None eligible.** No Product/Offer on `/pricing`, no breadcrumbs on the 9 best pages, no review markup | Article + BreadcrumbList across 241 articles | BreadcrumbList sitewide | None | MYT |

**Corrections to the first-pass audit, from live evidence:**

- **Item 4 is wrong twice.** It is **35** poseGroups, not 36, and the 107 entries resolve to only **55 unique Sanskrit names** (Shavasana appears in 8 files, Bhramari in 7, Yoga Nidra in 7). More importantly they are **not unpublished**: they render live today, and the entire corpus is **1,070 words at an average of 10.0 words per description**. That is a hub skeleton, not 55 ready pages.
- **Item 7 is wrong.** There is **no FAQPage on the condition pages**. Live `/classes/diabetes` emits only `Organization`, `ContactPoint`, `Course`, `CourseInstance`. Forty-five written FAQs across the nine JSON files carry no markup, while the identical 9-entry generic FAQ set is triplicated across `/`, `/faq` and `/pricing`.
- **Item 11 is wrong.** Search Console **is** verified. `dig TXT myyogaclasses.fit` returns `google-site-verification=-KzwTiCrZvl1upIYAYmy7wbuW46q6lBdxuaRT1GZSVk`. It is a DNS-verified Domain property, which is why a repo grep for a meta tag found nothing. Do not spend a task re-verifying it.
- **Item 12 is wrong by a factor of 2.5.** The 5-pack is **$9.37 per session**, not $23 to $24 (that figure is the retired pre-0031 AED 435 price). And the $60 to $120 benchmark is the rate for **independent US teachers**, not the platform comparison set. The actual category leader charges $21.00.
- **Item 1 is wrong on shyambhai.** Its sitemap is readable, it is UA-gated (406 to curl's default agent, 200 to a browser agent), and it declares 752 URLs.

---

### 4.2 The wedge

**Claim: the only online yoga service where every teacher holds a clinical degree, and every condition has its own page taught by the clinician who specialises in it.**

The reason to believe this is unclaimed is not inference. It is what the competitors' own homepages say, counted:

| Term on homepage | myyogateacher.com | shvasa.com |
|---|---|---|
| "expert Indian teachers" | 10 | 0 |
| "certified Indian" | 3 | 0 |
| "clinical" | **0** | **0** |
| "doctor" | 1 (an external MD advisor, `/advisor/dr-loren-fishman`) | **0** |
| "authentic" | 4 | present ("authentic Indian tradition") |

MYT's H1 is `Online Yoga Classes with Expert Indian Teachers - Live!` with an H2 reading `200+ expert Indian teachers` and another reading `Yoga began in India, now it begins with you`. Shvasa's is `Real yoga, Real Teachers, Real Results` over `live, expert-led yoga classes with the depth of authentic Indian tradition`.

So four adjacent positions are already taken, and taking any of them is a losing fight:

1. **"Indian teachers"** is saturated. MYT says it ten times on one page and has 116 teacher URLs to prove it against your three.
2. **"Authentic tradition"** is Shvasa's stated core, reinforced with an Ayurveda pillar no one else offers.
3. **"Cheapest"** is already below you. ONE OM ONE sells 30 private sessions for $68, about $2.27 each, against your $8.33. Cheapest is also the wrong frame: at $9.37 for a 60-minute clinician-taught session you are not undercutting a $60 to $120 market, you are pricing below the point where a US buyer finds the credential credible. Price is the closer once they trust you, not the reason they click.
4. **"Cross-timezone"** is contested and, worse, partly untrue for you. Shvasa's homepage already claims `our schedule covers all time zones` and its comparison table scores itself "24 timezones" against MYT's "US-centric". Patanjalee ranks a 3,086-word `/time-zones` page. Meanwhile your own supply ends at 23:00 IST, which leaves the UK with exactly one bookable evening slot start per weekday (17:30 BST) and nothing at or after 18:00. Do not lead with a claim a competitor already outranks you on and that your roster cannot fully honour.

What none of them can answer is the intersection of three things you already have:

- **Roster concentration.** All three teachers hold Indian clinical qualifications: `MD in Clinical Yoga and a Bachelor of Naturopathy and Yogic Sciences`, `Yoga and Naturopathy Doctor`, `Medical Yogic Sciences`. MYT does have some BNYS holders among 200+, but a minority credential inside a volume roster cannot be marketed as the product. Yours is 3 of 3.
- **Condition architecture.** You publish 9 condition pages. The category leader publishes **3**. Shvasa publishes 3. This is the single row in the table where you beat the leader outright, and it is the row that matches the credential.
- **Format.** Genuine 1:1, 60 minutes. Shvasa is group-first and sells 1:1 as an upsell. MYT's private tier auto-renews and its own pricing FAQ says, twice, `we do not offer any refunds`.

Patanjalee is the only competitor near this territory, with 26 condition pages, but its claim is institute-level ("Patanjalee Institute of Yoga and Yoga Therapy"), not a named clinician attached to a named condition. There is no equivalent of pointing at Dr Vaishnavi Mayya's cardiovascular and musculoskeletal specialisation from the hypertension page.

**The site currently throws all three away in code.** `/teachers` ships `<title>Teachers · My Yoga Classes</title>` and a meta description saying every teacher is `Yoga Alliance trained`, which is the exact commodity claim MYT owns at 200x your scale, while the page body underneath lists an MD. `app/(marketing)/classes/[slug]/page.tsx:32` returns `title: c?.name ?? "Class"`, producing `<title>Diabetes · My Yoga Classes</title>`, a 26-character title with no keyword, on your nine strongest pages.

Two guardrails on the wording. For US, UK and EU readers "doctor" in a health-service context implies a licensed physician, which an Indian MD in Yoga and Naturopathy is not in those jurisdictions, so say "clinically trained" or name the actual degree, and never pair it with "therapy" or "treatment". And keep the existing "practised alongside your medical care" framing from migration `0024`: MYT's ranking title is `7 Yoga Poses for Diabetes: Asanas for Blood Sugar Control`, which is claim language you cannot use and should not want, since India's Drugs and Magic Remedies Act covers diabetes directly.

---

### 4.3 What we actually win on today

Seven things, all verified, none of them cosmetic.

1. **Security and delivery, and it is not close.** The target is the only site in the set serving a CSP, `x-frame-options: DENY`, `permissions-policy`, and HSTS with `preload`. MYT serves **no security headers at all**. Patanjalee serves three weak ones. Shvasa serves HSTS alone.
2. **Commercial pages are actually crawlable.** `myyogateacher.com/pricing` server-renders **10 words**. Its 116 teacher pages render 18. The target's `/pricing` is a 93,405-byte prerendered document with the full plan payload in the HTML. The leader's highest-intent pages are invisible to a non-rendering crawler; yours are not.
3. **Condition coverage beats the category leader 3 to 1**, 9 pages against 3, on the exact query class where a clinical credential converts.
4. **Valid structured data.** Small but real: MYT's homepage Organization and BreadcrumbList blocks fail `json.loads()` at column 2 because a `{JSON.stringify(...)}` JSX interpolation leaked into the output, so their `aggregateRating 4.9 / 360000` is machine-unreadable. Shvasa's 2,258-word condition page has **zero** JSON-LD. Every node you emit parses.
5. **Claim-safe copy is a moat, not a constraint.** The `0024` compliance pass means your condition pages would survive a DHA, MOH or ASCI complaint. MYT's "Asanas for Blood Sugar Control" would not. That gap becomes an asset the moment enforcement touches this category.
6. **The commercial contrast is genuinely better and genuinely unadvertised.** One-time packs, sessions never expire, a published refund policy, against a leader that auto-renews and refuses refunds in writing and a Shvasa subscription. This currently exists only as body copy a searcher never sees: `/pricing` ships `<title>Pricing · My Yoga Classes</title>`, 25 rendered characters.
7. **Markup hygiene.** One H1 per page, self-referential canonicals, true 404s, alt text present. Patanjalee ships duplicate H1s on its geo pages.

Being fair about the limits: none of these seven is a ranking mechanism on its own. They are the reasons the site will convert and hold position once it has traffic, not reasons it will get traffic.

---

### 4.4 Realistic timeline

**Months 0 to 3: no ranking movement is available, and that is not a failure.** A 23-URL site on a four-month-old .fit with one external link (Instagram, 40 followers) has no authority to deploy. Search Console is already verified by DNS TXT, so the measurement surface exists; the actual blockers in this window are commercial, not algorithmic. Two of them gate everything: confirm whether Razorpay International is live on the account, then price USD, GBP and EUR in `/admin/plans` (all three active plans per currency, since `pricedCurrencies()` withholds a partially covered currency). Until that lands, every US, UK and EU visitor is quoted in rupees, and traffic into a rupee checkout is wasted spend. Do the same-day fixes in parallel: condition titles, the `/teachers` credential copy, `og:locale` to `en_IN`, apex 307 to 308, BreadcrumbList on the nine condition pages, and remove the "Pending legal review, must be verified before launch" banner from all three live legal pages.

**Months 3 to 6: first long-tail placements.** Expect 20 to 100 organic sessions per month, almost all from the retitled condition pages. The realistic URL ceiling in this window is 23 to roughly 48, not 130: the pose corpus is 1,070 words total, so pose pages are a writing project (600 to 900 new words each), not an extraction. Depth is the bigger lever than count, since you are at 973 words against a 1,957 to 2,258 field on the same queries.

**Months 6 to 12: contest the condition cluster.** Patanjalee and shyambhai are beatable here. They are thin per page, run duplicate H1s, cite nothing, and their 26 condition pages carry roughly 5 in-body internal links each. MYT's 241-article hub plus 84 pose pages stays out of reach on head terms in this window.

**Months 12 to 24: head terms only with sustained link acquisition.** Nothing about the current off-page footprint suggests this arrives sooner.

**The fastest defensible wedge, in order:**

1. **Clinician-taught condition pages.** True, verifiable, expensive to fake, and unclaimed by every competitor measured above. It costs one PR to stop contradicting it in your own titles and meta descriptions. This is the highest return per hour available anywhere in this audit.
2. **The buyer-side cost page.** `/guides/what-private-online-yoga-costs`, naming real numbers: MYT at $84/mo for 4 sessions with no refunds, Shvasa at $20 to $25 on a subscription, US independents at $60 to $120. Every page currently ranking for that query is written by teachers pricing their own classes or by a lead-gen aggregator. You are the only participant with an incentive to publish honest numbers, and the page doubles as the landing surface for every roundup pitch.
3. **Internal linking on the nine condition pages.** They are dead ends today: 2 anchors in the body of `/classes/diabetes`, zero to the 8 siblings, zero to the 3 teachers. Fixing this is the cheapest way to make the credential and the condition cluster reinforce each other.

Do not chase MYT's 613 URLs. Do not build geo pages before the currencies are priced, since a "USA" page quoting rupees is a thin duplicate and a conversion failure at the same time. And do not lead on cross-timezone: Shvasa already claims it on its homepage, Patanjalee already ranks a page for it, and your supply ends at 23:00 IST.