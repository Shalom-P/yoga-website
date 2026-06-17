# MYYOGACLASSES

Conversion-first multi-teacher yoga studio web app. **Australian customers, Indian teachers**, live on Google Meet.

Built on Next.js 16 (App Router) + Supabase + Razorpay + Google Calendar API.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.6 (App Router, RSC, PPR) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (`base-nova` preset) |
| Animation | Motion (Framer Motion's rebrand) + Lenis smooth scroll + GSAP ScrollTrigger |
| Backend | Supabase (Postgres + Auth + Storage + Realtime) |
| ORM | Drizzle (typed complex queries) alongside `supabase-js` (auth + simple CRUD) |
| Auth | Supabase: Google OAuth + passwordless Email OTP (handles AU customers and IN teachers) |
| Payments | Razorpay one-time Checkout (AUD, session-pack credits) |
| Conferencing | Google Calendar API → Meet links (service account) |
| Email | Resend + React Email |
| Analytics | PostHog (events + replay + flags) |
| Errors | Sentry |

---

## Local setup

```bash
# 1. Install
npm install
# (legacy-peer-deps is set in .npmrc because @sentry/nextjs peer cap still hasn't caught up to Next 16)

# 2. Copy env template and fill in
cp .env.local.example .env.local
# Required to develop fully: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# Everything else is optional — the marketing site renders cleanly without any keys (mock data fallback).

# 3. Run
npm run dev
# http://localhost:3000
```

---

## Provisioning checklist (before going live)

1. **Supabase**
   - Create a project in the `ap-southeast-2` (Sydney) region.
   - Apply migrations in `supabase/migrations/0001…0006` (Supabase SQL editor or `psql`).
   - Run `supabase/seed.sql` for demo content.
   - Auth → Providers → enable **Google** (paste your GCP OAuth client/secret).
   - Auth → Providers → enable **Email**; for the inline code flow, edit the **Magic Link** email template to include `{{ .Token }}` (otherwise Supabase sends a magic link instead of a code). The code length is set at Auth → **Email OTP length** (6–10; the client input accepts up to 10).
   - **Custom SMTP (required for production).** Supabase's *built-in* email sender is throttled to a few messages/hour and is for testing only — relying on it surfaces `email rate limit exceeded` at login. Point Auth at Resend: Authentication → **Emails → SMTP Settings** → enable custom SMTP with host `smtp.resend.com`, port `465`, username `resend`, password = your `RESEND_API_KEY`, sender = a **verified** address (e.g. `hello@myyogaclasses.fit`). Then raise Auth → **Rate Limits → "Rate limit for sending emails"** to a production value. This is a hard prerequisite of step 4 (the sender domain must be verified in Resend first).
   - Storage → create buckets `teacher-avatars`, `promotional-media`, `session-recordings`.
   - Promote yourself to admin: `UPDATE profiles SET role='admin' WHERE id='<your-uuid>';`
2. **Razorpay**
   - Create API keys in the Razorpay dashboard (start with **test** keys, `rzp_test_…`).
   - Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `NEXT_PUBLIC_RAZORPAY_KEY_ID` (must equal the key id).
   - Enable **International / foreign-currency** acceptance so AUD orders are accepted (Indian accounts settle INR by default).
   - In `/admin/plans`, set each pack's **price** and **session credits**.
   - Create a webhook in the Razorpay dashboard pointing to `https://<yourdomain>/api/razorpay/webhook` for the `payment.captured` event. Copy its signing secret → `RAZORPAY_WEBHOOK_SECRET`.
3. **Google Meet (keyless — Vercel OIDC → GCP Workload Identity Federation → domain-wide delegation)**

   No downloadable service-account JSON key (orgs that enforce `iam.disableServiceAccountKeyCreation` block them). Instead, Vercel's per-request OIDC identity is federated into GCP, used to `signJwt` as a service account, and that JWT impersonates a real Google **Workspace** mailbox (whose calendar can mint Meet links). The auth chain lives in [`lib/google/calendar.ts`](lib/google/calendar.ts) → `getAccessToken()`.

   **GCP** (run as project owner; the audience uses the project **NUMBER**, not the id):
   - Enable APIs: `iamcredentials`, `sts`, `calendar-json`, `iam`.
   - Create a service account (e.g. `meet-signer`) — **no key**.
   - Create a **Workload Identity Pool + OIDC provider** trusting Vercel: `--issuer-uri=https://oidc.vercel.com/<TEAM_SLUG>`, `--allowed-audiences=https://vercel.com/<TEAM_SLUG>`, map `google.subject=assertion.sub`, and pin an attribute condition to the immutable team id + project + `environment=='production'`.
   - Grant the federated principal **`roles/iam.serviceAccountTokenCreator`** on the SA (NOT just `workloadIdentityUser` — `signJwt` needs Token Creator), bound to the exact `sub`.
   - `GOOGLE_WORKLOAD_IDENTITY_PROVIDER` = `//iam.googleapis.com/projects/<NUMBER>/locations/global/workloadIdentityPools/<POOL>/providers/<PROVIDER>`.

   **Google Workspace Admin** (admin.google.com → Security → API controls → Domain-Wide Delegation): authorize the SA's **numeric client ID** with the single scope `https://www.googleapis.com/auth/calendar.events`. Ensure the impersonated mailbox (`GOOGLE_IMPERSONATE_SUBJECT`) is a licensed user with Calendar/Meet.

   **Vercel**: Settings → Security → enable **OIDC Federation**; set `GOOGLE_WORKLOAD_IDENTITY_PROVIDER`, `GOOGLE_IMPERSONATE_SERVICE_ACCOUNT`, `GOOGLE_IMPERSONATE_SUBJECT`, `GOOGLE_SYSTEM_CALENDAR_ID` (Production scope). `VERCEL_OIDC_TOKEN` is injected automatically. Locally: `vercel env pull` then **`vercel dev`** (not `next dev` — plain `next dev` has no OIDC token, so Meet creation fails loud with a clear hint).

   - **Per-teacher calendars (optional):** to host a teacher's sessions on their *own* calendar, share it with the impersonated mailbox ("Make changes to events"), then paste its calendar ID into **Google Calendar ID** on the teacher in `/admin/teachers`. Blank → falls back to `GOOGLE_SYSTEM_CALENDAR_ID`.
   - **Schedule the Meet-retry sweep:** set `CRON_SECRET` (`openssl rand -hex 32`) and wire the `/api/cron/*` endpoints — see `supabase/migrations/0015_cron_schedule.sql` for the pg_cron + pg_net setup, or POST from any scheduler with `Authorization: Bearer $CRON_SECRET`. Until wired, a failed Meet link is recoverable via the dashboard's "Get link" button.
4. **Resend**: verify the sending domain, then set `RESEND_API_KEY` / `RESEND_FROM_EMAIL`. Resend powers **both** transactional app email (booking confirmations, reminders via [`lib/email/client.ts`](lib/email/client.ts)) **and** Supabase auth email — but auth email only routes through Resend once you wire it as Supabase custom SMTP (see step 1). Domain verification gates both.
5. **PostHog**: project → `NEXT_PUBLIC_POSTHOG_KEY`. Create the trial + paid funnels (see plan).
6. **Sentry**: project → `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`.
7. **Hosting**: connect the repo to your host of choice, paste the env vars, and use **Node 20+**. Installs need `--legacy-peer-deps` (already set in `.npmrc`).

---

## Project layout

```
app/
  (marketing)/            # Public conversion pages — landing, teachers, classes, pricing, etc.
  (auth)/                 # /login, /onboarding, /auth/callback
  (dashboard)/            # Customer dashboard (auth-guarded by middleware)
  admin/                  # Admin shell (role-guarded)
  api/                    # Route handlers — Razorpay, Meet, bookings, newsletter
components/
  ui/                     # shadcn primitives
  marketing/              # Hero, HowItWorks, TeacherCarousel, …
  dashboard/              # Customer dashboard pieces
  admin/                  # Admin sidebar, settings form
  shared/                 # Login form, onboarding form, theme + analytics providers
lib/
  supabase/               # browser / server / service / middleware clients + types
  razorpay/               # SDK client + order/fulfilment helpers
  google/                 # Calendar/Meet client (service account)
  email/                  # Resend client + React Email templates
  analytics/              # PostHog event helpers
  auth/                   # requireUser / requireAdmin guards
  db/                     # Drizzle schema + client
  utils/                  # cn, date, money helpers
  i18n/                   # money + locale helpers (AUD primary)
  timezone/               # date-fns-tz helpers (AU ↔ IN)
  data/                   # Server-side landing data (Supabase or mock fallback)
supabase/
  migrations/             # 0001 … 0006 — authoritative schema + RLS + RPCs
  seed.sql                # Demo data
middleware.ts             # Session refresh + role guard
```

---

## Conversion notes (read before changing the landing page)

- **Above-fold CTA carries 60-90% of conversion weight.** Don't bury "Book my free 1:1 session" — it must be visible in viewport 1 on every device.
- **Mobile sticky CTA is non-negotiable** — 75% of yoga traffic is mobile.
- **Free-trial messaging** ("no credit card") outperforms paid-first messaging by ~10× for top-of-funnel conversion in this category.
- **Public pricing** is the #1 trust signal. Don't hide it.
- **Real teacher photos and names** in the carousel section drive bookings more than any other element. Replace placeholder SVG avatars with actual photos ASAP.
- All landing-page copy is editable from `/admin/settings → Landing copy` via the `admin_settings` table. Server renders with `revalidate: 60`, so changes go live within ~1 minute.

---

## License

Proprietary. © MYYOGACLASSES.
