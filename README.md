# MYYOGACLASSES

Conversion-first multi-teacher yoga studio web app. **Australian customers, Indian teachers**, live on Google Meet.

Built on Next.js 15 (App Router) + Supabase + PayPal + Google Calendar API, deployed to Netlify.

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
| Auth | Supabase: Google OAuth + Phone OTP via Twilio Verify (handles +61 AU and +91 IN) |
| Payments | PayPal Subscriptions API (AUD) |
| Conferencing | Google Calendar API → Meet links (service account) |
| Email | Resend + React Email |
| SMS | Twilio (via Supabase) |
| Analytics | PostHog (events + replay + flags) |
| Errors | Sentry |
| Hosting | Netlify (`@netlify/plugin-nextjs`) |

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
   - Auth → Providers → enable **Phone**, choose **Twilio Verify**, paste Twilio credentials.
   - Storage → create buckets `teacher-avatars`, `promotional-media`, `session-recordings`.
   - Promote yourself to admin: `UPDATE profiles SET role='admin' WHERE id='<your-uuid>';`
2. **PayPal**
   - Create a REST app in PayPal Developer dashboard (start in **sandbox**).
   - Set `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_ENV=sandbox`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`.
   - In `/admin/plans`, click **Sync to PayPal** for each plan → saves `paypal_plan_id` on each row.
   - Create a webhook in PayPal pointing to `https://<yourdomain>/api/paypal/webhook` for events: `BILLING.SUBSCRIPTION.ACTIVATED|CANCELLED|EXPIRED|SUSPENDED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.SALE.COMPLETED`. Copy webhook ID → `PAYPAL_WEBHOOK_ID`.
3. **Google Meet** (via Calendar API)
   - Enable the **Google Calendar API** in your GCP project.
   - Create a **service account**, download the JSON key.
   - Paste the full JSON (as a single line) into `GOOGLE_SERVICE_ACCOUNT_JSON`.
   - In Google Calendar settings, share the chosen system calendar with the service account email (give "Make changes to events"). Set `GOOGLE_SYSTEM_CALENDAR_ID` to that calendar's ID.
4. **Resend**: domain verification → `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
5. **PostHog**: project → `NEXT_PUBLIC_POSTHOG_KEY`. Create the trial + paid funnels (see plan).
6. **Sentry**: project → `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`.
7. **Netlify**: connect repo, paste env vars, ensure `NODE_VERSION=20` and `NPM_FLAGS=--legacy-peer-deps` in build settings (already in `netlify.toml`).

---

## Project layout

```
app/
  (marketing)/            # Public conversion pages — landing, teachers, classes, pricing, etc.
  (auth)/                 # /login, /onboarding, /auth/callback
  (dashboard)/            # Customer dashboard (auth-guarded by middleware)
  admin/                  # Admin shell (role-guarded)
  api/                    # Route handlers — PayPal, Meet, bookings, newsletter
components/
  ui/                     # shadcn primitives
  marketing/              # Hero, HowItWorks, TeacherCarousel, …
  dashboard/              # Customer dashboard pieces
  admin/                  # Admin sidebar, settings form
  shared/                 # Login form, onboarding form, theme + analytics providers
lib/
  supabase/               # browser / server / service / middleware clients + types
  paypal/                 # REST client + webhook verifier
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
netlify/
  functions/              # Scheduled cron functions (reminder emails, no-show, PayPal reconcile)
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
