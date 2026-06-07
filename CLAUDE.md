# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next dev server on :3000
npm run build        # Production build
npm run lint         # eslint . — flat config in eslint.config.mjs (was `next lint`; swapped for Next 16)
npm run typecheck    # tsc --noEmit — strict mode is on

# Drizzle (schema source of truth is supabase/migrations — see "Schema ownership")
npm run db:generate  # Generate a migration from lib/db/schema.ts diff
npm run db:migrate   # Apply pending Drizzle migrations
npm run db:studio    # Open Drizzle Studio
```

No test runner is wired up yet. There is no single-test command.

`legacy-peer-deps=true` is forced via `.npmrc` because `@sentry/nextjs` hasn't bumped its Next.js peer cap to 16 — `npm install` without it will fail. Do not remove it, and make sure your host honours `.npmrc` (or passes `--legacy-peer-deps`) at install time.

Node ≥20 is required (`package.json` engines).

## Big-picture architecture

This is a **conversion-first marketing site + customer dashboard + admin shell + booking backend** for a yoga studio: **Australian customers, Indian teachers, sessions on Google Meet, PayPal Subscriptions for billing**. The cross-timezone story (AU ↔ IN) is load-bearing — see the Timezones section.

### Route groups in `app/`

- **`(marketing)/`** — public, no auth, renders with mock data if Supabase isn't configured (see "Mock fallback"). Pricing, teachers, classes, reviews, legal pages.
- **`(auth)/`** — `/login`, `/onboarding`, `/auth/callback`. Login uses Supabase: Google OAuth + Phone OTP via Twilio Verify (the same flow handles `+61` AU customers and `+91` IN teachers).
- **`(dashboard)/`** — customer area, gated by middleware.
- **`admin/`** — role-gated by middleware *and* `requireAdmin()` in pages. Admin-edited landing copy lives in the `admin_settings` table (key→jsonb) and is read with `revalidate: 60`, so changes propagate ≤1 min.
- **`api/`** — route handlers for booking confirm/cancel, Meet link creation/retry (`meet/create-link`), admin session create/cancel (`admin/sessions`), PayPal subscription create/confirm/cancel + plan-catalog sync (`paypal/sync-plan`) + **webhook**, newsletter signup, on-demand ISR busting (`admin/revalidate`), and the scheduled-job handlers under `cron/*` (see "Scheduled jobs"). Middleware **does not** run on `/api/` (see `middleware.ts` matcher) — every handler must auth itself, and admin-only routes re-check `profiles.role` inline.

### Three auth-guard paths — use the right one

1. **`middleware.ts` → `lib/supabase/middleware.ts`** runs on every non-API, non-static request. Refreshes the Supabase session cookie *and* redirects unauth users away from `/dashboard|/admin`, and non-admins away from `/admin`. Cookies set during the auth refresh have to be re-applied to redirect responses — that's what the `pendingCookies` array is doing; don't drop it if you edit the file.
2. **`lib/auth/guards.ts`** — `requireUser()` / `requireAdmin()` for Server Components and Server Actions. **API route handlers must call `supabase.auth.getUser()` themselves** because middleware skips `/api/`.
3. **`lib/cron/auth.ts` → `assertCron(req)`** — for the machine-triggered `cron/*` handlers, which use no Supabase auth at all. It checks `Authorization: Bearer <CRON_SECRET>` and fails **closed**: 503 if `CRON_SECRET` is unset, 401 if it's wrong. Call it first in every cron handler.

### Three Supabase clients — pick by context

| Client | File | When to use |
|---|---|---|
| Browser | `lib/supabase/client.ts` (`createSupabaseBrowserClient`) | Client components, calls protected by RLS |
| Server (cookie-bound) | `lib/supabase/server.ts` (`createSupabaseServerClient`) | Server components, route handlers, Server Actions — runs as the logged-in user, subject to RLS |
| Service-role | `lib/supabase/service.ts` (`createSupabaseServiceClient`) | Server-only, **bypasses RLS**. Required for `sessions` and `bookings` writes (admin-only INSERT policy), PayPal webhook handling, cron jobs. Always gate behind your own auth/role check first. |

### Drizzle alongside `supabase-js`

`lib/db/client.ts` exposes a Drizzle client (`postgres-js` over `SUPABASE_DB_URL`) used for typed complex queries (booking-conflict checks, KPI rollups). **It also bypasses RLS** — same gating rule as the service-role client. The Drizzle schema in `lib/db/schema.ts` is a *mirror* of the Supabase migrations, not the source of truth.

### Schema ownership

- **Authoritative migrations live in `supabase/migrations/0001…0010`** and run via the Supabase SQL editor / `psql`. They contain RLS policies, RPCs, triggers, idempotency tables, partial unique indexes, and Storage bucket policies — none of which Drizzle generates. (Newest: `0009` raises per-bucket upload size limits; `0010` adds the `demote_from_admin` RPC.)
- `drizzle.config.ts` points `out` at `supabase/migrations`, but `db:generate` is for *introspection and ad-hoc work*. When you change schema, write the SQL by hand to keep RLS / RPCs intact and bump the migration number. `0007_security_fixes.sql` is the canonical example of how add-on migrations are structured.
- **Writing the migration file is not enough — apply it to the live DB** (`psql`/SQL editor). Features break until their object exists: e.g. the `/admin/customers` Demote button 500s until `0010`'s RPC is applied.

### Storage buckets

Migration `0008` provisions two **public-read, admin-write** Storage buckets: `promotional-media` (hero videos, banners, testimonial photos, class thumbnails — the `/admin/media` tab) and `teacher-media` (per-teacher avatars, covers, intro videos — `TeacherFormDialog`). Writes are gated by the same `public.is_admin(auth.uid())` helper that guards app tables. If an admin upload fails with *"new row violates row-level security policy"*, the bucket policy is the cause — re-apply `0008`, don't make the bucket world-writable.

Marketing pages render these images via `next/image`, so the bucket host (`**.supabase.co/storage/v1/object/public/**`) is allow-listed in `next.config.ts` → `images.remotePatterns`; add any new image host there or optimization throws. Teacher edits are a client-side Supabase write (which can only `router.refresh()` the admin route), so after a save the admin client calls `POST /api/admin/revalidate` to bust the ISR cache on `/`, `/teachers`, `/teachers/[slug]` (the teacher listing/detail pages set `revalidate = 300`).

### Mock fallback for the marketing site

`lib/data/landing.ts` checks `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` and returns hand-written mock data (`MOCK_TEACHERS`, `MOCK_PLANS`, etc.) when Supabase isn't wired up. The marketing pages render cleanly with zero env vars, which is the desired preview/dev story. Keep this pattern when adding new public data — fall back to a sensible mock, don't crash. The mocks roughly mirror `supabase/seed.sql`.

### Timezones — critical, easy to get wrong

- All DB timestamps are `timestamptz` (UTC). Never store wall-clock times.
- `lib/timezone/index.ts` is the only place that formats: `formatCustomerTime` (default `Australia/Sydney`), `formatTeacherTime` (always `Asia/Kolkata`, suffixed "IST"). Use these instead of `date-fns` `format` directly so DST is handled.
- Booking-availability checks compare strings — see `slotInsideAvailability` in `app/api/bookings/confirm/route.ts`. Postgres `day_of_week` is 0=Sun..6=Sat, date-fns `i` is 1=Mon..7=Sun — the helper normalises. Slots crossing midnight in the teacher TZ are currently rejected.

### Bookings + Meet flow

`POST /api/bookings/confirm` does, in order: auth, payload validation (zod), 15-min-future check, teacher lookup, **availability window check in teacher TZ**, **overlap check** against existing non-cancelled sessions, INSERT session with `meet_status='pending'`, INSERT booking. If the booking insert fails with PG error `23505` (duplicate), it's the `bookings_one_free_trial_per_customer` partial unique index firing — translate to `trial_already_claimed`, not a generic 500.

After the booking commits, the handler calls `createMeetEvent` (`lib/google/calendar.ts`, service-account JWT against the Calendar API). On failure it leaves the booking in place and sets `meet_status='failed'` so a cron sweeper can retry — **do not roll back the booking on Meet failure**. The dashboard shows "Link available shortly" for `pending` / `failed`.

### PayPal subscriptions + webhook

`/api/paypal/webhook` is **the single point of truth** for subscription state. It:
1. Verifies the signature via `lib/paypal/verify-webhook.ts` (uses `PAYPAL_WEBHOOK_ID`).
2. Inserts into `paypal_webhook_events` keyed by `event_id` — replays return early.
3. Handles `BILLING.SUBSCRIPTION.ACTIVATED|CANCELLED|EXPIRED|SUSPENDED` and `PAYMENT.SALE|CAPTURE.COMPLETED`.
4. Calls `apply_discount_to_subscription` RPC — service-role-only, idempotent via `subscriptions.discount_applied_at`.

Two subtle invariants in the webhook: an out-of-order `ACTIVATED` after `CANCELLED` must **not** reactivate (the `status !== 'cancelled'` guard), and only a real `CANCELLED` event sets `cancelled_at` (`SUSPENDED` is recoverable, `EXPIRED` is end-of-term).

**REST calls + plan setup.** `lib/paypal/client.ts` (`getPayPalToken`, `paypalFetch`) is a thin server-only REST wrapper with OAuth-token caching; `PAYPAL_ENV=live` flips the base URL from sandbox to production. A plan isn't subscribable until an admin clicks **Sync to PayPal** in `/admin/plans` → `POST /api/paypal/sync-plan`, which creates the PayPal catalog product + billing plan and stores `paypal_plan_id` on the row; `create-subscription` then references that id.

### Scheduled jobs (handlers exist; scheduler is BYO)

Four cron handlers live under `app/api/cron/`, each gated by `assertCron` (Bearer `CRON_SECRET` — see auth paths above) and running on the service-role client:
- **`reminders`** (~hourly) — emails a ±10-min band around now+24h and now+1h. **Not yet DB-idempotent** (no `reminded_at` column): a double-fire in the same band sends duplicate reminders. Read the TODO at the top of the file before relying on it.
- **`no-show-sweep`** (~hourly) — flips still-`confirmed` bookings to `no_show` 2h after the session ended (`booking_status` enum from `0003`).
- **`paypal-reconcile`** (~daily) — diffs local `subscriptions` against the PayPal API and reconciles, honouring the same out-of-order guard as the webhook (never reactivate a locally-cancelled sub).
- **`meet-retry`** (~15–30 min) — retries `createMeetEvent` for not-yet-started sessions stuck at `meet_status='pending'|'failed'`, batched (50/run) to avoid Calendar rate limits.

There is **no scheduler in the repo** (no `vercel.json` / host config). Wire each endpoint to your host's cron, an external scheduler, or Supabase `pg_cron` + `pg_net`, POSTing with `Authorization: Bearer $CRON_SECRET`.

## Conventions worth knowing before editing

- **Path alias:** `@/*` → repo root (see `tsconfig.json`). Use `@/lib/...`, `@/components/...`.
- **UI:** shadcn/ui with the `base-nova` preset (`components.json`). Tailwind 4 via `@tailwindcss/postcss`. Add components with `npx shadcn@latest add <name>` — they land in `components/ui/`.
- **Forms:** `react-hook-form` + `zod` + `@hookform/resolvers`. Mirror the zod schema on both client and the route handler.
- **Animation:** Motion (the rebrand of Framer Motion) + Lenis smooth scroll (provider in `app/layout.tsx`) + GSAP ScrollTrigger when timeline scrubbing is needed.
- **Locale:** `en-AU`. Money helpers in `lib/i18n/money.ts`. Internal money is `*_aud_cents` (integer); never store floats. Default currency code "AUD".
- **Analytics:** `lib/analytics/events.ts` — call `track(name, props)` with a name from the typed `EventName` allow-list (extend the union, don't pass free-form strings). `track()` / `initPosthog()` are silent no-ops when `NEXT_PUBLIC_POSTHOG_KEY` is unset, matching the zero-env preview story.
- **`cn` helper:** lives in `lib/utils.ts`; `lib/utils/cn.ts` just re-exports it. shadcn's `components.json` aliases `utils → @/lib/utils`, so import `cn` from `@/lib/utils`.
- **`server-only` import:** `lib/db/client.ts`, `lib/google/calendar.ts`, and `lib/paypal/client.ts` use the `server-only` package — importing them from a client component will hard-fail the build. Keep that boundary.

## Conversion notes — read before changing landing copy

(From the README — these are product-level constraints, not style preferences.)

- The above-fold "Book my free 1:1 session" CTA carries the bulk of conversion; it must be visible in viewport 1 on every device.
- Mobile sticky CTA is non-negotiable (75% of traffic is mobile).
- Free-trial-first messaging ("no credit card") outperforms paid-first by ~10× at top of funnel — don't bury it.
- Public pricing is the #1 trust signal — keep `/pricing` visible from the nav.
- Real teacher photos beat any other landing element; the placeholder SVG avatars in `MOCK_TEACHERS` are not the final state.
- All landing copy is editable from `/admin/settings → Landing copy` via the `admin_settings` table; the page renders with `revalidate: 60`.
