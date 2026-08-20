# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next dev server on :3000
npm run build        # Production build
npm run lint         # eslint . — flat config in eslint.config.mjs (was `next lint`; swapped for Next 16)
npm run typecheck    # tsc --noEmit — strict mode is on
npm test             # vitest run
npm run test:watch   # vitest

# Single file / single test
npx vitest run lib/geo/region.test.ts
npx vitest run lib/geo/region.test.ts -t "accepts the served markets"

# Drizzle (schema source of truth is supabase/migrations — see "Schema ownership")
npm run db:generate  # Generate a migration from lib/db/schema.ts diff
npm run db:migrate   # Apply pending Drizzle migrations
npm run db:studio    # Open Drizzle Studio
```

**Test convention:** Vitest 2, `environment: "node"` (`vitest.config.ts`, `@` aliased to repo root). Tests sit beside their source (`lib/geo/region.test.ts`). Coverage is deliberately limited to **pure, dependency-free helpers** — no DB, no network, no React, no mocks anywhere. There is no integration or component test harness; don't assume one exists.

`legacy-peer-deps=true` is forced via `.npmrc` because `@sentry/nextjs` hasn't bumped its Next.js peer cap to 16 — `npm install` without it will fail. Do not remove it, and make sure your host honours `.npmrc` (or passes `--legacy-peer-deps`) at install time.

Node ≥20 is required (`package.json` engines).

## Big-picture architecture

This is a **conversion-first marketing site + customer dashboard + admin shell + booking backend** for a yoga studio: **UAE + India customers, Indian teachers, sessions on Google Meet, Razorpay one-time session-pack payments for billing (multi-currency: UAE→AED, India→INR)**. The cross-timezone story (customer ↔ IN teacher) is load-bearing — see the Timezones section. The served countries are an allow-list `{IN, AE}` (see `lib/geo/region.ts`).

### Route groups in `app/`

- **`(marketing)/`** — public, no auth, renders with mock data if Supabase isn't configured (see "Mock fallback"). Pricing, teachers, classes, reviews, legal pages.
- **`(auth)/`** — `/login`, `/onboarding`, `/auth/callback`. Login uses Supabase: Google OAuth + passwordless **Email OTP** (`signInWithOtp({ email })` → `verifyOtp({ email, token, type: "email" })`). The inline 6-digit code flow needs the Supabase "Magic Link" email template to include `{{ .Token }}`, else Supabase sends a magic link instead. Phone/SMS OTP has been removed; `profiles.phone` is now an optional, user-supplied contact field (not used for auth and not required to book).
- **`(dashboard)/`** — customer area, gated by middleware.
- **`(teacher)/`** — the teacher surface at `/teacher` (schedule, documents), gated by middleware *and* `requireTeacher()`. See "Teacher accounts".
- **`admin/`** — role-gated by middleware *and* `requireAdmin()` in pages. Admin-edited landing copy lives in the `admin_settings` table (key→jsonb) and is read with `revalidate: 60`, so changes propagate ≤1 min.
- **`api/`** — route handlers for booking confirm/cancel, Meet link creation/retry (`meet/create-link`), admin session create/cancel (`admin/sessions`), admin manual credit grants (`admin/credits`), account deletion (`account/delete` self-serve, `admin/customers/[id]` admin-initiated — both share the cascade in `lib/account/deleteAccount.ts`), Razorpay order-create + payment-verify (`razorpay/create-order`, `razorpay/verify-payment`) + **webhook**, the bank-transfer rail (`payments/intent`, `admin/payments/[id]`), medical documents, contact + newsletter, on-demand ISR busting (`admin/revalidate`), and the scheduled-job handlers under `cron/*` (see "Scheduled jobs"). Middleware **does not** run on `/api/` (see `middleware.ts` matcher) — every handler must auth itself, and admin-only routes re-check `profiles.role` inline.

### Three auth-guard paths — use the right one

1. **`middleware.ts` → `lib/supabase/middleware.ts`** runs on every non-API, non-static request. Refreshes the Supabase session cookie *and* does role routing: unauth users off `/dashboard|/admin|/teacher`, non-admins off `/admin`, non-teachers off `/teacher`, teachers off `/dashboard`. Cookies set during the auth refresh have to be re-applied to redirect responses — that's what the `pendingCookies` array is doing; don't drop it if you edit the file. Matching uses the `inArea()` helper (`path === base || startsWith(base + "/")`), deliberately **not** a bare prefix — a bare prefix would make `/teacher` swallow the public `/teachers` marketing listing.
2. **`lib/auth/guards.ts`** — `requireUser()` / `requireAdmin()` / `requireTeacher()` for Server Components and Server Actions. Middleware is routing, not an authorization boundary; the guard is the real gate, so call it in the page/layout too. **API route handlers must call `supabase.auth.getUser()` themselves** because middleware skips `/api/`.
3. **`lib/cron/auth.ts` → `assertCron(req)`** — for the machine-triggered `cron/*` handlers, which use no Supabase auth at all. It checks `Authorization: Bearer <CRON_SECRET>` and fails **closed**: 503 if `CRON_SECRET` is unset, 401 if it's wrong. Call it first in every cron handler.

### Three Supabase clients — pick by context

| Client | File | When to use |
|---|---|---|
| Browser | `lib/supabase/client.ts` (`createSupabaseBrowserClient`) | Client components, calls protected by RLS |
| Server (cookie-bound) | `lib/supabase/server.ts` (`createSupabaseServerClient`) | Server components, route handlers, Server Actions — runs as the logged-in user, subject to RLS |
| Service-role | `lib/supabase/service.ts` (`createSupabaseServiceClient`) | Server-only, **bypasses RLS**. Required for `sessions` and `bookings` writes (admin-only INSERT policy), Razorpay fulfilment + webhook, cron jobs. Always gate behind your own auth/role check first. |

### Drizzle alongside `supabase-js`

`lib/db/client.ts` exposes a Drizzle client (`postgres-js` over `SUPABASE_DB_URL`) used for typed complex queries (booking-conflict checks, KPI rollups). **It also bypasses RLS** — same gating rule as the service-role client. The Drizzle schema in `lib/db/schema.ts` is a *mirror* of the Supabase migrations, not the source of truth.

### Schema ownership

- **Authoritative migrations live in `supabase/migrations/0001…0033`** and run via the Supabase SQL editor / `psql`. They contain RLS policies, RPCs, triggers, idempotency tables, partial unique indexes, and Storage bucket policies — none of which Drizzle generates. Highlights:
  - `0011` Razorpay credit-pack billing · `0016` booking-reminder idempotency · `0017` booking-integrity (`book_session` RPC + overlap EXCLUDE) · `0018` RLS/grants hardening · `0019` refund reconciliation
  - `0020` retires the legacy subscription plans for one-time credit packs + a `one_time` billing interval · `0021` refund-once idempotency (`refund_session_credit`) + blocklist check inside `book_session`
  - `0022` multi-currency: `plan_prices` (AED/INR) child table, `price_aud_cents`→`price_base_cents` / `amount_aud_cents`→`amount_cents` renames, currency-neutral `fixed_amount_cents` discount enum, `admin_kpis` per-currency revenue
  - `0023` + `0024_category_copy_positive` condition-based class categories · `0024_teacher_role`/`0025`/`0026`/`0028`/`0029` teacher logins (see "Teacher accounts") · `0027` private medical documents
  - `0030` bank-transfer payment rail · `0031` pack pricing (adds `pack-1`, re-prices AED) · `0032` discount redemptions · `0033` makes the `payments.razorpay_payment_id` unique index **total** rather than partial (a partial index can't serve as an `ON CONFLICT` arbiter for PostgREST's `.upsert()`, which was raising `42P10` → `payment_record_failed`, i.e. "captured but no credits")
- ⚠️ **There are two `0024_` files** (`0024_teacher_role.sql` and `0024_category_copy_positive.sql`) — they shipped from parallel branches. Apply both; don't "fix" the numbering, the live DB already has them.
- `drizzle.config.ts` points `out` at `supabase/migrations`, but `db:generate` is for *introspection and ad-hoc work*. When you change schema, write the SQL by hand to keep RLS / RPCs intact and bump the migration number. `0007_security_fixes.sql` is the canonical example of how add-on migrations are structured.
- **Writing the migration file is not enough — apply it to the live DB** (`psql`/SQL editor). Features break until their object exists: e.g. the `/admin/customers` Demote button 500s until `0010`'s RPC is applied.

### Storage buckets

Migration `0008` provisions two **public-read, admin-write** Storage buckets: `promotional-media` (hero videos, banners, testimonial photos, class thumbnails — the `/admin/media` tab) and `teacher-media` (per-teacher avatars, covers, intro videos — `TeacherFormDialog`). Writes are gated by the same `public.is_admin(auth.uid())` helper that guards app tables. If an admin upload fails with *"new row violates row-level security policy"*, the bucket policy is the cause — re-apply `0008`, don't make the bucket world-writable.

Marketing pages render these images via `next/image`, so the bucket host (`**.supabase.co/storage/v1/object/public/**`) is allow-listed in `next.config.ts` → `images.remotePatterns`; add any new image host there or optimization throws. Teacher edits are a client-side Supabase write (which can only `router.refresh()` the admin route), so after a save the admin client calls `POST /api/admin/revalidate` to bust the ISR cache on `/`, `/teachers`, `/teachers/[slug]` (the teacher listing/detail pages set `revalidate = 300`).

Migration `0027` adds a **third, deliberately different** bucket: `medical-documents` is **PRIVATE** (`public = false`) with a 25 MB cap and a mime allow-list (pdf/jpeg/png/webp/heic/heif). It holds customer-uploaded health records — sensitive personal data (UAE PDPL / India DPDP), so the rules invert the media buckets:
- **No public URLs ever.** Bytes are reachable only via short-lived (60s) signed URLs minted server-side in `POST /api/medical-documents/[id]/download`, which authorizes + writes an append-only `medical_document_access_log` row first.
- **Storage RLS is owner-folder-only**: a customer reads/writes/deletes only inside `{auth.uid()}/…`. Teachers and admins get **no direct Storage access** — teachers reach files exclusively through the download route. The customer uploads bytes direct-to-bucket, then `POST /api/medical-documents` records the metadata row (path-prefix re-validated, true size stat'd).
- **Sharing is explicit + revocable**: a customer shares a single document with a teacher *they have booked* via the `share_medical_document` RPC (gated by `customer_booked_teacher`); `revoke_medical_document_share` reverses it. A teacher sees a doc only while an un-revoked share exists (`teacher_has_document_share`).
- **Admins get NO read access to PHI** (no admin RLS policy on these tables — by design). The owner can read their own access log (transparency).
- Server data access lives in `lib/medical/documents.ts` (customer queries on the RLS client; teacher queries on the **service-role** client like `lib/teacher/sessions.ts`, since a teacher can't read `profiles`). Shared client/UI constants (bucket id, limits) are in `lib/medical/constants.ts`. UI: `/dashboard/documents` (customer) and `/teacher/documents` (teacher).
- This bucket's host is **not** in `next.config.ts` remotePatterns and must not be — these files are never rendered via `next/image`; they download through signed URLs only.

### Teacher accounts (`0024_teacher_role` → `0029`)

A "teacher" is two separable things: a **record** in `public.teachers` (since `0002`, no auth identity) and an **optional linked login**. `POST /api/admin/teachers/[id]/invite` is the single creation path — it finds an existing profile by email or calls `auth.admin.inviteUserByEmail(..., redirectTo: /auth/callback?next=/teacher)`, then **always** elevates via the `promote_to_teacher(target_user_id, target_teacher_id, acting_admin_id)` RPC. That RPC is the only elevation route: it self-gates on `is_admin(...)`, links `teachers.profile_id` atomically (refusing to steal an already-linked record), sets `profiles.role='teacher'`, and writes `audit_log`. `demote_from_teacher()` reverses it (cannot self-demote) but currently has **no API route** — the revoke UI path is incomplete.

Things that break silently if you touch them:
- `0024_teacher_role` must be applied **in its own transaction** before `0025` — Postgres forbids using a new enum label in the transaction that adds it.
- The `auth.uid() IS NULL ⇒ privileged` carve-outs in `tg_teachers_lock_admin_cols` (`0026`) and `tg_profiles_lock_sensitive` (`0029`) are load-bearing. Without them the service-role promote path silently reverts `profile_id`/`role` and you get half-promoted teachers. The `0013` INSERT hardening (force `role='customer'`) stays intact so elevation only ever happens via UPDATE through the RPCs.
- `teachers_profile_id_uniq` (`0028`, partial unique on non-null `profile_id`) makes the DB the source of truth for one-profile-one-teacher; the app's check-then-act guards are racy without it, and every `.eq("profile_id", …).single()` breaks on a double link.
- `0028`'s `teachers_revoke_shares_on_unlink` trigger revokes `medical_document_shares` whenever `profile_id` moves away from a person. Removing it is a PHI leak.
- Identity helpers (`is_teacher`, `owns_teacher`, `teacher_owns_booking`) are `SECURITY DEFINER` to avoid RLS recursion — keep them that way.

`lib/teacher/sessions.ts` uses the **service-role** client on purpose: `0025` grants a teacher RLS read on their own `sessions`/`bookings`, but `profiles` stays self/admin-only, so a teacher's own token cannot read the *student's* name/timezone that the schedule UI needs. It's gated by `requireTeacher()` plus an explicit `.eq("teacher_id", teacherId)`, and deliberately does not select student emails. Teachers are read-only on sessions/bookings; creation, cancellation, and attendance stay admin/service-role.

### Two payment rails — Razorpay and manual bank transfer

Since `0030` there are **two** rails, and the choice is made **server-side only**. `POST /api/payments/intent` is the single entry point the buy-a-pack UI calls: it authenticates, applies the service-area gate (`canTransactFromRequest`), resolves currency via `resolveRegion()`, and returns `{ method: "razorpay" }` with **no side effects** for non-AED (India continues on the untouched create-order → verify flow). AED creates or reuses a `pending` `payments` row with `method='bank_transfer'` and a random `MYC-XXXXXX` reference. This is a temporary rail until Razorpay International/AED is enabled on the account.

Bank-transfer states: `pending` → `completed` (admin verify) or `failed` (admin reject); `refunded`/`failed` are terminal. Approval is admin-only via `POST /api/admin/payments/[id]` (`action: verify|reject`), which re-checks `profiles.role` inline. It grants credits through the **same** `grant_session_credits(...)` RPC the Razorpay rail uses — it mirrors `lib/razorpay/fulfillment.ts` rather than introducing a parallel grant path. `POST /api/admin/credits` is a separate add-only manual grant (`reason='admin_adjust'`, `p_payment_id: null`, 1–100 credits).

Invariants:
- **Grant credits *before* flipping status.** A grant failure must leave the row `pending`/retryable, never `completed` with no credits.
- The status update is conditioned on `.eq("status","pending")`, so re-verify is a no-op.
- The partial unique index `payments_one_pending_bank_transfer (customer_id, plan_id) where method='bank_transfer' and status='pending'` is the real double-credit defense — the intent route catches `23505` and re-reads the winner.
- The intent route resolves price from the **explicit AED `plan_prices` row** and refuses the `plans.price_base_cents` fallback: that INR figure is literally what the customer would be told to wire.
- `lib/payments/bankTransfer.ts` holds the UAE account details as client-safe constants and must **not** import `server-only` — the customer dialog imports it.

### Discount codes (`0032`) — reserve → commit

A reserve-at-checkout / commit-at-fulfilment ledger layered on the credit-pack flow. (The older `discount_codes` table from `0004` belonged to the retired PayPal subscription rail and had no plumbing into packs.)

`reserve_discount_redemption` runs `FOR UPDATE` on the code row (serializing cap checks), validates active/date-window/`applies_to_plan_ids`/currency lock, counts *live* (`reserved` + `committed`) uses against `max_uses` and `per_email_max`, computes the discount **in the order currency**, rejects `final < 100` minor units, and snapshots a lowercased email from the session. Statuses: `reserved` → `committed` | `released`; `committed` → `reversed` (terminal, full refund only). A `released` row can be **resurrected** to `committed` — that's what makes a post-sweep late capture still work.

Both rails share `lib/billing/promo.ts`. Razorpay: create-order reserves, then stamps `discountRedemptionId` into the **Razorpay order notes** so `fulfillRazorpayPayment` can `commit_discount_redemption` exactly once without a fragile post-order DB patch. Bank transfer: the intent route reserves and patches `payment_id` onto the redemption; admin verify calls `commit_discount_redemption_by_payment`, admin reject calls `release_discount_redemption`. Full refunds release from `reverseRazorpayPayment`.

Invariants: amounts are always derived server-side (the client sends only a raw string through `normalizePromoCode`); commit guards on `status in ('reserved','released')` so a double-fire can't double-increment `times_used`; `reversed` must never re-commit; every RPC is `SECURITY DEFINER` with EXECUTE revoked from `public`/`anon`/`authenticated`; promos apply only when *creating* a bank transfer, never re-priced onto an in-flight one; orphaned reservations must be released on every failure path.

### Mock fallback for the marketing site

`lib/data/landing.ts` checks `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` and returns hand-written mock data (`MOCK_TEACHERS`, `MOCK_PLANS`, etc.) when Supabase isn't wired up. The marketing pages render cleanly with zero env vars, which is the desired preview/dev story. Keep this pattern when adding new public data — fall back to a sensible mock, don't crash. The mocks roughly mirror `supabase/seed.sql`.

### Timezones — critical, easy to get wrong

- All DB timestamps are `timestamptz` (UTC). Never store wall-clock times.
- `lib/timezone/index.ts` is the only place that formats: `formatCustomerTime` (default `DEFAULT_CUSTOMER_TZ` = `Asia/Kolkata`), `formatTeacherTime` (always `Asia/Kolkata`, suffixed "IST"). Use these instead of `date-fns` `format` directly so DST is handled. Customers store their real device-detected IANA zone (global picker in `components/ui/timezone-select.tsx`).
- Booking-availability checks compare strings — see `slotInsideAvailability` in `app/api/bookings/confirm/route.ts`. Postgres `day_of_week` is 0=Sun..6=Sat, date-fns `i` is 1=Mon..7=Sun — the helper normalises. Slots crossing midnight in the teacher TZ are currently rejected.

### Bookings + Meet flow

`POST /api/bookings/confirm` does, in order: auth, payload validation (zod), 15-min-future check, teacher lookup, **availability window check in teacher TZ**, **overlap check** against existing non-cancelled sessions, INSERT session with `meet_status='pending'`, INSERT booking. If the booking insert fails with PG error `23505` (duplicate), it's the `bookings_one_free_trial_per_customer` partial unique index firing — translate to `trial_already_claimed`, not a generic 500.

After the booking commits, the handler calls `createMeetEvent` (`lib/google/calendar.ts`). Auth is **keyless** — `getAccessToken()` runs Vercel OIDC → GCP Workload Identity Federation (STS) → IAM Credentials `signJwt` (with `sub` = a Workspace mailbox, i.e. domain-wide delegation) → jwt-bearer, so there is **no `GOOGLE_SERVICE_ACCOUNT_JSON`** (the org blocks downloadable SA keys). It needs `GOOGLE_WORKLOAD_IDENTITY_PROVIDER` / `GOOGLE_IMPERSONATE_SERVICE_ACCOUNT` / `GOOGLE_IMPERSONATE_SUBJECT` env vars, Vercel OIDC enabled, and `@vercel/oidc` — which is **Node-runtime only**, so any route reaching this file must stay on the Node runtime (no Edge). Locally it needs `vercel env pull` + `vercel dev` (plain `next dev` has no OIDC token and fails loud). On failure it leaves the booking in place and sets `meet_status='failed'` so a cron sweeper can retry — **do not roll back the booking on Meet failure**. The dashboard shows "Link available shortly" for `pending` / `failed`. Full setup runbook in the README ("Google Meet (keyless)").

### Razorpay one-time payments (session-pack credits)

Billing is **Razorpay one-time Checkout, multi-currency (UAE→AED, India→INR)**. A plan = a pack: per-currency prices (`plan_prices`, fallback `plans.price_base_cents`) + N `session_credits`. Buying a pack grants credits; booking a *paid* session spends one (the free 1:1 trial never touches credits). No subscriptions, no "sync" step — order amounts are set at create time.

Flow: `POST /api/razorpay/create-order` resolves the customer's currency from `resolveRegion()` (GeoIP country first, browser timezone fallback — see `lib/geo/region.ts`), then resolves the price server-side from `plan_prices` by `planSlug` + currency (the client never sends an amount) and stamps the order `notes` with `{customerId, planId, currency}`. The browser opens Checkout, then **either** path fulfils:
1. `POST /api/razorpay/verify-payment` — constant-time HMAC-SHA256 signature check, then `fulfillRazorpayPayment`.
2. `POST /api/razorpay/webhook` — `X-Razorpay-Signature`-verified (uses `RAZORPAY_WEBHOOK_SECRET`); the authoritative path for when the browser never returns.

**`lib/razorpay/fulfillment.ts` is the single fulfilment point and is idempotent**: it re-checks capture against the Razorpay API, upserts `payments` keyed on a UNIQUE `razorpay_payment_id`, then grants credits via the `grant_session_credits` RPC (purchase-once via a partial unique index on `credit_ledger`). **Never grant value from the client `onPaid` callback** — call fulfilment server-side. Booking spends a credit atomically via `spend_session_credit` (refunded if the insert fails). `lib/razorpay/client.ts` is the server-only SDK singleton: `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` server-side, `NEXT_PUBLIC_RAZORPAY_KEY_ID` for Checkout. INR settles natively on an Indian account; **AED orders need Razorpay International enabled** on the account.

### Scheduled jobs (handlers exist; scheduler is BYO)

Five cron handlers live under `app/api/cron/`, each gated by `assertCron` (Bearer `CRON_SECRET` — see auth paths above) and running on the service-role client:
- **`reminders`** (~hourly) — emails a ±10-min band around now+24h and now+1h. Idempotent since `0016` (`reminded_at_24h`/`reminded_at_1h` columns on `bookings` are claimed via conditional UPDATE before sending; there is no separate ledger table).
- **`no-show-sweep`** (~hourly) — flips still-`confirmed` bookings to `no_show` 2h after the session ended (`booking_status` enum from `0003`). Skips sessions whose Meet link never provisioned (`meet_status <> 'created'`) so a customer isn't penalised for an operational failure.
- **`meet-retry`** (~15–30 min) — retries `createMeetEvent` for not-yet-started sessions stuck at `meet_status='pending'|'failed'`, batched (50/run) to avoid Calendar rate limits.
- **`medical-orphan-sweep`** (~daily) — backstop cleanup for the private `medical-documents` bucket: removes stored objects >1h old with no live `medical_documents` row (failed metadata POST, or bytes left after a failed soft-delete removal). Bounded per run; reports `truncated` flags instead of silently capping.
- **`discount-reservation-sweep`** (~hourly) — `release_stale_discount_reservations(2h, 500)`. Required because an abandoned Checkout otherwise holds a `max_uses`/`per_email_max` slot forever, most painfully blocking the buyer's own retry. It sweeps **only `payment_id IS NULL`** rows: a bank-transfer reservation is tied to a real pending wire that may legitimately sit for days.

There is **no scheduler in the repo** (no `vercel.json` / host config). Wire each endpoint to your host's cron, an external scheduler, or Supabase `pg_cron` + `pg_net`, POSTing with `Authorization: Bearer $CRON_SECRET`.

## Conventions worth knowing before editing

- **Path alias:** `@/*` → repo root (see `tsconfig.json`). Use `@/lib/...`, `@/components/...`.
- **UI:** shadcn/ui with the `base-nova` preset (`components.json`). Tailwind 4 via `@tailwindcss/postcss`. Add components with `npx shadcn@latest add <name>` — they land in `components/ui/`.
- **Forms:** `react-hook-form` + `zod` + `@hookform/resolvers`. Mirror the zod schema on both client and the route handler.
- **Animation:** Motion (the rebrand of Framer Motion) + Lenis smooth scroll (provider in `app/layout.tsx`) + GSAP ScrollTrigger when timeline scrubbing is needed.
- **Locale:** `en` (per-currency `en-IN` / `en-AE` for money). Money helper is `formatMoney(cents, currency)` in `lib/i18n/money.ts`. Internal money is integer minor units (`plans.price_base_cents`, `plan_prices.amount_cents`, `payments.amount_cents`); never store floats. Currencies: AED + INR.
- **Analytics:** `lib/analytics/events.ts` — call `track(name, props)` with a name from the typed `EventName` allow-list (extend the union, don't pass free-form strings). `track()` / `initPosthog()` are silent no-ops when `NEXT_PUBLIC_POSTHOG_KEY` is unset, matching the zero-env preview story.
- **`cn` helper:** lives in `lib/utils.ts`; `lib/utils/cn.ts` just re-exports it. shadcn's `components.json` aliases `utils → @/lib/utils`, so import `cn` from `@/lib/utils`.
- **`server-only` import:** `lib/db/client.ts`, `lib/google/calendar.ts`, and `lib/razorpay/{client,fulfillment,catalog}.ts` use the `server-only` package — importing them from a client component will hard-fail the build. Keep that boundary. `lib/payments/bankTransfer.ts` and `lib/geo/region.ts` are the deliberate exceptions: both are imported client-side and must stay pure.
- **Error copy:** `lib/ui/errors.ts` (`friendlyAuthError` / `friendlyFormError`) is a mandated boundary. Raw Supabase/Postgres strings (RLS policy text, unique-constraint messages) must never reach a toast.
- **Service area + currency:** `lib/geo/region.ts` is the `{IN, AE}` gate. It prefers unforgeable edge GeoIP country over self-reported browser timezone specifically to close a spoofing bypass on the purchase and free-trial routes — don't reorder that precedence.
- **CSP:** `next.config.ts` ships a hand-maintained Content-Security-Policy allow-listing Razorpay, Supabase (REST + wss), PostHog, Sentry ingest, and Google OAuth. **Any new third-party origin must be added there or it silently breaks in production only.** `'unsafe-eval'` is dev-only; `'unsafe-inline'` for scripts is intentional (nonces would force every page dynamic).
- **Sentry:** wired via `instrumentation.ts` (server/edge + `onRequestError` for RSC errors) and `instrumentation-client.ts`. Both no-op without `NEXT_PUBLIC_SENTRY_DSN`. `withSentryConfig` / source-map upload is deliberately not set up yet.
- **SEO:** typed JSON-LD builders in `lib/seo/structuredData.ts` (schema-dts). Teacher-edited fields flow into JSON-LD, so keep the escaping — a past round fixed a stored XSS there.
- **Validation:** `lib/validation/phone.ts` restricts country codes to `["AE","IN"]`. `app/api/contact/route.ts` uses a zero-length `company` honeypot and returns a fake `ok: true` when tripped.

## Conversion notes — read before changing landing copy

(From the README — these are product-level constraints, not style preferences.)

- ⚠️ **Editing copy in code often changes nothing on the live site.** The live hero/subhead (`admin_settings`), pricing bullets (`plan_features`), and reviews (`reviews` table) are **DB-driven and override the code strings and the mocks**. Change them at `/admin/settings → Landing copy`, or accept that your edit only shows in the zero-env mock path. `scrubRetiredCopy()` in `lib/data/landing.ts` additionally strips retired phrases (e.g. "Google Meet") at render time, because the DB still stores them.
- The above-fold "Book my 1:1 session" CTA carries the bulk of conversion; it must be visible in viewport 1 on every device.
- Mobile sticky CTA is non-negotiable (75% of traffic is mobile).
- **Free-trial / "no credit card" wording has been deliberately stripped from all public copy** (keep the "1:1" framing). Do not reintroduce it. Note the standing mismatch: the **backend still grants a free first session** (`isFreeTrial` in `app/api/bookings/confirm/route.ts`, enforced by the `bookings_one_free_trial_per_customer` index). Copy and backend disagree on purpose right now — don't "fix" one side in isolation.
- Public pricing is the #1 trust signal — keep `/pricing` visible from the nav.
- Real teacher photos beat any other landing element; the placeholder SVG avatars in `MOCK_TEACHERS` are not the final state.
- **No em-dashes in user-facing copy.** They read as AI-written. Use a comma, colon, or period. (This file and other internal docs are exempt.)
