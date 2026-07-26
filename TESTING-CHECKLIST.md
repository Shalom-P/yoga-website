# 🧘 My Yoga Classes — Final Manual QA Checklist

A surface-by-surface manual test plan assembled from 11 domain explorations. Work the **Reachability & wiring gaps** section first (it catches "the feature exists in code but is unreachable / silently no-ops" traps), then walk each surface; finish with the **Suggested test order** so prerequisite data (admin → teacher → availability → booking) exists before each step.

---

## ⚠️ Reachability & wiring gaps to verify FIRST

These are environment / migration / scheduler dependencies that make working features *look* broken. Verify each on the **actual target environment** — "the migration file exists" ≠ "applied to the live DB."

### Blocker
- [ ] **Razorpay International (AED)** — Confirm AED orders actually create AND capture; an Indian Razorpay account without International rejects non-INR at `orders.create`/capture, silently breaking the entire UAE market checkout _(evidence: create-order/route.ts:104-115 currency=AED; MEMORY "AED on Razorpay International" pending)_
- [ ] **RAZORPAY_WEBHOOK_SECRET set in prod** — If unset, webhook fails closed (500 `webhook_not_configured`); the authoritative fulfilment path is dead, so a paid customer whose browser never returns gets charged with NO credits granted _(evidence: razorpay/webhook/route.ts:36-40; MEMORY "webhook secret" pending)_

### High
- [ ] **A real teacher account logs in and lands on /teacher** — End-to-end verify one promoted teacher reaches /teacher (not /dashboard, not a redirect loop). The whole teacher surface is unreachable if `role='teacher'` can't be set _(evidence: middleware.ts:99 gates /teacher on role==='teacher'; invite route is the sole promotion path)_
- [ ] **Migrations 0024–0029 applied to live DB** — `teacher` enum value (0024), promote/demote RPCs + RLS (0025/0026), service-path fix (0029). If any unapplied, teacher login/routing/availability/profile are dead or read-only _(evidence: 0024_teacher_role.sql:12 enum add; CLAUDE.md "apply it to the live DB")_
- [ ] **Duplicate migration number 0024** — Both `0024_category_copy_positive.sql` and `0024_teacher_role.sql` exist; a tool ordering on numeric prefix could skip one. Confirm BOTH applied (teacher-role one being skipped silently disables teacher login) _(evidence: two 0024_*.sql files in supabase/migrations/)_
- [ ] **Migration 0027 (medical-documents) applied** — Private bucket + share/revoke/`customer_booked_teacher` RPCs. If unapplied: upload toasts a fix hint, but share RPCs error and download/teacher paths 500/404 _(evidence: MedicalDocuments.tsx:104-108 names the migration; all RPCs live only in 0027)_
- [ ] **Migration 0022 (plan_prices, admin_kpis per-currency) applied** — Without it, /pricing shows only base prices, admin Plans price-save errors ("Saved plan but prices failed"), and `grant_session_credits` may be missing → paid customer gets NO credits _(evidence: fulfillment.ts:87 grant RPC; catalog.ts:46-52 plan_prices)_
- [ ] **Booking-integrity migrations 0011/0016/0017/0021 applied** — `book_session`/`refund_session_credit`/`spend_session_credit` RPCs + overlap EXCLUDE + trial unique index + reminder columns. If unapplied, /api/bookings/confirm 500s, overlap/trial protection vanishes, reminders silently skip sends _(evidence: confirm/route.ts:160-186; reminders/route.ts:99-109)_
- [ ] **Google Meet keyless OIDC configured in prod** — Needs Vercel OIDC + `GOOGLE_WORKLOAD_IDENTITY_PROVIDER`/`IMPERSONATE_*` + Node runtime. Without it every booking sits at meet_status pending/failed forever; "Get link" always fails; under plain `next dev` it fails loud (highest-likelihood "looks broken but is env" trap) _(evidence: lib/google/calendar.ts:76-100; provisionMeet.ts:91-105)_
- [ ] **An external cron scheduler is wired with CRON_SECRET** — No `vercel.json`/host cron in repo; reminders, no-show-sweep, meet-retry, orphan-sweep never fire on schedule unless an external scheduler POSTs the Bearer secret _(evidence: CLAUDE.md "scheduler is BYO"; no vercel.json; MEMORY 0015 "never applied")_
- [ ] **Migration 0015 cron schedule (if used) edited + applied** — Hardcoded `base_url='https://YOUR_DOMAIN'` placeholder must be replaced; it schedules only 3 jobs (NOT medical-orphan-sweep) _(evidence: 0015_cron_schedule.sql:21; jobs array lines 22-26)_
- [ ] **RESEND_FROM_EMAIL on a Resend-verified domain** — If pointed at the stale `.com.au` (unverified) domain, every transactional send returns `{ok:false}` silently — booking confirmations/reminders never arrive, no user-visible error _(evidence: email/client.ts:19,61-63; MEMORY support_email)_
- [ ] **Supabase custom SMTP→Resend configured (auth emails)** — Separate from app's RESEND_API_KEY. Until done, OTP logins hit "email rate limit exceeded" and the entire login funnel silently breaks _(evidence: .env.local.example:60-65; MEMORY auth_email_smtp)_
- [ ] **Supabase "Magic Link" email template contains `{{ .Token }}`** — Without it, Supabase emails a magic LINK instead of a 6-digit code; the inline OTP box can never be satisfied and the primary passwordless login is broken _(evidence: LoginForm.tsx:115-182; CLAUDE.md auth section)_
- [ ] **SUPABASE_SERVICE_ROLE_KEY set in prod** — Teacher schedule + student-documents read customer profiles via service-role client. If unset/wrong, both return `[]` and teachers see empty schedule / "no documents" that looks like real emptiness _(evidence: teacher/sessions.ts:29; medical/documents.ts:165,181)_
- [ ] **Migration 0010 (demote_from_admin) applied** — The /admin/customers Demote button 500s with a raw Postgres error until 0010 is psql-applied (canonical "feature 500s until migration applied" trap) _(evidence: CustomersTable.tsx:63; CLAUDE.md Schema ownership)_
- [ ] **Admin RLS hardening 0018 + per-table policies applied** — Many admin writes (sessions status/recording, bookings status, reviews, plans, discounts, classes, media, credits) go through the browser client; without 0018 they fail with RLS-error toasts even though the UI renders fine _(evidence: SessionsAdmin.tsx:167; BookingsAdmin.tsx:80; ReviewsAdmin.tsx:58)_
- [ ] **Migration 0008 (Storage buckets) applied** — First admin media/teacher-media upload failing with "new row violates RLS" means 0008 unapplied; re-apply, don't make bucket world-writable _(evidence: CLAUDE.md Storage buckets)_
- [ ] **Mobile sticky CTA is missing on every page except home** — `StickyMobileCTA` is in `page.tsx`, NOT the marketing layout, so /pricing, /teachers, /classes, /reviews, /faq, /about, /contact, legal have no sticky "Book now" bar — exactly the high-intent mobile landing pages. README calls this "non-negotiable" _(evidence: page.tsx:11,68 vs layout.tsx has none)_
- [ ] **NO customer-facing review submission UI exists anywhere** — /reviews says "Add your own review after your first class" and admin Reviews approves customer submissions, but no review form / insert / API route exists in the dashboard. The admin approval workflow has no source of reviews _(evidence: reviews/page.tsx:22; ReviewsAdmin.tsx:24-30; grep of dashboard returns nothing)_
- [ ] **Legal pages ship DRAFT + visible "Pending legal review" banner** — Privacy & Refund render an amber unreviewed banner; all three carry a DRAFT header. Publishing self-declared-unreviewed terms for a UAE-PDPL/India-DPDP business handling payments + PHI is a compliance/launch risk _(evidence: legal/{terms,privacy,refund}/page.tsx line 1)_
- [ ] **No nav entry point to /admin from anywhere** — Customer dashboard, account menu, and marketing nav contain zero /admin links; admin must type the URL. Easy to believe the admin area "isn't there" _(evidence: grep /admin across dashboard/shared returns nothing)_
- [ ] **Production teacher rows have real photos** — Mock + un-uploaded teachers fall back to placeholder SVG figures. README: "Real teacher photos beat any other landing element" (#1 conversion lever). Teachers cannot self-upload avatars (admin-only) _(evidence: MOCK_TEACHERS avatar_url:null; teachers/[slug]/page.tsx:58-75)_

### Medium
- [ ] **Onboarding collects NO phone field** — CLAUDE.md/README imply an optional user-supplied phone, but OnboardingForm has none; `profiles.phone` is only ever the (NULL) auth.users.phone. A tester looking for the documented phone field won't find it _(evidence: OnboardingForm.tsx has no phone; handle_new_user 0001:44-49)_
- [ ] **Profile page has NO avatar editor** — `YogaAvatar` is a deterministic email-seeded stick figure shown only in the sidebar; the real OAuth `profiles.avatar_url` is ignored by the UI. A tester expecting to upload a profile photo (per PR #44 framing) finds no control _(evidence: ProfileForm.tsx no avatar field; YogaAvatar in DashboardSidebar.tsx:79)_
- [ ] **Discount codes are stored but NEVER applied at checkout** — Admin can fully CRUD codes; the Razorpay create-order path ignores `discount_codes` entirely. The dialog itself admits this. Tester sees no price change _(evidence: DiscountsAdmin.tsx:218; create-order resolves price from plan_prices only)_
- [ ] **Razorpay fulfilment sends NO purchase/credit email** — `sendSubscriptionActivated` is fully defined but has ZERO callers; a customer who buys a pack receives no confirmation email _(evidence: fulfillment.ts imports no email; lib/email/index.ts:111 unused)_
- [ ] **Admin not special-cased in post-login routing** — Admins route purely by onboarded flag; an admin who never did customer onboarding is sent to /onboarding, and an admin hitting /login or marketing "Dashboard" lands on customer /dashboard, not /admin _(evidence: callback/route.ts:61-63; middleware.ts:74-87,103-106)_
- [ ] **Email-OTP teacher login routes via customer logic** — LoginForm's inline OTP routing selects only `experience_level` (no role), so a teacher logging in via OTP may briefly land on /onboarding or /dashboard before middleware bounces them _(evidence: LoginForm.tsx:169-181 vs callback:52-60)_
- [ ] **Marketing "Get this pack" not region-gated client-side** — Button is clickable for visitors outside IN/AE; the 403 only comes after the click. No disabled state / up-front region message _(evidence: PricingTeaser.tsx:38-75 no gate; create-order:77-91 server-only)_
- [ ] **Pricing display currency derives from browser TZ only** — A UAE visitor whose device TZ isn't exactly Asia/Dubai sees INR on /pricing while the server charges AED — a visible price-vs-charge mismatch on the #1 trust signal _(evidence: PricingTeaser.tsx:29-31 currencyForTimezone; server uses GeoIP)_
- [ ] **Service-TZ allow-list is exactly {Asia/Kolkata, Asia/Dubai}** — On non-Vercel/local hosts without GeoIP header, a legit IN/AE customer whose device reports `Asia/Calcutta` (legacy alias) or a mis-set zone is wrongly blocked from trial + purchase _(evidence: region.ts:36-39 exact-match keys; Calcutta unmapped)_
- [ ] **Teacher self-edits don't bust ISR cache** — Teacher profile save does a client update with no `/api/admin/revalidate` call, so changes appear on /teachers/[slug] only after the 300s ISR window (page copy says "a few minutes") _(evidence: TeacherProfileForm.tsx:60-78 vs admin path)_
- [ ] **Teacher invite email may silently not deliver** — `inviteUserByEmail` uses Supabase's throttled built-in sender; admin UI toasts "Invite sent" while the email never arrives, leaving the teacher unable to log in _(evidence: invite/route.ts:96; MEMORY auth_email_smtp)_
- [ ] **Download access log fails CLOSED** — If the access-log INSERT errors, the route returns 500 `audit_failed` even after minting a valid signed URL — any audit-table problem fully breaks downloads for BOTH customer and teacher _(evidence: download/route.ts:86-95)_
- [ ] **`customer_booked_teacher` has no status filter** — Returns true for ANY booking (incl. cancelled / no_show), so a customer who cancelled a trial can still share PHI with that teacher _(evidence: 0027:152-160 no b.status filter)_
- [ ] **Stale `.env.local.example` references a non-existent cron** — Lists `/api/cron/paypal-reconcile`; no such route exists (PayPal → Razorpay). An operator wiring crons would point a job at a 404. Also: medical-orphan-sweep is absent from the env-file schedule guidance _(evidence: .env.local.example vs ls app/api/cron)_
- [ ] **Brand-color settings may be inert** — /admin/settings Brand tab writes `brand.primary_color`/`accent_color` to admin_settings, but theme comes from globals.css tokens; saving may have no visible effect _(evidence: settings/page.tsx:32-42; no consumer found)_
- [ ] **Admin/teacher desktop layouts have no desktop "Back to site"/Sign out** — Both expose these only inside the mobile drawer; verify a desktop admin/teacher isn't stranded _(evidence: AdminSidebar.tsx:143-151; TeacherSidebar.tsx:127-135)_
- [ ] **WhatsApp button silently absent without env** — Renders nothing unless `NEXT_PUBLIC_WHATSAPP_NUMBER` set; confirm it's configured if the channel is part of launch _(evidence: WhatsAppButton.tsx:14-18)_
- [ ] **TestimonialWall returns null when reviews empty** — On /reviews and home, zero featured+approved reviews produces a blank section with no empty-state; mock data masks this in preview _(evidence: TestimonialWall.tsx:9)_
- [ ] **Webhook replay dedupe depends on `x-razorpay-event-id` header** — If absent/empty, refund handling re-runs each delivery (credit grant is still idempotent). Confirm the header is present in deliveries _(evidence: webhook/route.ts:68-77,133-141)_

### Low
- [ ] **Footer can emit an Australian ABN** — Leftover from pre-2026 AU market; confirm `NEXT_PUBLIC_ABN` is unset in prod _(evidence: Footer.tsx:76)_
- [ ] **Meet-link copy mismatches the documented "Link available shortly"** — UI says "Meet link will be ready shortly." / "we're retrying." — may cause a false checklist "fail"; confirm copy is acceptable _(evidence: dashboard/page.tsx:155-157)_
- [ ] **No-show/Attended pills are unreachable without cron** — Past confirmed sessions sit as "Confirmed" forever if the sweep cron isn't wired _(evidence: BookingsList.tsx:53-54)_
- [ ] **`ConditionLanding` component may be dead code** — Has a Book CTA but the 9 condition pages are standalone HTML in `landing-pages/` (not app-wired); confirm whether any app route renders it _(evidence: ConditionLanding.tsx:16,84; MEMORY)_
- [ ] **PricingTeaser is `md:grid-cols-3` with only 2 packs** — May leave an awkward empty column; visual check _(evidence: PricingTeaser.tsx:103)_
- [ ] **Hero visual is permanently a placeholder SVG** — Hardcoded "Gentle Hatha with Aarti" card, never a real photo; confirm acceptable for launch _(evidence: Hero.tsx:142-179)_
- [ ] **`tzShort`/LocalTzLabel show offsets, not IST/GST** — Pattern `'zzz'` yields "GMT+5:30" not the friendly abbreviations the comments promise _(evidence: timezone/index.ts:75-77)_
- [ ] **Several features silently no-op without env** — Analytics `track()` (no POSTHOG key), checkout "isn't configured yet" toast (no RAZORPAY key), WhatsApp button — each can make a broken feature look intentional _(evidence: WhatsAppButton.tsx; PricingTeaser.tsx:51-55)_
- [ ] **Teacher with role but no linked record** — Verify /teacher shows the "profile isn't linked yet" card (not a stack trace) and sub-pages notFound() gracefully _(evidence: teacher/documents/page.tsx:11-17)_
- [ ] **Deleted-doc access log disappears for the customer** — `owns_medical_document` filters `deleted_at`; confirm this is expected, not a regression _(evidence: by design)_
- [ ] **Demoted teacher's past "opened by" log degrades to "A teacher"** — Attribution lost when profile_id is nulled on demote _(evidence: documents.ts:116-125; 0026:58)_

---

## Marketing / Public

### Hero & CTAs
- [ ] 🔴 Click hero "Book my free 1:1 session" — _how:_ / top of viewport 1, no auth — _expect:_ → /login?next=/dashboard/book; fires hero_cta_click; visible above fold on mobile + desktop
- [ ] Click "See today's teachers" ghost link — _how:_ / hero — _expect:_ → /teachers
- [ ] Hero trust badge — _how:_ / hero trust row — _expect:_ ★ 4.9 · 1,200+ reviews (or admin-edited) → /reviews; cleared admin field falls back to default, never blank
- [ ] 🔴 Click "Book my free session" in bottom FinalCTA — _how:_ / bottom (also /pricing, /teachers, /classes, /reviews, /about, /faq) — _expect:_ → /login?next=/dashboard/book; fires cta_click{position:final}
- [ ] 🔴 Mobile sticky CTA — _how:_ / only, mobile width, scroll >600px — _expect:_ bar slides up, "Book now" → /login?next=/dashboard/book, fires cta_click{position:sticky_mobile} (NOT present on other pages)

### Sections & rendering
- [ ] 🔴 Scroll full home — _how:_ / — _expect:_ Hero, Marquee, OutcomeStats, HowItWorks, TeacherCarousel, PracticeSection, PricingTeaser, TestimonialWall (6 reviews), FAQ, FinalCTA all render populated
- [ ] Zero-env mock fallback — _how:_ all routes, no NEXT_PUBLIC_SUPABASE_* — _expect:_ 6 mock teachers, 9 categories, 2 packs, 6 reviews, no crashes, SVG placeholders
- [ ] Empty-DB fallback — _how:_ Supabase configured but tables empty — _expect:_ accessors return MOCK_* rather than blank lists

### Nav, header, footer
- [ ] 🔴 Desktop nav links — _how:_ any marketing route (md+) — _expect:_ Teachers, Classes, Pricing, Reviews, FAQ, About all resolve; logo → /; Contact is footer-only
- [ ] 🔴 Header auth-state swap — _how:_ top-right, logged out then logged in — _expect:_ "Log in" + "Book free session" → swap to "Dashboard" (/dashboard) + "Book a session" (/dashboard/book) via client-side session check in MarketingNav (may swap a beat after load; marketing pages are static/ISR)
- [ ] 🔴 Mobile hamburger menu — _how:_ mobile — _expect:_ 6 links + auth buttons, Menu↔X toggle, aria-expanded updates, links navigate + close drawer
- [ ] Header scrolled state — _how:_ any route, scroll >12px — _expect:_ transparent → frosted bg + bottom border
- [ ] 🔴 Footer links — _how:_ footer any route — _expect:_ Explore/Company/Legal links resolve; "Email us" → mailto:hello@myyogaclasses.fit (.fit, never .com.au); logo → /
- [ ] Footer copyright line — _how:_ footer — _expect:_ "© <year> My Yoga Classes."; ABN suffix only if NEXT_PUBLIC_ABN set (should be unset)

### Forms
- [ ] Newsletter form — _how:_ footer, any route — _expect:_ invalid → toast error; valid → POST /api/newsletter/subscribe, success toast, field clears, fires newsletter_signup (always returns ok; needs RPC 0007 to persist)
- [ ] 🔴 Contact form — _how:_ /contact — _expect:_ validation toasts; valid → POST /api/contact "Message sent." — **verify a real email arrives**, not just the toast (route returns skipped:true when Resend off)
- [ ] Contact email link — _how:_ /contact — _expect:_ mailto:hello@myyogaclasses.fit

### Pricing
- [ ] 🔴 Multi-currency display — _how:_ /pricing from IN and UAE TZ/GeoIP — _expect:_ IN → ₹10,000/₹19,000, UAE → AED 435/825; "Prices shown in <CCY>"; AED users don't stick on INR
- [ ] Plan cards — _how:_ /pricing + home teaser — _expect:_ 5-Session + 10-Session (Most popular on 10), price, "N sessions included", features; 2 cards in md:grid-cols-3 not broken
- [ ] 🔴 Get pack (logged out) — _how:_ /pricing — _expect:_ → /login?next=/dashboard/plan?planSlug=<slug>; fires paid_plan_clicked; "Starting checkout…" spinner
- [ ] Get pack (logged in, no key) — _how:_ /pricing authed, no NEXT_PUBLIC_RAZORPAY_KEY_ID — _expect:_ toast "Checkout isn't configured yet.", spinner resets, no crash
- [ ] FAQ link — _how:_ /pricing — _expect:_ → /faq

### Teachers (public)
- [ ] 🔴 Teachers list — _how:_ /teachers — _expect:_ all active teachers (uncapped) with name, headline, ≤3 specialty chips, "Book with <First> →"; no-Supabase → 6 mocks; rating badge only if rating_count>0
- [ ] 🔴 Photos vs SVG — _how:_ /teachers, /teachers/<slug> — _expect:_ real avatar_url via next/image; null → gradient + SVG; confirm prod teachers have real photos
- [ ] 🔴 Card → detail — _how:_ /teachers → /teachers/<slug> — _expect:_ bio, specialties, languages, intro video or placeholder, rating badge if reviewed
- [ ] 🔴 Detail Book CTA — _how:_ /teachers/<slug> — _expect:_ "Book free 1:1 with <First>" → /login?next=/dashboard/book/<slug>; "All teachers" → /teachers
- [ ] Detail 404 — _how:_ /teachers/does-not-exist — _expect:_ notFound() 404
- [ ] Intro video — _how:_ /teachers/<slug> — _expect:_ plays where configured; graceful placeholder otherwise

### Classes (public)
- [ ] 🔴 Classes list — _how:_ /classes — _expect:_ 9 categories (Diabetes, Hypertension, Prenatal & Postnatal, Hormonal Health, Pain Relief, Mental Health, Weight Loss, Geriatric, Kids Yoga), each → /classes/<slug>
- [ ] 🔴 Class detail rich page — _how:_ all 9 slugs — _expect:_ rich ConditionLanding renders (not bare SimpleDetail); bottom medical disclaimer present
- [ ] Class detail CTAs — _how:_ /classes/<slug> — _expect:_ Book → /login?next=/dashboard/book; "How it helps" → #how-it-helps
- [ ] Class detail 404 — _how:_ /classes/not-a-condition — _expect:_ notFound() 404

### Other public pages
- [ ] Reviews page — _how:_ /reviews — _expect:_ up to 9 fetched, 6 shown with rating/body/name/location; empty → blank section
- [ ] About page — _how:_ /about — _expect:_ static copy; CTA → /login?next=/dashboard/book; confirm "200-hr Yoga Alliance" claims accurate
- [ ] FAQ accordion — _how:_ /faq — _expect:_ all entries toggle; JSON-LD emitted
- [ ] 🔴 Legal pages — _how:_ /legal/{terms,privacy,refund} — _expect:_ draft copy + "Last updated 21 June 2026"; Privacy & Refund show amber "Pending legal review"; **confirm legal sign-off before launch**
- [ ] WhatsApp button — _how:_ any marketing route — _expect:_ green "Chat with us" → wa.me/<number> only if env set; else nothing
- [ ] Skip link / a11y — _how:_ keyboard tab from top — _expect:_ "Skip to content" → #main-content; prefers-reduced-motion disables reveals
- [ ] Sitemap / robots — _how:_ /sitemap.xml, /robots.txt — _expect:_ static + dynamic teacher/class slugs (static fallback if DB down); robots resolves

---

## Auth & Onboarding

### Login
- [ ] 🔴 Login page render (logged out) — _how:_ /login — _expect:_ BrandMark + header, eyebrow, tabbed card (Google/Email) defaulting to Google; Terms + Privacy links resolve
- [ ] 🔴 Google OAuth sign-in — _how:_ /login → Google tab — _expect:_ spinner → consent → /auth/callback; new → /onboarding, returning customer → /dashboard, teacher → /teacher
- [ ] 🔴 Email OTP send code — _how:_ /login → Email tab → valid email → Send — _expect:_ "Code sent." toast, OTP view, a real **6-digit code** arrives (NOT a magic link)
- [ ] Invalid email guard — _how:_ Email tab, "foo@bar" — _expect:_ "Enter a valid email address." no Supabase call
- [ ] 🔴 Verify code & route — _how:_ OTP phase → Verify & continue — _expect:_ new → /onboarding, onboarded → /dashboard or ?next (skips /auth/callback; routing done client-side)
- [ ] Short/empty code guard — _how:_ OTP phase, <6 digits — _expect:_ "Enter the full code…"; non-digits stripped, max length 10
- [ ] Wrong/expired code — _how:_ OTP phase — _expect:_ "That code looks invalid or has expired — request a new one."
- [ ] Resend cooldown — _how:_ OTP phase — _expect:_ "Resend in 30s" countdown, disabled until 0; "← Change email" returns to email phase
- [ ] Error banner from callback — _how:_ /login?error=Some+message — _expect:_ role=alert destructive banner + toast
- [ ] Rate-limit messaging — _how:_ Email tab, rapid sends — _expect:_ "Too many attempts — please wait a minute and try again."
- [ ] Magic-link fallback — _how:_ click email LINK — _expect:_ /auth/callback?token_hash verifies + routes per role; error → /login?error=
- [ ] Suspense fallback — _how:_ /login throttled — _expect:_ pulsing skeleton then form, no hydration crash
- [ ] Mobile layout — _how:_ /login on phone — _expect:_ OTP input centered, numeric keyboard (inputMode), fields full-width

### Onboarding
- [ ] 🔴 First-time customer — _how:_ /onboarding after first login — _expect:_ Full name (required), Level (default beginner), Timezone (auto-detected), Goals chips, marketing (default ON); submit → upsert + "All set. Now pick a teacher." → /dashboard/book or ?next
- [ ] Full name required — _how:_ /onboarding empty name — _expect:_ "Please enter your full name." no write
- [ ] 🔴 Timezone auto-detect & change — _how:_ /onboarding → timezone — _expect:_ detectBrowserTimezone() preselected (Asia/Dubai for UAE), persists to profiles.timezone
- [ ] Already-completed redirect — _how:_ /onboarding while experience_level set — _expect:_ server redirect to /dashboard or ?next; never re-shows form
- [ ] Session-expired during submit — _how:_ /onboarding, expired session — _expect:_ "Session expired — please log in again." button un-stuck → /login
- [ ] 🔴 Missing profile row (upsert safety) — _how:_ /onboarding, no profiles row — _expect:_ upsert inserts; never silently no-ops + reappears next login

### Middleware & role routing
- [ ] 🔴 Gate unauth from protected areas — _how:_ logged out → /dashboard, /admin, /teacher — _expect:_ → /login?next=<path>; /api/* not gated
- [ ] 🔴 Signed-in user on /login — _how:_ /login while authed — _expect:_ teacher → /teacher, admin/onboarded customer → /dashboard or ?next, half-onboarded → /onboarding
- [ ] 🔴 Admin routing — _how:_ /admin as customer then admin — _expect:_ admin allowed; customer → /; teacher → /teacher; requireAdmin() re-checks inside pages
- [ ] 🔴 Teacher routing (critical) — _how:_ log in as teacher; customer/admin hit /teacher — _expect:_ teacher → /teacher in BOTH callback + middleware; customer → /dashboard, admin → /admin; teacher on /dashboard → /teacher
- [ ] Open-redirect protection — _how:_ /login?next=https://evil.com and //evil.com — _expect:_ safeNext rejects, falls back to /dashboard; only single-/ same-origin honored

---

## Customer Dashboard

### Shell & nav
- [ ] 🔴 Auth gate — _how:_ /dashboard logged out — _expect:_ → /login?next=…, back after sign-in; renders for customer
- [ ] 🔴 Sidebar (desktop) — _how:_ /dashboard ≥lg — _expect:_ Overview, Book, My bookings, Health documents, My plan & credits, Profile all resolve; active highlighted
- [ ] 🔴 Sidebar (mobile drawer) — _how:_ /dashboard <lg, hamburger — _expect:_ Sheet opens, links auto-close it; Back to site + Sign out present
- [ ] Sign out — _how:_ header / drawer — _expect:_ session cleared; /dashboard → /login after

### Overview
- [ ] 🔴 Empty state — _how:_ /dashboard fresh account — _expect:_ "You don't have a class booked yet" + "Book my free 1:1" / "Browse teachers" → /dashboard/book
- [ ] 🔴 Next-class card — _how:_ /dashboard with upcoming booking — _expect:_ teacher name, "· Free 1:1" if trial, local-time, TZ note
- [ ] 🔴 Meet link states — _how:_ /dashboard, meet_status pending/failed/created — _expect:_ created → "Join on Google Meet"; pending → "ready shortly"; failed → "unavailable — we're retrying"
- [ ] Quick-action cards — _how:_ /dashboard — _expect:_ → /dashboard/book and /dashboard/plan
- [ ] Loading skeleton — _how:_ any dashboard transition — _expect:_ skeleton, not blank screen

### Profile
- [ ] 🔴 Load & edit — _how:_ /dashboard/profile — _expect:_ full name, email (disabled), phone (optional), timezone, level, marketing opt-in prefill; Save → "Saved."
- [ ] Timezone picker — _how:_ /dashboard/profile → Timezone — _expect:_ persists as SSR fallback; device TZ overrides at runtime
- [ ] Phone validation — _how:_ /dashboard/profile → Phone — _expect:_ invalid → error toast, no write; clear → null
- [ ] Avatar — _how:_ /dashboard/profile + sidebar — _expect:_ NO editor; YogaAvatar is auto-generated, sidebar-only

---

## Booking + Google Meet

### Booking flow
- [ ] 🔴 Teacher list — _how:_ /dashboard/book — _expect:_ all active teachers as cards (avatar/fallback, name, headline, rating if rating_count>0, "See available times")
- [ ] 🔴 Teacher detail + slot picker — _how:_ /dashboard/book/<valid slug> + bogus slug — _expect:_ renders name/headline/bio/intro video; bad slug → notFound()
- [ ] 🔴 Slot generation & TZ display — _how:_ /dashboard/book/<slug> with availability — _expect:_ slots grouped by day for 7 days in YOUR local time, tooltip = teacher time + duration; "Times shown in your local time… Teacher is in…"; <15min slots filtered
- [ ] 🔴 No-availability empty state — _how:_ teacher with no availability — _expect:_ "No times available in the next 7 days." (REQUIRES teacher_availability data to show any slots)
- [ ] 🔴 Free trial booking (happy path) — _how:_ never-claimed customer, UAE/India TZ, click slot — _expect:_ POST isFreeTrial:true → /dashboard/plan?booked=1, "Your free 1:1 is booked 🎉"; no credit spent
- [ ] 🔴 Out-of-service-area trial gate — _how:_ TZ America/New_York, trial unclaimed — _expect:_ "Checking your location…" then "free 1:1 trial is available to customers in the UAE and India" banner; no slots; server 403 outside_service_area
- [ ] Admin books from anywhere — _how:_ admin, non-service TZ — _expect:_ grid renders; gate skipped
- [ ] 🔴 Paid booking with credits — _how:_ trial used, creditBalance>0, click slot — _expect:_ → /dashboard/bookings?booked=1, "Session booked"; balance decrements via book_session RPC
- [ ] 🔴 Insufficient-credits client guard — _how:_ trial used, 0 credits — _expect:_ inline "You're out of session credits" + "Buy a pack" → /dashboard/plan; no POST
- [ ] Server insufficient_credits (402) — _how:_ stale page bypassing client guard — _expect:_ 402, same inline error + CTA
- [ ] 🔴 Double-book same slot — _how:_ two tabs/customers on one slot — _expect:_ first succeeds, second 409 slot_taken (EXCLUDE 23P01), "That slot was just booked… Try another time."
- [ ] 🔴 Second free trial blocked — _how:_ already-claimed customer forces isFreeTrial — _expect:_ UI flips to paid mode; if reached, 409 trial_already_claimed + "View plans" CTA; verify no path yields two trials
- [ ] Slot >=15 min future — _how:_ near-boundary/crafted request — _expect:_ 400 slot_in_past, "That time has just passed — pick a slot at least 15 minutes from now."
- [ ] Outside availability — _how:_ crafted startAt / duration mismatch / cross-midnight — _expect:_ 409 slot_unavailable; cross-midnight IST slots intentionally rejected
- [ ] Teacher-blocked date — _how:_ teacher blocks a date — _expect:_ no slot buttons; if forced, 409 slot_unavailable
- [ ] Booking error states — _how:_ trigger slot_taken/trial_already_claimed/slot_in_past/slot_unavailable/OUTSIDE_SERVICE_AREA/booking_failed — _expect:_ each maps to specific friendly copy + CTA

### Meet provisioning
- [ ] 🔴 Meet link on confirm (created) — _how:_ booking with OIDC configured — _expect:_ provisionSessionMeet sets meet_status='created' + meet_link; "Join" button; confirmation email with link if Resend on
- [ ] 🔴 Pending/failed fallback + "Get link" — _how:_ /dashboard/bookings Upcoming, no link — _expect:_ "Get link" → POST /api/meet/create-link (idempotent recover:true); success → "Meet link ready" + refresh; failure → "isn't ready yet"; pending/failed render identically
- [ ] meet-retry cron backfills — _how:_ POST /api/cron/meet-retry with Bearer secret — _expect:_ {ok:true, processed:N}; 50/run; no secret → 503/401

### Cancellation
- [ ] 🔴 Cancel free trial — _how:_ Upcoming → Cancel → reason → confirm — _expect:_ 200, "Session cancelled.", → Cancelled tab gray pill; no refund; Meet event deleted if not started + no other attendees
- [ ] 🔴 Cancel paid booking — _how:_ Upcoming → Cancel a paid row — _expect:_ 200; balance +1 via refund_session_credit (idempotent); Cancelled
- [ ] Non-cancellable booking — _how:_ stale tab cancel on cancelled/no_show/attended — _expect:_ 409 not_cancellable; .eq('status','confirmed') guard prevents double refund
- [ ] Group session link survives — _how:_ multi-attendee session, cancel one — _expect:_ Meet event deleted only when zero non-cancelled bookings remain; others keep Join

### Bookings list
- [ ] 🔴 List + filters — _how:_ /dashboard/bookings mixed statuses — _expect:_ Upcoming/Past/Cancelled buckets correct, "N upcoming" count, TZ label; tabs switch
- [ ] Empty states — _how:_ fresh account / empty filter — _expect:_ "No sessions yet." + "Book your first session"; per-filter "No {filter} sessions."
- [ ] Status pills — _how:_ across statuses — _expect:_ Cancelled, No-show, Attended, Free trial, Confirmed (no_show/attended need cron/teacher updates)
- [ ] booked=1 banner — _how:_ /dashboard/bookings?booked=1 — _expect:_ "Session booked" banner
- [ ] Unauthenticated API — _how:_ POST confirm/cancel/create-link no cookie — _expect:_ all 401
- [ ] create-link ownership — _how:_ customer A on another's sessionId — _expect:_ 403 forbidden
- [ ] Mobile booking — _how:_ ~375px — _expect:_ slot buttons wrap, bookings table overflow-x-auto, "Book another" hidden on mobile

---

## Payments (Razorpay multi-currency)

- [ ] 🔴 Pricing display currency — _how:_ /pricing + home teaser from IN then UAE TZ — _expect:_ ₹ for IN, AED for AE, footnote matches; INR on first paint (SSR), re-renders after mount, no hydration warning
- [ ] 🔴 Buy while logged out — _how:_ /pricing → pack → login → /dashboard/plan?planSlug — _expect:_ after login "Opening checkout…" → Razorpay modal auto-opens via PlanAutoStart
- [ ] 🔴 Buy logged in (INR happy path) — _how:_ IN customer, /dashboard/plan — _expect:_ modal INR, test card → "Payment successful!", → /dashboard/plan?purchased=1, "Pack purchased 🎉", credits +N
- [ ] 🔴 Buy AED (UAE) — _how:_ UAE GeoIP/Asia/Dubai — _expect:_ order + modal in AED, payment **actually captures** (NOT blocked by International off), credits granted
- [ ] 🔴 Credit appears on plan page — _how:_ /dashboard/plan after purchase — _expect:_ balance from customer_credits; "N sessions left" + "Book a class" when >0; "You're on the free trial." when 0
- [ ] 🔴 Idempotency: verify + webhook race — _how:_ test payment with both firing — _expect:_ credits granted exactly once; single 'purchase' credit_ledger row
- [ ] 🔴 Webhook authoritative path — _how:_ pay then close tab before verify — _expect:_ webhook grants credits, appear after refresh; razorpay_webhook_events row written
- [ ] Webhook signature rejection — _how:_ missing/wrong x-razorpay-signature — _expect:_ 400 missing/invalid_signature; no credits
- [ ] verify-payment sig + ownership — _how:_ tampered sig; another user's order — _expect:_ 400 "Signature verification failed"; 403 "Not your order"
- [ ] 🔴 Service-area gate on purchase — _how:_ non-IN/AE GeoIP, buy — _expect:_ create-order 403 outside_service_area, "Session packs can only be purchased from within the UAE or India."; button visible/clickable (gate server-side only)
- [ ] Admin buys from anywhere — _how:_ admin outside IN/AE — _expect:_ order created (INR fallback if region unresolved)
- [ ] Checkout-not-configured fallback — _how:_ NEXT_PUBLIC_RAZORPAY_KEY_ID unset — _expect:_ "Checkout isn't configured yet.", no crash
- [ ] payment.failed handling — _how:_ failing test card — _expect:_ onError toast, button resets
- [ ] Modal dismiss — _how:_ close without paying — _expect:_ "Payment cancelled." / URL cleared; pending cleared
- [ ] Script load failure — _how:_ block checkout.razorpay.com — _expect:_ after 10s "Couldn't load the payment window. Check your connection." no hang
- [ ] Full refund clawback — _how:_ full refund in dashboard — _expect:_ webhook claws back credits (idempotent), balance drops, payments → 'refunded'
- [ ] Partial refund flagged — _how:_ partial refund — _expect:_ 200 skipped=partial_refund_manual; Sentry warning; credits NOT clawed (manual)
- [ ] Admin edits pack prices — _how:_ /admin/plans edit INR + AED → save → /pricing — _expect:_ plan_prices upsert on (plan_id,currency); new prices within revalidate (may need /api/admin/revalidate)
- [ ] Credit spent on paid not free — _how:_ /dashboard/book/<slug> — _expect:_ paid spends one via spend_session_credit; free trial never touches credits
- [ ] Mock pricing no Supabase — _how:_ /pricing zero-env — _expect:_ MOCK_PLANS render without crash

---

## Admin

### Access & nav
- [ ] 🔴 Access gating — _how:_ type /admin as non-admin then admin — _expect:_ logged-out → /login?next=/admin, customer → /, teacher → /teacher, admin allowed; requireAdmin() re-checks inside pages
- [ ] 🔴 Sidebar nav (11 items) — _how:_ /admin sidebar desktop + mobile drawer — _expect:_ Overview, Teachers, Classes, Plans, Discounts, Media, Sessions, Bookings, Customers, Reviews, Settings all load; active highlighted; drawer closes on navigate + Back to site/Sign out
- [ ] Deep routes — _how:_ /admin/teachers → row → detail → slots — _expect:_ /admin/teachers/[id] and /[id]/slots reachable via UI only (no sidebar entry)

### Overview
- [ ] 🔴 KPIs — _how:_ /admin — _expect:_ Signups today, Trials today, Revenue MTD INR, Revenue MTD AED; missing admin_kpis (0022) → '—' fallback, not 500
- [ ] Lists — _how:_ /admin panels — _expect:_ Upcoming sessions/Recent activity/Recent bookings with empty states; Join opens meet_link; "View all" routes correctly; Recent activity stays empty until RPCs/webhooks log

### Sessions
- [ ] 🔴 Create — _how:_ /admin/sessions → Schedule session — _expect:_ row appears, "Meet link will appear shortly", meet_status pending; overlap → 409 "That teacher already has a session at this time."; needs active teachers in dropdown
- [ ] 🔴 Cancel — _how:_ Cancel a session with a booking — _expect:_ session cancelled, customer booking cascades (reason session_cancelled_by_admin), future Meet released (must go through DELETE route)
- [ ] Lifecycle & recording — _how:_ Go live → Complete → Add recording; toggle Show past — _expect:_ badge flips, recording saves + visible to booked customers; relies on admin RLS UPDATE

### Bookings
- [ ] List/search/filter/paginate — _how:_ /admin/bookings — _expect:_ search by name/email/teacher + status filter narrow within current 50-row page; Next/Prev only when >50
- [ ] Status actions — _how:_ Mark attended / No-show / Cancel — _expect:_ badge updates; cancel stores cancelled_at + reason; confirmed rows only

### Customers
- [ ] 🔴 Promote to admin — _how:_ /admin/customers → Promote — _expect:_ role → admin, shield + Demote button (needs 0006 + 0018)
- [ ] 🔴 Demote from admin — _how:_ admin row → Demote — _expect:_ role → customer; if 0010 unapplied the RPC 404s + Postgres-error toast
- [ ] Add credits — _how:_ Add credits, 1–100 — _expect:_ balance increments; 0 or >100 rejected client + server; add-only (needs 0011)

### Teachers
- [ ] 🔴 Create — _how:_ /admin/teachers → Add teacher — _expect:_ row inserted → detail page; needs admin RLS INSERT
- [ ] 🔴 Edit details/media/hide — _how:_ /admin/teachers/[id] → Edit, upload avatar/cover/video, save, then Hide — _expect:_ updates + POST /api/admin/revalidate busts /, /teachers, /teachers/[slug]; media → teacher-media bucket (0008); Hide → is_active=false, drops from marketing
- [ ] 🔴 Invite/link login — _how:_ Invite, new email then existing customer; try admin + already-teacher — _expect:_ new → invite + role flip; existing customer → linked + promoted; admin → 409 "demote them first"; existing teacher → 409 "revoke first" (invite needs Supabase SMTP)
- [ ] Revoke login — _how:_ Revoke access — _expect:_ login → customer, teacher profile preserved; 0026 prevents demoting a non-teacher
- [ ] Availability grid & overrides — _how:_ /admin/teachers/[id]/slots — _expect:_ weekly cells + date overrides persist immediately in teacher's TZ (reachable only via teacher detail)

### Catalog & settings
- [ ] 🔴 Plans create/edit price — _how:_ /admin/plans → Add/Edit, INR + AED — _expect:_ card shows INR · AED + credits, /pricing reflects; plan_prices upsert needs 0022 (else "Saved plan but prices failed")
- [ ] Discounts — _how:_ /admin/discounts → New code / edit — _expect:_ persists + lists; dialog notes codes NOT applied at checkout (stored only)
- [ ] 🔴 Media upload/edit/delete — _how:_ /admin/media — _expect:_ uploads to promotional-media, thumbnail renders; first-upload RLS error = 0008 unapplied; delete removes DB row + object
- [ ] Classes create/edit — _how:_ /admin/classes — _expect:_ category persists, /classes reflects; helps_with/what_to_expect parse as text[]; needs 0023/0024
- [ ] Reviews approve/feature/delete — _how:_ /admin/reviews — _expect:_ badges flip, approved+featured surface on marketing; "No reviews yet." empty state
- [ ] 🔴 Settings landing/brand/email — _how:_ /admin/settings → edit + Save → reload — _expect:_ landing copy propagates ~60s (revalidate:60); Legal tab is a stub; verify whether brand colors are consumed at runtime

---

## Teacher Surface

### Provisioning & routing
- [ ] 🔴 Invite NEW email — _how:_ /admin/teachers/[id] → Invite, no-account email — _expect:_ inviteUserByEmail (redirectTo /auth/callback?next=/teacher) + promote_to_teacher; email link → session → /teacher; panel → "Login active"
- [ ] 🔴 Link EXISTING customer email — _how:_ Invite an existing customer — _expect:_ "now linked as a teacher login" (invited=false, no email); next login → /teacher
- [ ] Invite guardrails — _how:_ admin email / already-teacher / already-linked — _expect:_ 409 "belongs to an admin" / "already a teacher login…" / panel shows Login active; friendly toast, no 500
- [ ] 🔴 Teacher login → /teacher — _how:_ Email OTP and Google as teacher — _expect:_ both special-case role='teacher' → /teacher; never the customer onboarding form
- [ ] 🔴 Middleware role gating — _how:_ customer/admin/teacher cross-hit /teacher, /dashboard, /admin — _expect:_ customer → /dashboard, admin → /admin, teacher on /dashboard → /teacher, teacher on /admin → /teacher, unauth → /login?next=/teacher
- [ ] 🔴 Nav reachability — _how:_ /teacher sidebar + mobile drawer — _expect:_ Overview, My schedule, Student documents, My availability, My profile all navigate; /teacher reachable ONLY via post-login redirect or sidebar
- [ ] Revoke teacher access — _how:_ /admin/teachers/[id] → Revoke — _expect:_ demote_from_teacher → role customer + unlink profile_id (data preserved); ex-teacher hitting /teacher → /dashboard; admin can't demote self
- [ ] Teacher w/ role but no record — _how:_ /teacher unlinked — _expect:_ "Your teacher profile isn't linked yet" card + Sign-out; sub-pages notFound() gracefully

### Overview & schedule
- [ ] 🔴 Next session card — _how:_ /teacher with upcoming booking — _expect:_ student name, IST time, student local time + TZ, "+N more upcoming", "Join on Google Meet" when meet_link; failed → "being retried", pending → "ready shortly"
- [ ] Overview empty state — _how:_ /teacher no sessions — _expect:_ "No upcoming sessions." + "Update availability" → /teacher/availability; both tiles render
- [ ] 🔴 Schedule tables — _how:_ /teacher/sessions — _expect:_ Upcoming/Past with When(IST)+duration, student name (+N), local time+tz, category, status pill, Join on upcoming rows; in-progress stay Upcoming; cancelled excluded; mobile horizontal scroll
- [ ] 🔴 Student data resolves — _how:_ /teacher/sessions with real booking — _expect:_ student name + TZ populate (NOT '—'); if blank everywhere, service-role client misconfigured

### Availability & profile
- [ ] 🔴 Weekly grid toggle — _how:_ /teacher/availability click cells (05:00–22:00 × Sun–Sat) — _expect:_ client insert/delete via 'teacher_availability_self_all' RLS; reload persists; times in teacher TZ
- [ ] Custom windows + overrides — _how:_ /teacher/availability — _expect:_ non-1h "Custom windows" list deletable; date overrides insert/delete via 'teacher_slot_overrides_self_all'
- [ ] Availability propagates to booking — _how:_ add window then customer booking flow — _expect:_ slot becomes bookable; blocked date disappears
- [ ] 🔴 Profile edit + save — _how:_ /teacher/profile edit name/headline/bio/specialties/languages/years — _expect:_ update via 'teachers_self_update'; "Profile saved."; empty name + years out of 0–80 rejected; admin-only cols (slug/avatar/calendar/TZ/is_active) locked by trigger
- [ ] Profile public propagation — _how:_ save → /teachers/[slug] (ISR 300s) — _expect:_ edits appear after the window (no /api/admin/revalidate on teacher path)
- [ ] Sign out / Back to site — _how:_ /teacher header/drawer — _expect:_ sign out → public site; Back to site → /; WhatsApp button present
- [ ] Mobile shell — _how:_ /teacher narrow viewport — _expect:_ hamburger drawer with all 5 links + Back to site + Sign out + user card; tables scroll horizontally

---

## Medical Documents (PHI)

### Customer side
- [ ] 🔴 Page reachability — _how:_ dashboard sidebar → Health documents — _expect:_ /dashboard/documents loads with hero, ShieldCheck privacy banner, dashed upload tile, no 500
- [ ] Empty state — _how:_ fresh account — _expect:_ "No documents yet. Upload a report above to get started."; access-history hidden when empty
- [ ] 🔴 Upload happy path — _how:_ PDF/JPG/PNG/WEBP/HEIC <25MB — _expect:_ direct-to-bucket {uid}/{uuid}.{ext} → POST /api/medical-documents → "Document uploaded."; doc shows type/size/date + "Private — not shared"
- [ ] 🔴 Size limit — _how:_ >25MB — _expect:_ client toast "That file is NN MB — the limit is 25 MB."; server 413 too_large removes orphan
- [ ] 🔴 Mime limit — _how:_ .txt/.docx/.mp4 — _expect:_ "Unsupported file. Upload a PDF, JPG, PNG, WEBP, or HEIC."
- [ ] HEIC empty file.type — _how:_ iPhone .heic — _expect:_ resolveMime falls back to extension → image/heic, upload succeeds
- [ ] 🔴 Vault not provisioned — _how:_ upload where 0027 unapplied — _expect:_ specific toast "Upload blocked: the 'medical-documents' vault isn't set up yet. Apply supabase/migrations/0027…"
- [ ] Metadata POST rollback — _how:_ forced metadata error — _expect:_ orphan object removed, "Couldn't save: …", no half-record
- [ ] 🔴 Share — no booked teacher — _how:_ Share with no prior booking — _expect:_ "You can share with a teacher once you've booked a session with them."
- [ ] 🔴 Share with booked teacher — _how:_ booked teacher X → Share — _expect:_ share_medical_document RPC, "Document shared.", row → "Shared", "Shared with [Teacher]" chip
- [ ] 🔴 Revoke — _how:_ click "Shared" toggle — _expect:_ revoke_medical_document_share, "Access revoked.", chip gone, teacher view drops doc
- [ ] Orphan share (deactivated teacher) — _how:_ share → admin unlinks teacher → reopen Share — _expect:_ "(no longer active)" row with Revoke button
- [ ] 🔴 Download (signed URL) — _how:_ Download icon — _expect:_ POST /[id]/download → 60s signed URL → window.open; access-log "You opened [file]"
- [ ] Access history — _how:_ below doc list after a download — _expect:_ "[accessor] opened [file]" + timestamp in customer TZ; teacher name / "You" / "A teacher"
- [ ] 🔴 Delete — _how:_ trash → confirm — _expect:_ DELETE soft-deletes, revokes active shares, removes bytes, "Document deleted."; Keep cancels
- [ ] Delete → access log gone — _how:_ after deleting a downloaded doc — _expect:_ history rows no longer shown (by design)

### Teacher side
- [ ] 🔴 Page reachability — _how:_ teacher sidebar → Student documents — _expect:_ /teacher/documents loads with header + confidentiality note; non-teacher redirected
- [ ] Empty state — _how:_ teacher with no shares — _expect:_ "No documents have been shared with you yet."
- [ ] 🔴 Shared docs grouped by student — _how:_ after a share — _expect:_ section per student with name, count, file name/type/size, optional italic note (service-role read resolves names)
- [ ] 🔴 Open/download — _how:_ Open on shared doc — _expect:_ signed URL in new tab; customer log records "[Teacher] opened [file]"; audit row written first (fails closed)
- [ ] 🔴 Access lost after revoke/delete — _how:_ customer revokes/deletes then teacher clicks Open — _expect:_ route not_found, "This document is no longer shared with you."; gone on reload
- [ ] Mobile layout — _how:_ both pages narrow — _expect:_ action rows flex-wrap, cards readable, dialogs usable

---

## Cron & Email

### Cron auth
- [ ] 🔴 Secret unset (fail closed) — _how:_ POST any cron endpoint before CRON_SECRET set — _expect:_ 503 {"error":"CRON_SECRET env var is not set"}
- [ ] 🔴 Wrong/missing bearer — _how:_ POST with wrong token + no header — _expect:_ 401 {"error":"unauthorized"} (constant-time)
- [ ] 🔴 Valid token accepted — _how:_ POST all 4 with correct secret — _expect:_ 200 JSON ({ok:true,…}), no 500

### Reminders
- [ ] 🔴 24h window email — _how:_ booking ~24h out (±10min), customer email+TZ, POST reminders — _expect:_ one email, customer TZ, Meet link if set, processed increments
- [ ] 🔴 1h window email — _how:_ booking ~1h out, POST reminders — _expect:_ one "1 hour" email; both windows in one pass
- [ ] 🔴 Idempotency — _how:_ POST reminders twice — _expect:_ at most one email per window (reminded_at stamps); needs 0016 or claim errors and SKIPS the send
- [ ] Recipient with no email — _how:_ null email then populate + re-POST — _expect:_ first skips without burning the claim; later run still sends

### No-show & meet-retry & orphan
- [ ] 🔴 No-show flip 2h after end — _how:_ past confirmed booking, meet_status='created' — _expect:_ confirmed → no_show, {processed:1}; <2h ago untouched
- [ ] No-show skips un-provisioned Meet — _how:_ meet_status pending/failed — _expect:_ NOT marked no_show (not penalised)
- [ ] No-show batch cap — _how:_ >200 eligible, repeat POSTs — _expect:_ ≤200 oldest-first/run, drains backlog
- [ ] 🔴 Meet-retry provision — _how:_ future pending/failed session, POST — _expect:_ meet_link + meet_event_id + 'created', customer added as attendee (needs full OIDC env)
- [ ] Meet-retry scope — _how:_ past/cancelled/created sessions — _expect:_ skipped; ≤50 future pending/failed/run by start_at
- [ ] Meet-retry failure — _how:_ force Calendar failure — _expect:_ stays 'failed', no crash, 200 processed=0, next run retries
- [ ] Orphan-sweep removes bytes — _how:_ upload bytes w/o metadata, wait >1h, POST — _expect:_ aged orphan removed; {scanned,candidates,orphans,removed,truncated}; <1h spared
- [ ] Orphan-sweep keeps live+recent — _how:_ live doc + <1h orphan — _expect:_ live untouched, <1h untouched, only aged true orphans removed

### Email
- [ ] 🔴 Booking confirmation — _how:_ real booking — _expect:_ email arrives, times in customer TZ, Meet link if available; email failure never breaks booking
- [ ] Contact form email — _how:_ POST /api/contact — _expect:_ forwarded to support inbox, reply-to sender, HTML-escaped
- [ ] No-op without RESEND_API_KEY — _how:_ trigger email with key unset — _expect:_ {ok:true,skipped:true}, logs, flow continues
- [ ] 🔴 From-address / domain — _how:_ inspect From header of delivered email — _expect:_ on Resend-verified domain (default hello@myyogaclasses.fit); RESEND_FROM_EMAIL override must NOT be stale .com.au or sends silently fail
- [ ] 🔴 Auth OTP rate limit — _how:_ several /login OTP sends — _expect:_ codes arrive; "email rate limit exceeded" = Supabase built-in throttle → fix is custom SMTP in Supabase dashboard

---

## Cross-cutting

### Timezones
- [ ] 🔴 Slot picker display — _how:_ /dashboard/book Asia/Dubai then Asia/Kolkata — _expect:_ labels shift (7PM IST → 5:30PM Dubai); helper line; tooltip = teacher IST time
- [ ] 🔴 IST teacher-side label — _how:_ /teacher + /teacher/sessions — _expect:_ all times suffixed "IST" in Asia/Kolkata regardless of teacher device clock
- [ ] SSR hydration — _how:_ hard-reload /dashboard/book non-IST — _expect:_ no hydration warning; stored profile TZ on first paint then browser TZ; "Checking your location…" first for trial users
- [ ] 🔴 Onboarding auto-detect + override — _how:_ /onboarding from Dubai device — _expect:_ field pre-filled, searchable ~400 IANA picker, persists; legacy zone still gets a friendly label
- [ ] Confirmation email TZ — _how:_ book + inspect email — _expect:_ uses saved profile.timezone (not live browser, not IST)
- [ ] Cross-midnight slot rejection — _how:_ window touching midnight IST — _expect:_ not bookable; 409 slot_unavailable

### Geo / currency
- [ ] 🔴 Pricing local currency — _how:_ /pricing Dubai-TZ then India-TZ — _expect:_ AED then INR, matching footnote, INR SSR default no mismatch
- [ ] 🔴 Server resolves charged currency from GeoIP — _how:_ UAE IP / x-vercel-ip-country=AE, buy — _expect:_ AED order even if browser sends India TZ; spoofed clientTimezone can't change charge
- [ ] 🔴 Out-of-area trial blocked — _how:_ America/New_York + non-IN/AE IP, trial unused — _expect:_ banner naming detected TZ; server 403 outside_service_area
- [ ] 🔴 Out-of-area purchase blocked — _how:_ non-IN/AE location, buy — _expect:_ 403; "Session packs can only be purchased from within the UAE or India."; no modal
- [ ] Admin bypass — _how:_ admin any location, trial + buy — _expect:_ canTransactFromRequest true; both succeed
- [ ] Paid bookings not geo-gated — _how:_ trial used + credits, out-of-area — _expect:_ booking succeeds (only trial + purchase gated)

### Mobile / responsive
- [ ] 🔴 Sticky CTA on home — _how:_ 375px, scroll >600px — _expect:_ slides up fixed bottom, md:hidden, hidden before 600px, → /login?next=/dashboard/book
- [ ] 🔴 Header + hamburger — _how:_ 375px any marketing page — _expect:_ desktop links hidden, hamburger toggles #mobile-nav-menu, links close on tap, auth swaps for signed-in, backdrop after 12px scroll
- [ ] WhatsApp button stacking — _how:_ / mobile (env set) — _expect:_ bottom-24 above sticky CTA, bottom-6 on md+, null if env unset

### RLS / roles
- [ ] 🔴 Middleware area gating — _how:_ customer/teacher/admin/logged-out cross-hit /admin, /teacher, /dashboard — _expect:_ correct redirect per role; public /teachers NOT gated (exact-segment)
- [ ] Guard vs middleware on API — _how:_ POST confirm/create-order logged out — _expect:_ each 401 from own getUser(); admin-only routes re-check role inline
- [ ] Post-login routing by role — _how:_ teacher no ?next; half-onboarded customer — _expect:_ teacher → /teacher, customer w/o experience_level → /onboarding, else safe ?next

### Mock fallback
- [ ] 🔴 Zero-Supabase render — _how:_ /, /teachers, /classes, /pricing, /reviews no env — _expect:_ 6 mock teachers, 9 categories, 2 packs, mock reviews/copy, no crash, middleware no-ops, SVG avatars

---

## Suggested test order

1. **Verify the wiring gaps first** — work the ⚠️ section against the live env (migrations applied, OIDC, webhook secret, Resend/SMTP domains, cron scheduler, Razorpay International). Most "broken feature" reports trace back here.
2. **Zero-env / mock pass** — with no Supabase env, browse all marketing routes (cheap smoke test, catches crashes).
3. **Create / log in as an admin** — reach /admin by typing the URL; confirm KPIs + sidebar load.
4. **Seed catalog as admin** — create a teacher, **upload a real photo**, set plan INR+AED prices, create class categories, add promotional media.
5. **Set the teacher's availability** — /admin/teachers/[id]/slots (or have the teacher do it after step 6). Without this, every booking page shows "No times available" — do this before any booking test.
6. **Promote a teacher login** — invite an email, confirm the invite/link path, then **log in as that teacher and confirm you land on /teacher** (the headline reachability check). Set availability from /teacher/availability and confirm it propagates to the customer booking flow.
7. **Onboard a fresh customer** — Email OTP (verify a 6-digit code arrives, not a magic link) → onboarding (timezone auto-detect) → /dashboard.
8. **Book the free 1:1 trial** (UAE/India TZ) — verify the trial path, redirect to /dashboard/plan?booked=1, and that a Meet link provisions (or "Get link" / cron retry works).
9. **Buy a session pack** — INR happy path, then AED (UAE GeoIP) — verify credits granted, idempotency (close tab → webhook path), and a real receipt expectation.
10. **Book a paid session** — confirm one credit is spent; test 0-credit guard, double-book race (two tabs), and out-of-service-area gate.
11. **Cancel** — a free trial (no refund) and a paid booking (credit refunded).
12. **Medical documents** — upload as the customer, share with the teacher booked in step 8, download from both sides, check the access log, then revoke and confirm the teacher loses access.
13. **Admin operations** — cancel a session (cascade), mark attended/no-show, approve/feature a review (note: no customer submission UI), promote/demote admin (0010 check).
14. **Cron + email** — curl all four cron endpoints with the Bearer secret; trigger reminders against the seeded booking; inspect a delivered email's From header.
15. **Cross-cutting sweep** — timezones, currency display vs charge, mobile sticky CTA / hamburger, RLS role redirects, legal-page sign-off.
