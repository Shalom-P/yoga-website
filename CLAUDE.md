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
npm start            # next start (serve a production build)

# Single file / single test
npx vitest run lib/geo/region.test.ts
npx vitest run lib/geo/region.test.ts -t "accepts the served markets"

# Drizzle (schema source of truth is supabase/migrations — see "Schema ownership")
npm run db:generate  # Generate a migration from lib/db/schema.ts diff
npm run db:migrate   # Apply pending Drizzle migrations
npm run db:studio    # Open Drizzle Studio
```

**Test convention:** Vitest 2, `environment: "node"` (`vitest.config.ts`, `@` aliased to repo root). Tests sit beside their source (`lib/geo/region.test.ts`). Coverage is deliberately limited to **pure, dependency-free helpers** — no DB, no network, no React, no mocks anywhere. There is no integration or component test harness; don't assume one exists. One exception: `lib/booking/ios-parity.test.ts` compares against output from the iOS repo's Swift slot generator and self-skips (`it.skipIf`) when that output is absent — don't "fix" the skip.

`legacy-peer-deps=true` is forced via `.npmrc` because `@sentry/nextjs` hasn't bumped its Next.js peer cap to 16 — `npm install` without it will fail. Do not remove it, and make sure your host honours `.npmrc` (or passes `--legacy-peer-deps`) at install time.

Node ≥20 is required (`package.json` engines).

`npm run lint` lints the whole tree, and `eslint.config.mjs` only ignores the Next defaults, so with a `.claude/worktrees/` checkout present it reports tens of thousands of bogus problems. Lint what you touched instead: `npx eslint <files>`.

## Big-picture architecture

This is a **conversion-first marketing site + customer dashboard + admin shell + booking backend** for a yoga studio: **customers worldwide, Indian teachers, sessions on Google Meet, Razorpay one-time session-pack payments for billing**. The cross-timezone story (customer ↔ IN teacher) is load-bearing — see the Timezones section. **There is no service-area gate**: anyone, anywhere can sign up, buy and book (`lib/geo/region.ts` has a `describe("no service-area gate")` test pinning this). Currencies: INR, AED, USD, GBP, EUR (`SUPPORTED_CURRENCIES` in `lib/geo/region.ts`). A currency is only *offered* once every active plan has a `plan_prices` row for it — `effectiveCurrency()` in `lib/razorpay/catalog.ts` downgrades to `DEFAULT_CURRENCY` (INR) otherwise, so adding a currency to the code is inert until an admin prices it in `/admin/plans`. As of migration `0036` only INR and AED are actually priced.

### Route groups in `app/`

- **`(marketing)/`** — public, no auth, renders with mock data if Supabase isn't configured (see "Mock fallback"). Pricing, teachers, classes, reviews, legal pages.
- **`(auth)/`** — `/login`, `/onboarding`, `/auth/callback`. Login uses Supabase: Google OAuth + passwordless **Email OTP** (`signInWithOtp({ email })` → `verifyOtp({ email, token, type: "email" })`). The inline 6-digit code flow needs the Supabase "Magic Link" email template to include `{{ .Token }}`, else Supabase sends a magic link instead. Phone/SMS OTP has been removed; `profiles.phone` is a contact field, never an auth factor, but it is **mandatory at onboarding** (since PR #69). It is saved in the same upsert as `experience_level`, so a customer with no phone never finished onboarding (the callback and middleware keep routing them to `/onboarding`). Legacy profiles from before PR #69 fill it in on their first `/dashboard/profile` save.
- **`(dashboard)/`** — customer area, gated by middleware.
- **`(teacher)/`** — the teacher surface at `/teacher` (schedule, documents), gated by middleware *and* `requireTeacher()`. See "Teacher accounts".
- **`admin/`** — role-gated by middleware *and* `requireAdmin()` in pages. Admin-edited landing copy lives in the `admin_settings` table (key→jsonb) and is read with `revalidate: 60`, so changes propagate ≤1 min.
- **`llms.txt/`** — plain-text site summary for assistants; cheap insurance, not a ranking lever.
- **`api/`** — route handlers for booking confirm/cancel, Meet link creation/retry (`meet/create-link`), admin session create/cancel (`admin/sessions`), admin manual credit grants (`admin/credits`), account deletion (`account/delete` self-serve, `admin/customers/[id]` admin-initiated — both share the cascade in `lib/account/deleteAccount.ts`), Razorpay order-create + payment-verify (`razorpay/create-order`, `razorpay/verify-payment`) + **webhook**, the bank-transfer rail (`payments/intent`, `admin/payments/[id]`), medical documents, contact + newsletter, on-demand ISR busting (`admin/revalidate`), and the scheduled-job handlers under `cron/*` (see "Scheduled jobs"). Also: `admin/bookings` + `admin/bookings/[id]` (roster overrides on the `0039` RPCs), `push/register` (iOS device tokens), `promo/preview`, and `region`. Middleware **does not** run on `/api/` (see `middleware.ts` matcher) — every handler must auth itself, and admin-only routes re-check `profiles.role` inline.

### Three auth-guard paths — use the right one

1. **`middleware.ts` → `lib/supabase/middleware.ts`** runs on every non-API, non-static request. Refreshes the Supabase session cookie *and* does role routing: unauth users off `/dashboard|/admin|/teacher`, non-admins off `/admin`, non-teachers off `/teacher`, teachers off `/dashboard`. Cookies set during the auth refresh have to be re-applied to redirect responses — that's what the `pendingCookies` array is doing; don't drop it if you edit the file. Matching uses the `inArea()` helper (`path === base || startsWith(base + "/")`), deliberately **not** a bare prefix — a bare prefix would make `/teacher` swallow the public `/teachers` marketing listing. It also stamps the Meta first-party cookies (`_fbp`, and `_fbc` from `fbclid`) via `setMetaCookies` so `lib/meta/capi.ts` can read them back.
2. **`lib/auth/guards.ts`** — `requireUser()` / `requireAdmin()` / `requireTeacher()` for Server Components and Server Actions. Middleware is routing, not an authorization boundary; the guard is the real gate, so call it in the page/layout too. **API route handlers must call `supabase.auth.getUser()` themselves** because middleware skips `/api/`.
3. **`lib/cron/auth.ts` → `assertCron(req)`** — for the machine-triggered `cron/*` handlers, which use no Supabase auth at all. It checks `Authorization: Bearer <CRON_SECRET>` and fails **closed**: 503 if `CRON_SECRET` is unset, 401 if it's wrong. Call it first in every cron handler.

### Three Supabase clients — pick by context

| Client | File | When to use |
|---|---|---|
| Browser | `lib/supabase/client.ts` (`createSupabaseBrowserClient`) | Client components, calls protected by RLS |
| Server (cookie-bound) | `lib/supabase/server.ts` (`createSupabaseServerClient`) | Server components, route handlers, Server Actions — runs as the logged-in user, subject to RLS |
| Service-role | `lib/supabase/service.ts` (`createSupabaseServiceClient`) | Server-only, **bypasses RLS**. Required for `sessions` and `bookings` writes (admin-only INSERT policy), Razorpay fulfilment + webhook, cron jobs. Always gate behind your own auth/role check first. |

### Drizzle alongside `supabase-js`

`lib/db/client.ts` exposes a Drizzle client (`postgres-js` over `SUPABASE_DB_URL`) used for typed complex queries (booking-conflict checks, KPI rollups). **It also bypasses RLS** — same gating rule as the service-role client. The Drizzle schema in `lib/db/schema.ts` is a *mirror* of the Supabase migrations, not the source of truth, and it drifts: it still declares `bookings_session_customer_uq`, which `0039` replaced with the partial index `bookings_one_live_per_session`.

### Schema ownership

- **Authoritative migrations live in `supabase/migrations/0001…0041`** and run via the Supabase SQL editor / `psql`. They contain RLS policies, RPCs, triggers, idempotency tables, partial unique indexes, and Storage bucket policies — none of which Drizzle generates. Highlights:
  - `0011` Razorpay credit-pack billing · `0016` booking-reminder idempotency · `0017` booking-integrity (`book_session` RPC + overlap EXCLUDE) · `0018` RLS/grants hardening · `0019` refund reconciliation
  - `0020` retires the legacy subscription plans for one-time credit packs + a `one_time` billing interval · `0021` refund-once idempotency (`refund_session_credit`) + blocklist check inside `book_session`
  - `0022` multi-currency: `plan_prices` (AED/INR) child table, `price_aud_cents`→`price_base_cents` / `amount_aud_cents`→`amount_cents` renames, currency-neutral `fixed_amount_cents` discount enum, `admin_kpis` per-currency revenue
  - `0023` + `0024_category_copy_positive` condition-based class categories · `0024_teacher_role`/`0025`/`0026`/`0028`/`0029` teacher logins (see "Teacher accounts") · `0027` private medical documents
  - `0030` bank-transfer payment rail · `0031` pack pricing (adds `pack-1`, re-prices AED) · `0032` discount redemptions · `0033` makes the `payments.razorpay_payment_id` unique index **total** rather than partial (a partial index can't serve as an `ON CONFLICT` arbiter for PostgREST's `.upsert()`, which was raising `42P10` → `payment_record_failed`, i.e. "captured but no credits")
  - `0034` `push_tokens` for iOS pushes (token regex CHECK because the token goes into the APNs `:path`; **no client INSERT/UPDATE policies** — `POST /api/push/register` on the service role is the only writer) · `0035` keeps `payments` / `discount_redemptions` rows when a customer is deleted (`customer_id` → NULL; UAE VAT / India GST retention) and must be applied before the account-delete routes ship · `0036` + `0037` widen the currency CHECKs to INR/AED/USD/GBP/EUR **without inserting prices** · `0038` `sessions.meet_status='release_pending'` (text + CHECK, **not** an enum, so the own-transaction rule doesn't apply)
  - `0039` admin overrides + manual payments, the big one: replaces the `bookings (session_id, customer_id)` unique constraint with the **partial** index `bookings_one_live_per_session … where status <> 'cancelled'` (re-enrol/move works; `0021`'s refund-once rule still holds); adds the `bookings_enforce_capacity` trigger (first real enforcement of `sessions.capacity`, raises `session_full` on every booking write); **drops** the `sessions_public_read_scheduled` and `bookings_self_insert` policies that leaked Meet links — never recreate them; adds six service-role-only `admin_*` RPCs that take an explicit `p_acting_admin` and write `audit_log`; adds `payments.entry_source` + `method='manual'` (`admin_note` is customer-visible); adds `meet_orphan_events` (RLS on, no policies). `refund_session_credit` is deliberately untouched because the Deno `cancel-booking` function calls it.
  - `0040` `teachers.contact_email` (calendar invites only, never a login identity) with one-off data fixes · `0041` `teachers.is_public` — hidden teachers are schedulable by admins but must never appear on public pages, the sitemap or the booking picker (partial index `teachers_public_listing_idx`)
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

A "teacher" is two separable things: a **record** in `public.teachers` (since `0002`, no auth identity) and an **optional linked login**. `POST /api/admin/teachers/[id]/invite` is the single creation path — it finds an existing profile by email or calls `auth.admin.inviteUserByEmail(..., redirectTo: /auth/callback?next=/teacher)`, then **always** elevates via the `promote_to_teacher(target_user_id, target_teacher_id, acting_admin_id)` RPC. That RPC is the only elevation route: it self-gates on `is_admin(...)`, links `teachers.profile_id` atomically (refusing to steal an already-linked record), sets `profiles.role='teacher'`, and writes `audit_log`. `demote_from_teacher()` reverses it (cannot self-demote); the admin panel calls it straight from the browser with `supabase.rpc(...)` in `components/admin/TeacherEditPanel.tsx`, relying on the RPC's own `is_admin` gate, so there is deliberately no API route for it.

Things that break silently if you touch them:
- `0024_teacher_role` must be applied **in its own transaction** before `0025` — Postgres forbids using a new enum label in the transaction that adds it.
- The `auth.uid() IS NULL ⇒ privileged` carve-outs in `tg_teachers_lock_admin_cols` (`0026`) and `tg_profiles_lock_sensitive` (`0029`) are load-bearing. Without them the service-role promote path silently reverts `profile_id`/`role` and you get half-promoted teachers. The `0013` INSERT hardening (force `role='customer'`) stays intact so elevation only ever happens via UPDATE through the RPCs.
- `teachers_profile_id_uniq` (`0028`, partial unique on non-null `profile_id`) makes the DB the source of truth for one-profile-one-teacher; the app's check-then-act guards are racy without it, and every `.eq("profile_id", …).single()` breaks on a double link.
- `0028`'s `teachers_revoke_shares_on_unlink` trigger revokes `medical_document_shares` whenever `profile_id` moves away from a person. Removing it is a PHI leak.
- Identity helpers (`is_teacher`, `owns_teacher`, `teacher_owns_booking`) are `SECURITY DEFINER` to avoid RLS recursion — keep them that way.

`lib/teacher/sessions.ts` uses the **service-role** client on purpose: `0025` grants a teacher RLS read on their own `sessions`/`bookings`, but `profiles` stays self/admin-only, so a teacher's own token cannot read the *student's* name/timezone that the schedule UI needs. It's gated by `requireTeacher()` plus an explicit `.eq("teacher_id", teacherId)`, and deliberately does not select student emails. Teachers are read-only on sessions/bookings; creation, cancellation, and attendance stay admin/service-role.

### Two payment rails — Razorpay and manual bank transfer

Since `0030` there are **two** rails, and the choice is made **server-side only**. `POST /api/payments/intent` is the single entry point the buy-a-pack UI calls: it authenticates, resolves currency via `resolveRegion()`, and returns `{ method: "razorpay" }` with **no side effects** for non-AED (India continues on the untouched create-order → verify flow). AED creates or reuses a `pending` `payments` row with `method='bank_transfer'` and a random `MYC-XXXXXX` reference. This is a temporary rail until Razorpay International/AED is enabled on the account.

Bank-transfer states: `pending` → `completed` (admin verify) or `failed` (admin reject); `refunded`/`failed` are terminal. Approval is admin-only via `POST /api/admin/payments/[id]` (`action: verify|reject`), which re-checks `profiles.role` inline. It grants credits through the **same** `grant_session_credits(...)` RPC the Razorpay rail uses — it mirrors `lib/razorpay/fulfillment.ts` rather than introducing a parallel grant path. `POST /api/admin/credits` is a separate add-only manual grant (`reason='admin_adjust'`, `p_payment_id: null`, 1–100 credits). Since `0039` an admin can also record an offline receipt as a `payments` row with `method='manual'` and `entry_source` `admin_manual` / `admin_manual_reconciled`; `payments_manual_ids_check` requires a `razorpay_payment_id` exactly when `method='razorpay'`.

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
- `lib/timezone/index.ts` is the only place that formats: `formatCustomerTime` (default `DEFAULT_CUSTOMER_TZ` = `Asia/Kolkata`), `formatTeacherTime` (always `Asia/Kolkata`, suffixed "IST"), and `formatInTz` for any zone and pattern. Use these instead of `date-fns` `format` directly so DST is handled. Don't call date-fns-tz's `formatInTimeZone` directly either: it rebuilds the wall time with the runtime's local setters, so a time inside a DST browser's own spring-forward hour prints an hour late (and fails hydration against the UTC server). `formatInTz` reads the fields through `TZDate` from `@date-fns/tz` instead; `lib/timezone/formatInTz.test.ts` pins it. Customers store their real device-detected IANA zone (global picker in `components/ui/timezone-select.tsx`).
- Booking-availability checks compare strings — see `slotInsideAvailability` in `supabase/functions/_shared/availability.ts`, re-exported by `lib/booking/availability.ts` so the site and the `book-session` Edge Function share one copy. Postgres `day_of_week` is 0=Sun..6=Sat, date-fns `i` is 1=Mon..7=Sun — the helper normalises. Slots crossing midnight in the teacher TZ are currently rejected.
- For a zone's UTC offset use `tzOffsetLabel` ("GMT+5:30") or `tzDiffLabel` ("+1:30", the slot picker's teacher chip). Both read `tzOffset` from `@date-fns/tz` at the instant. Never use date-fns-tz's `getTimezoneOffset`: it reads the Date as a wall time in the zone, so around that zone's DST switch it returns the other side's offset (New York at 06:30Z on 8 Mar 2026 read GMT-4, truth GMT-5), and which side it picks varies with the runtime's zone. `lib/timezone/offset.test.ts` pins both sides of each 2026 switch in six runtime zones.

### Bookings + Meet flow

`POST /api/bookings/confirm` does, in order: auth, payload validation (zod), 15-min-future check, teacher lookup (active **and** `is_public`, never the customer's own teacher record), **availability window check in teacher TZ**, then a single `book_session` RPC call that creates the session (`meet_status='pending'`), the booking and the credit-ledger entry in one transaction. The DB enforces the rest: the `0017` overlap EXCLUDE, the `0021` blocklist and, since `0039`, `sessions.capacity` (`session_full`). PG error `23505` here is the `bookings_one_free_trial_per_customer` partial unique index — translate to `trial_already_claimed`, not a generic 500. When `BOOKING_EDGE_FUNCTION_URL` is set (unset by default) the route instead forwards the booking to the `book-session` Edge Function with the caller's token and only does the Meet link, email and analytics itself.

After the booking commits, the handler calls `provisionSessionMeet` (`lib/google/provisionMeet.ts`), the single idempotent entry point every write path uses (confirm, admin session create, `meet-retry`, on-demand `meet/create-link`); it resolves the teacher's calendar (`teachers.google_calendar_id`, else `GOOGLE_SYSTEM_CALENDAR_ID`), records it on `sessions.meet_calendar_id` and wraps `createMeetEvent` in `lib/google/calendar.ts`. `releaseSessionMeet` in the same file deletes the event on cancellation. Auth is **keyless** — `getAccessToken()` runs Vercel OIDC → GCP Workload Identity Federation (STS) → IAM Credentials `signJwt` (with `sub` = a Workspace mailbox, i.e. domain-wide delegation) → jwt-bearer, so there is **no `GOOGLE_SERVICE_ACCOUNT_JSON`** (the org blocks downloadable SA keys). It needs `GOOGLE_WORKLOAD_IDENTITY_PROVIDER` / `GOOGLE_IMPERSONATE_SERVICE_ACCOUNT` / `GOOGLE_IMPERSONATE_SUBJECT` env vars, Vercel OIDC enabled, and `@vercel/oidc` — which is **Node-runtime only**, so any route reaching this file must stay on the Node runtime (no Edge). Locally it needs `vercel env pull` + `vercel dev` (plain `next dev` has no OIDC token and fails loud). On failure it leaves the booking in place and sets `meet_status='failed'` so a cron sweeper can retry — **do not roll back the booking on Meet failure**. The dashboard shows "Link available shortly" for `pending` / `failed`. Full setup runbook in the README ("Google Meet (keyless)").

### Razorpay one-time payments (session-pack credits)

Billing is **Razorpay one-time Checkout, multi-currency (UAE→AED, India→INR)**. A plan = a pack: per-currency prices (`plan_prices`, fallback `plans.price_base_cents`) + N `session_credits`. Buying a pack grants credits; booking a *paid* session spends one (the free 1:1 trial never touches credits). No subscriptions, no "sync" step — order amounts are set at create time.

Flow: `POST /api/razorpay/create-order` resolves the customer's currency from `resolveRegion()` (GeoIP country first, browser timezone fallback — see `lib/geo/region.ts`), then resolves the price server-side from `plan_prices` by `planSlug` + currency (the client never sends an amount) and stamps the order `notes` with `{customerId, planId, currency}`. The browser opens Checkout, then **either** path fulfils:
1. `POST /api/razorpay/verify-payment` — constant-time HMAC-SHA256 signature check, then `fulfillRazorpayPayment`.
2. `POST /api/razorpay/webhook` — `X-Razorpay-Signature`-verified (uses `RAZORPAY_WEBHOOK_SECRET`); the authoritative path for when the browser never returns.

**`lib/razorpay/fulfillment.ts` is the single fulfilment point and is idempotent**: it re-checks capture against the Razorpay API, upserts `payments` keyed on a UNIQUE `razorpay_payment_id`, then grants credits via the `grant_session_credits` RPC (purchase-once via a partial unique index on `credit_ledger`). **Never grant value from the client `onPaid` callback** — call fulfilment server-side. Booking spends a credit atomically via `spend_session_credit` (refunded if the insert fails). `lib/razorpay/client.ts` is the server-only SDK singleton: `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` server-side, `NEXT_PUBLIC_RAZORPAY_KEY_ID` for Checkout. INR settles natively on an Indian account; **AED orders need Razorpay International enabled** on the account.

### Scheduled jobs (handlers exist; scheduler is BYO)

Five cron handlers live under `app/api/cron/`, each gated by `assertCron` (Bearer `CRON_SECRET` — see auth paths above), accepting `GET` as well as `POST` (Vercel Cron issues GET) and running on the service-role client:
- **`reminders`** (every 15 min — the ±10-min bands only cover every session at that cadence) — emails a ±10-min band around now+24h and now+1h, then sends best-effort APNs pushes to the customer's registered devices (`lib/push/notify.ts`, tokens from `0034`). Idempotent since `0016` (`reminded_at_24h`/`reminded_at_1h` columns on `bookings` are claimed via conditional UPDATE before sending; there is no separate ledger table).
- **`no-show-sweep`** (~hourly) — flips still-`confirmed` bookings to `no_show` 2h after the session ended (`booking_status` enum from `0003`). Skips sessions whose Meet link never provisioned (`meet_status <> 'created'`) so a customer isn't penalised for an operational failure.
- **`meet-retry`** (every 15 min) — three passes, batched (50/run) to avoid Calendar rate limits. First the `meet_orphan_events` sweep (`0039`: events parked by admin reschedules), which **must** run before the forward pass. Forward: re-runs `provisionSessionMeet` for not-yet-started sessions stuck at `meet_status='pending'|'failed'`. Reverse: deletes the event for sessions at `meet_status='release_pending'` and clears the row to `NULL` (**not** `'failed'`, which the forward pass would immediately re-provision). That mark is written by the `cancel-booking` and `delete-account` Edge Functions, which the native iOS app calls and which cannot delete the event themselves — Vercel OIDC is not mintable from Deno. Migration `0038`.
- **`medical-orphan-sweep`** (~daily) — backstop cleanup for the private `medical-documents` bucket: removes stored objects >1h old with no live `medical_documents` row (failed metadata POST, or bytes left after a failed soft-delete removal). Bounded per run; reports `truncated` flags instead of silently capping.
- **`discount-reservation-sweep`** (~hourly) — `release_stale_discount_reservations(2h, 500)`. Required because an abandoned Checkout otherwise holds a `max_uses`/`per_email_max` slot forever, most painfully blocking the buyer's own retry. It sweeps **only `payment_id IS NULL`** rows: a bank-transfer reservation is tied to a real pending wire that may legitimately sit for days.

There is **no scheduler in the repo**: `vercel.json` exists but only disables Git deploys (no `crons` array), and `0015_cron_schedule.sql` schedules just three of the five (reminders, meet-retry, no-show-sweep). Production runs the jobs from Supabase `pg_cron` + `pg_net`; wire any new job there (or in any external scheduler) with `Authorization: Bearer $CRON_SECRET`, and remember `pg_net`'s default 5 s timeout hides the handler's response.

### Supabase Edge Functions (`supabase/functions/`, for the native iOS app)

Deno functions the iOS app calls directly: its Bearer token cannot use the cookie-authenticated `/api/*` routes, and Deno cannot import the repo's `server-only` modules. Shared pattern: identity from the caller's verified token (`auth.getUser()`), the work on a service-role client, CORS origin from `BOOKING_ALLOWED_ORIGIN`. `tsconfig.json` excludes the function folders; there is no `supabase/config.toml`.
- **`book-session`** — re-checks the teacher (active + `is_public`), availability, blocked dates and the 15-min rule, then calls `book_session` (the only caller of that RPC outside Node). It creates **no** Meet link (leaves `meet_status='pending'` for `meet-retry`) and sends **no** email. The website's confirm route can proxy to it (see Bookings).
- **`cancel-booking`** — the iOS twin of `/api/bookings/cancel`, same four rules: owner or 404, must be `confirmed`, update guarded by `.eq('status','confirmed')`, credit refunded via `refund_session_credit` unless free trial or `comped`. It cannot delete the Calendar event, so it marks the session `release_pending`.
- **`delete-account`** — a **hand-kept second copy of `lib/account/deleteAccount.ts`** (App Store rule 5.1.1(v)); `/api/account/delete` and `DELETE /api/admin/customers/[id]` still use the TypeScript one, so the cascade exists twice. **Change one, change the other** — it is financial (VAT/GST retention, `0035`) and PHI (Storage purge after `deleteUser`) code, and both headers say so in capitals. The one deliberate divergence: TypeScript deletes the Meet event immediately via `releaseSessionMeet`; the Edge Function marks `release_pending`.
- **`document-url`** — 60 s signed URL for one medical document (owner, or a teacher with a live share; admins excluded; 404 not 403; audit row before the URL is returned). It mirrors `/api/medical-documents/[id]/download` with no shared code and no "keep in step" banner.
- **`_shared/availability.ts`** is the single copy of the availability rules; `lib/booking/availability.ts` re-exports it.

### Native iOS app (Capacitor shell, separate repository)

The iOS app is a Capacitor WKWebView that loads the hosted site; the Xcode project lives in its own repo. The web side keeps the bridges, all no-ops on the plain web so they are safe to call unconditionally: `lib/native/capacitor.ts` (`isNativeApp`, `nativeOAuthSignIn` for deep-link OAuth, `openExternal`, `capturePhotoAsFile`, `setupNativeApp`), `lib/native/push.ts` → `POST /api/push/register` (APNs tokens in `push_tokens`, capped at 10 per user) with `lib/push/{apns,notify}.ts` for sending, `useIsNative` for UI, and Sign in with Apple in `LoginForm`. The Meta and Google tags stay off inside the app (`NATIVE_APP_UA_TOKEN`); booking cancel and account deletion go through the Edge Functions above.

### Deploying (manual)

`vercel.json` sets `git.deploymentEnabled: false`, so **merging to `main` does not deploy**. A release is `npx vercel@latest --prod` run from a **clean checkout of `origin/main`** (a detached worktree works): the CLI uploads the working folder as-is, so a dirty checkout would ship uncommitted edits. `NEXT_PUBLIC_*` variables are baked in at build time, so add them in Vercel before deploying. Verify by fetching the live site for a string the release introduced rather than trusting the CLI exit code.

## Conventions worth knowing before editing

- **Path alias:** `@/*` → repo root (see `tsconfig.json`). Use `@/lib/...`, `@/components/...`.
- **UI:** shadcn/ui with the `base-nova` preset (`components.json`). Tailwind 4 via `@tailwindcss/postcss`. Add components with `npx shadcn@latest add <name>` — they land in `components/ui/`.
- **Fonts:** self-hosted with `next/font/local` in `app/fonts/` (sources and update steps in its README). Don't bring back `next/font/google`: it downloads from Google Fonts during `next build`, and vercel/next.js#99114 makes that fail at random. Each family is a preloaded latin loader plus a latin-ext companion with its own `unicode-range` (the ₹ lives there); `globals.css` joins each pair into the `--font-*` variable the stylesheets use.
- **Forms:** `react-hook-form` + `zod` + `@hookform/resolvers`. Mirror the zod schema on both client and the route handler.
- **Animation:** Motion (the rebrand of Framer Motion) + Lenis smooth scroll (provider in `app/layout.tsx`) + GSAP ScrollTrigger when timeline scrubbing is needed.
- **Locale:** `en` (per-currency `en-IN` / `en-AE` for money). Money helper is `formatMoney(cents, currency)` in `lib/i18n/money.ts`. Internal money is integer minor units (`plans.price_base_cents`, `plan_prices.amount_cents`, `payments.amount_cents`); never store floats. `SUPPORTED_CURRENCIES` is INR/AED/USD/GBP/EUR, but only INR and AED are priced (see the architecture note).
- **Analytics:** `lib/analytics/events.ts` — call `track(name, props)` with a name from the typed `EventName` allow-list (extend the union, don't pass free-form strings). `track()` / `initPosthog()` are silent no-ops when `NEXT_PUBLIC_POSTHOG_KEY` is unset, matching the zero-env preview story.
- **Ad tracking:** Meta is server-side only (`lib/meta/capi.ts`, no Pixel). Google Ads needs its tag in the browser: `components/shared/GoogleTag.tsx` → `lib/analytics/googleAds.ts` (no-op without `NEXT_PUBLIC_GOOGLE_ADS_ID`). gtag.js loads only on `CHECKOUT_PAGES` (`/`, `/pricing`, `/dashboard/plan`) or on a landing that carries a Google click id (`gclid`/`gbraid`/`wbraid`), never in `/admin`, `/teacher` or `/dashboard/documents`, and not for the iOS app or Global Privacy Control. **That allow-list is the privacy boundary**: gtag reports the real path and title (`top`, `tiba`) even when `page_location` is overridden, so condition and teacher pages are protected only by the tag not running there. Once loaded it sends nothing on client-side navigation. A new place that completes a purchase (or fires a new conversion) must be added to `CHECKOUT_PAGES`. The Purchase conversion fires from `components/shared/razorpay-checkout.ts` after `verify-payment` confirms; webhook-only and bank-transfer purchases never reach Google. `Referrer-Policy: strict-origin` in `next.config.ts` exists for this tag (it keeps `/classes/<condition>` out of `document.referrer`), so don't loosen it. A second conversion, the customer's first 1:1 booking, is sent by `components/dashboard/BookedConversion.tsx` from `/dashboard/plan?booked=1`, the page `TeacherSlotPicker` redirects the free 1:1 to (a paid booking goes to `/dashboard/bookings` and is not a conversion). It carries only the booking id as `transaction_id`; label in `NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL`. The privacy page spells out what each conversion sends, so change them together.
- **Email:** `lib/email/client.ts` is a thin server-only Resend wrapper (templates in `lib/email/templates.tsx`); without `RESEND_API_KEY` it logs and returns `{ ok: true, skipped: true }`, so flows never fail in dev. Supabase auth email is separate (custom SMTP set in the Supabase dashboard).
- **`cn` helper:** lives in `lib/utils.ts`; `lib/utils/cn.ts` just re-exports it. shadcn's `components.json` aliases `utils → @/lib/utils`, so import `cn` from `@/lib/utils`.
- **`server-only` import:** `lib/db/client.ts`, `lib/google/calendar.ts`, and `lib/razorpay/{client,fulfillment,catalog}.ts` use the `server-only` package — importing them from a client component will hard-fail the build. Keep that boundary. `lib/payments/bankTransfer.ts` and `lib/geo/region.ts` are the deliberate exceptions: both are imported client-side and must stay pure.
- **Error copy:** `lib/ui/errors.ts` (`friendlyAuthError` / `friendlyFormError`) is a mandated boundary. Raw Supabase/Postgres strings (RLS policy text, unique-constraint messages) must never reach a toast.
- **Currency resolution:** `lib/geo/region.ts` decides which currency a customer is billed in, not whether they may buy — the service-area gate was removed, and customers are welcome from any country. It prefers unforgeable edge GeoIP country over the self-reported browser timezone; **keep that precedence**, since the timezone is client-supplied and decides what someone is *charged*. `resolveRegion()` returns the currency we'd *like*; anything that shows or takes money must pass it through **`effectiveCurrency()`** (`lib/razorpay/catalog.ts`) so an unpriced currency downgrades instead of blocking a sale. `GET /api/region` is the client's way to ask the same question, so the pricing grid and checkout can't disagree.
- **`plans.price_base_cents` is INR.** It is only ever a fallback for INR. Using it for another currency charges the rupee integer under that symbol (99900 paise → USD 999.00); `catalog.ts` withholds an unpriced pack instead. Don't reintroduce a cross-currency fallback.
- **CSP:** `next.config.ts` ships a hand-maintained Content-Security-Policy allow-listing Razorpay, Supabase (REST + wss), PostHog, Sentry ingest, Google OAuth, and the Google Ads tag (whose hosts go beyond Google's own CSP guide; check the browser console after touching them). **Any new third-party origin must be added there or it silently breaks in production only.** `'unsafe-eval'` is dev-only; `'unsafe-inline'` for scripts is intentional (nonces would force every page dynamic).
- **Sentry:** wired via `instrumentation.ts` (server/edge + `onRequestError` for RSC errors) and `instrumentation-client.ts`. Both no-op without `NEXT_PUBLIC_SENTRY_DSN`. `withSentryConfig` / source-map upload is deliberately not set up yet.
- **SEO:** typed JSON-LD builders in `lib/seo/structuredData.ts` (schema-dts). Teacher-edited fields flow into JSON-LD, so keep the escaping — a past round fixed a stored XSS there. `app/sitemap.ts`, `app/robots.ts` and every public teacher query must respect `teachers.is_public` (`0041`; `lib/data/landing.ts` filters `.eq("is_public", true)`). `lib/seo/indexnow.ts` pushes URL changes to the Bing-backed indexes from `/api/admin/revalidate`; its key is public by design and must match `public/<key>.txt`.
- **Validation:** `lib/validation/phone.ts` accepts every country. The onboarding and profile pages pre-select the visitor's GeoIP country in `<PhoneField>` via `toPhoneCountry(countryFromHeaders(await headers()))`; keep that. With no country selected, react-phone-number-input puts a `+` in front of whatever is typed, so a 10-digit Indian mobile ("98765 43210") is read as +98 (Iran), +81 (Japan) and so on, and rejected. `app/api/contact/route.ts` uses a zero-length `company` honeypot and returns a fake `ok: true` when tripped.

## Conversion notes — read before changing landing copy

(From the README — these are product-level constraints, not style preferences.)

- ⚠️ **Editing copy in code often changes nothing on the live site.** The live hero/subhead (`admin_settings`), pricing bullets (`plan_features`), and reviews (`reviews` table) are **DB-driven and override the code strings and the mocks**. Change them at `/admin/settings → Landing copy`, or accept that your edit only shows in the zero-env mock path. `scrubRetiredCopy()` in `lib/data/landing.ts` additionally strips retired phrases (e.g. "Google Meet") at render time, because the DB still stores them.
- The above-fold "Book my 1:1 session" CTA carries the bulk of conversion; it must be visible in viewport 1 on every device.
- Mobile sticky CTA is non-negotiable (75% of traffic is mobile).
- **Free-trial / "no credit card" wording has been deliberately stripped from all public copy** (keep the "1:1" framing). Do not reintroduce it. Note the standing mismatch: the **backend still grants a free first session** (`isFreeTrial` in `app/api/bookings/confirm/route.ts`, enforced by the `bookings_one_free_trial_per_customer` index). Copy and backend disagree on purpose right now — don't "fix" one side in isolation.
- Public pricing is the #1 trust signal — keep `/pricing` visible from the nav.
- Real teacher photos beat any other landing element; the placeholder SVG avatars in `MOCK_TEACHERS` are not the final state.
- **Never call the balance "credits" in customer-facing copy.** We sell prepaid 1:1 sessions with a human teacher (App Store 3.1.3(d)); a balance called *credits* reads as in-app currency (3.1.1) to a reviewer. `lib/copy/sessions.ts` owns the wording and `lib/data/landing.ts` scrubs DB-stored copy at render time. Admin-facing UI may still say credits.
- **No em-dashes in user-facing copy.** They read as AI-written. Use a comma, colon, or period. (This file and other internal docs are exempt.)
- **No emojis anywhere on the site**: copy, toasts, emails, and admin-edited DB content alike. If a line needs a visual cue, use a lucide icon. Typographic glyphs such as the ★ rating stars and © are not emoji and are fine.

## Other files worth knowing

- Root docs: `TESTING-CHECKLIST.md`, `LAUNCH-PUNCHLIST.md`, `verify-launch.sql` (live-DB launch checks), `SEO-AUDIT.md`, `ISSUES.md`.
- `landing-pages/*.html` — nine standalone condition landing pages; not wired into the app.
- `scripts/` — `nav-test.mjs` (disposable-user navigation E2E: create/cookies/onboard/cleanup), `indexnow-submit.ts` (one-shot sitemap submission), `generate-favicons.mjs`, `smoke-0039.sql`. `server-only` is a Next bundler alias, not a package, so a standalone `tsx` script that imports those `lib/` modules needs a stub for it.
- `.claude/launch.json` — preview servers for the in-app browser: `yoga-verify` (`npm run dev`, port 3100) and `yoga-prod` (`next start`, port 3200).
- `README.md` predates several pivots: it still says Australian customers, "free 1:1" / "no credit card" copy, migrations `0001…0006` and a `session-recordings` bucket. Its Google Meet (keyless) runbook and the Supabase custom-SMTP notes are still right; where it disagrees with this file, this file wins.
