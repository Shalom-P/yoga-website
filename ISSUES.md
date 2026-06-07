# Issues & Gaps Audit

_Generated 2026-06-07. Method: four parallel area audits (customer/auth flows, integrations & background jobs, admin authoring, public/SEO/legal) plus manual verification of the highest-impact items._

**Legend** — Severity: 🔴 Critical (blocks a core booking/payment flow or is a legal/trust risk) · 🟠 High · 🟡 Medium · ⚪ Low. `✓` = personally verified against source (not just agent-reported).

> The original prompt — "give me the option to add an introductory video" — turned out to already exist in the teacher form, but it was silently failing for real video sizes. That is **fixed in this pass** (§0). Everything below is the broader hunt for "such issues".

---

## 0. Fixed in this pass — teacher intro video

The "Intro video" upload **already existed** in the Add/Edit-teacher dialog ([TeacherFormDialog.tsx:320](components/admin/TeacherFormDialog.tsx#L320)) and is wired to `intro_video_url` + both display surfaces. The real defect was that uploads failed for normal video sizes:

- **Cause** ✓ — `teacher-media` / `promotional-media` buckets were created in [0008_storage_buckets.sql:17](supabase/migrations/0008_storage_buckets.sql#L17) with **no `file_size_limit`**, so they inherit Supabase's 50 MB global default. A 30–60s MP4 is usually 50–150 MB → HTTP 413, surfaced as a cryptic "Upload failed".
- **Fix applied**:
  1. [0009_storage_limits.sql](supabase/migrations/0009_storage_limits.sql) — raises `teacher-media` to 100 MB, `promotional-media` to 200 MB.
  2. [MediaUploadField.tsx](components/admin/MediaUploadField.tsx) — new `maxSizeMb` prop rejects oversize files up front with a clear message, and the upload-error handler now detects 413/size errors and tells you exactly what to raise.
  3. [TeacherFormDialog.tsx](components/admin/TeacherFormDialog.tsx) — caps (avatar/cover 10 MB, intro video 100 MB) + updated hint text.
- **⚠️ You must still do two things for it to work in prod:** (a) apply migration `0009` to the live DB, and (b) raise the **project-wide** cap in Supabase → Project Settings → Storage → "Upload file size limit" to ≥ 200 MB (a per-bucket limit can never exceed the global one). Typecheck + lint pass.

---

## 1. Customer & booking flows

- 🔴 **C1 — Paying members can never book a paid session** ✓ — [TeacherSlotPicker.tsx:123-124](components/dashboard/TeacherSlotPicker.tsx#L123). The picker hardcodes `isFreeTrial: true` (and `durationMinutes: 60`) on every request and redirects to the plan page on success. A subscriber's 2nd booking trips the `bookings_one_free_trial_per_customer` index → `trial_already_claimed`. _Fix: drive `isFreeTrial` from whether the user has an active subscription; render a real "book a session" path for members._
- 🔴 **C2 — Booking confirm doesn't verify a subscription for non-trial bookings** ✓ — [bookings/confirm/route.ts](app/api/bookings/confirm/route.ts). If `isFreeTrial:false` is POSTed, no active-subscription check runs before creating the session. _Fix: when not a trial, require an `active` row in `subscriptions` or return `403 subscription_required`._
- 🟠 **C3 — New users skip onboarding** — [auth/callback/route.ts:27](app/(auth)/auth/callback/route.ts#L27), [LoginForm.tsx:131](components/shared/LoginForm.tsx#L131). Both auth paths go straight to `/dashboard` unless `?next=/onboarding` was passed; a direct "Log in" lands a profile-less user on the dashboard. _Fix: redirect to `/onboarding` when `experience_level IS NULL`._
- 🟠 **C4 — Onboarding never collects `full_name`** — [OnboardingForm.tsx:46](components/shared/OnboardingForm.tsx#L46), dashboard greets "Hello, there" ([dashboard/page.tsx:34](app/(dashboard)/dashboard/page.tsx#L34)). Phone-OTP users get no name at all. _Fix: add a required name field to onboarding._
- 🟠 **C5 — No "Resend code" on the OTP screen** — [LoginForm.tsx:134](components/shared/LoginForm.tsx#L134). Expired/undelivered OTP dead-ends the user. _Fix: add a resend button calling `sendOtp` again._
- 🟠 **C6 — OAuth callback error is swallowed** — callback redirects to `/login?error=…` but `LoginForm` never reads `error`, so the user sees a clean login page with no message. _Fix: read & surface the `error` param._
- 🟡 **C7 — Slot duration hardcoded to 60 min** ✓ — [TeacherSlotPicker.tsx:123](components/dashboard/TeacherSlotPicker.tsx#L123). Slots are _placed_ using `slot_duration_minutes` but _booked_ as 60, so 30/90-min slots can be wrongly rejected/accepted by the server window check. _Fix: send the window's real duration._
- 🟡 **C8 — Booking phone dialog has no country code + weak validation** — [TeacherSlotPicker.tsx:244](components/dashboard/TeacherSlotPicker.tsx#L244) (and `ProfileForm`). Bare `tel` input, `length<6` check; `0412…` stores as invalid E.164. _Fix: reuse the `+61/+91` selector from `LoginForm`._
- 🟡 **C9 — Several booking errors fall back to a generic message** — [TeacherSlotPicker.tsx:184](components/dashboard/TeacherSlotPicker.tsx#L184). `slot_in_past`, `slot_unavailable`, `teacher_not_found`, `session_create_failed` all render "Couldn't book that slot." _Fix: add specific copy for the common ones._
- 🟡 **C10 — PayPal `?canceled=1` return shows no banner** — [dashboard/plan/page.tsx](app/(dashboard)/dashboard/plan/page.tsx). Abandoning checkout returns silently; user can't tell it didn't go through. _Fix: read `canceled` and show an info banner._
- 🟡 **C11 — Detected timezone not clamped to the AU list** — [OnboardingForm.tsx:27](components/shared/OnboardingForm.tsx#L27). A non-AU `Intl` zone is saved verbatim and the Select shows blank. _Fix: clamp to `AU_TIMEZONES`, default Sydney._
- 🟡 **C12 — "Reschedule" is a fake action** — [BookingsList.tsx:281](components/dashboard/BookingsList.tsx#L281). It just links to `/dashboard/book` without cancelling the old booking → possible double-booking. _Fix: rename "Book another", or cancel-then-rebook._
- 🟡 **C13 — Discount codes accepted by API but no customer input exists** — [paypal/create-subscription/route.ts:9](app/api/paypal/create-subscription/route.ts#L9). Admins can create codes (`DiscountsAdmin`) but `PricingTeaser`/`PlanAutoStart` have no field. _Fix: add a "Have a promo code?" input._
- 🟡 **C14 — Booking-start teacher cards always show the SVG placeholder** — [dashboard/book/page.tsx:27](app/(dashboard)/dashboard/book/page.tsx#L27). `avatar_url` isn't even selected. Conversion-critical step. _Fix: select & render real photos._
- 🟡 **C15 — Onboarding `loading` never reset on the session-expired path** — [OnboardingForm.tsx:40](components/shared/OnboardingForm.tsx#L40). `setLoading(true)` then early `return` without reset. _Fix: reset before the early return._
- ⚪ **C16 — Dashboard "Browse teachers" links to the marketing page** — [dashboard/page.tsx:118](app/(dashboard)/dashboard/page.tsx#L118) → `/teachers` sends a logged-in user back through the marketing funnel. _Fix: link `/dashboard/book`._
- ⚪ **C17 — Raw PayPal status leaked to user** — [PlanSuccessConfirm.tsx:73](components/dashboard/PlanSuccessConfirm.tsx#L73) prints `APPROVAL_PENDING`. _Fix: drop the raw status interpolation._
- ⚪ **C18 — Suspended subscription: cancel disabled, no next step** — [CurrentSubscription.tsx:91](components/dashboard/CurrentSubscription.tsx#L91). _Fix: link to PayPal manage-payment for `suspended`._

## 2. Integrations & background jobs

- 🔴 **I1 — No transactional email is ever sent** ✓ — `resend`/`@react-email` are installed but imported nowhere. Yet the UI promises email in ≥5 places: Meet link "as soon as you book" + 24h/1h reminders ([FAQ.tsx:38](components/marketing/FAQ.tsx#L38)), [dashboard/page.tsx:123](app/(dashboard)/dashboard/page.tsx#L123), [plan/page.tsx:61](app/(dashboard)/dashboard/plan/page.tsx#L61), subscription-activated ([PlanSuccessConfirm.tsx:73](components/dashboard/PlanSuccessConfirm.tsx#L73)), onboarding ([OnboardingForm.tsx:134](components/shared/OnboardingForm.tsx#L134)). _Fix: build `lib/email/` (Resend client + templates) and call it from booking confirm and the `ACTIVATED` webhook case._
- 🔴 **I2 — Meet-link retry sweep doesn't exist** ✓ — booking confirm & admin-session set `meet_status='failed'` "for the cron sweeper", the dashboard shows "we're retrying" ([dashboard/page.tsx:154](app/(dashboard)/dashboard/page.tsx#L154)), and a partial index `sessions_meet_status_idx` was added for it — but nothing retries. Sessions can be stuck with no link forever. _Fix: cron handler over `meet_status IN ('pending','failed') AND start_at>now()` → `createMeetEvent`._
- 🟠 **I3 — All four scheduled jobs are absent** ✓ — no cron handlers / scheduler anywhere (no `app/api/cron`, no host cron config, no `pg_cron`). Missing: reminder emails, no-show sweep (the `no_show` booking status is never written), PayPal reconcile, Meet retry. _Fix: add cron route handlers + a scheduler on the host._
- 🟠 **I4 — Phone collected under a false "SMS reminders" promise** — [ProfileForm.tsx:80](components/dashboard/ProfileForm.tsx#L80) says "send SMS reminders 24h before"; no outbound Twilio anywhere (Twilio is OTP-only via Supabase). _Fix: implement SMS reminders, or change the copy._
- 🟡 **I5 — Admin-created sessions omit the customer from the calendar invite** — [admin/sessions/route.ts:92](app/api/admin/sessions/route.ts#L92) calls `createMeetEvent` with no `attendeeEmails`, so no Google invite email goes out (customer/self-serve paths do pass it). _Fix: pass attendee emails._
- 🟡 **I6 — Sentry installed but entirely unwired** ✓ — no `sentry.*.config.ts` / `instrumentation.ts`, `next.config.ts` isn't wrapped, no `captureException`. Env vars are dead. _Fix: run the Sentry wizard or add the configs._
- 🟡 **I7 — PayPal webhook drops refunds & payment-failures** — [paypal/webhook/route.ts:52](app/api/paypal/webhook/route.ts#L52) handles only 6 event types; `PAYMENT.*.REFUNDED` and `BILLING.SUBSCRIPTION.PAYMENT.FAILED`/`RE-ACTIVATED` no-op. Refunds never flip `payments.status`. _Fix: add the refund/reactivate cases._
- ⚪ **I8 — `posthog-node` unused; server-side funnel untracked** ✓ — only `posthog-js`, and `track()` is called from just `OnboardingForm`/`LoginForm`. Booking/subscription/cancel events aren't tracked. _Fix: add `lib/analytics/server.ts` and emit from the API routes._
- ⚪ **I9 — Newsletter signup always returns 200, even on DB error** — [newsletter/subscribe/route.ts:18](app/api/newsletter/subscribe/route.ts#L18) swallows every error. A prod outage silently drops signups with no log. _Fix: log on catch; only no-op when Supabase is genuinely unconfigured._

## 3. Admin authoring

- 🔴 **A1 — Reviews can never be published** ✓ — no `app/admin/reviews` page, component, or sidebar link, but `reviews.is_approved` defaults `false` and public read only shows approved rows. Submitted reviews are invisible forever without raw SQL. _Fix: build a Reviews admin (approve / feature toggles)._
- 🟠 **A2 — Teacher date overrides have no UI at all** ✓ — `teacher_slot_overrides` (holidays / one-off slots, used by the booking availability check) has full RLS but no page/section — [teachers/[id]/slots/page.tsx](app/admin/teachers/[id]/slots/page.tsx) only renders the weekly grid. _Fix: add a "Date overrides" section to create/delete overrides._
- 🟠 **A3 — Custom availability windows are read-only; grid hardcodes 06:00–17:00** ✓ — [AvailabilityGrid.tsx:15](components/admin/AvailabilityGrid.tsx#L15) (`HOURS = 6..17`) and the "edit them directly in the database for now" note at [:197](components/admin/AvailabilityGrid.tsx#L197). Non-hourly windows and any early-morning/evening IST slot can't be made in the UI (matters for IST↔AEST). _Fix: allow full-day hours + an "add/edit/delete custom window" form._
- 🟠 **A4 — "Sync to PayPal" is permanently disabled after the first sync** ✓ — [PlansAdmin.tsx:266](components/admin/PlansAdmin.tsx#L266) `disabled={… || !!p.paypal_plan_id}`. The dialog itself admits a price change needs a new PayPal plan, but there's no way to re-sync without nulling `paypal_plan_id` in SQL. _Fix: add a "Re-sync / clear PayPal ID" action._
- 🟡 **A5 — `plans.included_session_types` never editable** — [PlansAdmin.tsx:37](components/admin/PlansAdmin.tsx#L37) omits it, so it always saves `{}` and plan→class-type access control is inert. _Fix: add a multi-select of class categories._
- 🟡 **A6 — Sessions admin: no recording URL, no status transitions, 24h window** — `recording_url` is never fetched/editable ([SessionsAdmin.tsx:31](components/admin/SessionsAdmin.tsx#L31)); only "Cancel" exists (no live/completed); the list is capped to last-24h + next-100 ([admin/sessions/page.tsx:20](app/admin/sessions/page.tsx#L20)) so yesterday's classes vanish. _Fix: add recording field, status buttons, date filter/pagination._
- 🟡 **A7 — Class categories: `cover_image_url` & `sort_order` not editable** — [ClassesAdmin.tsx:31](components/admin/ClassesAdmin.tsx#L31). _Fix: add an image upload + order input._
- 🟡 **A8 — Teacher `certifications` & `sort_order` not editable** ✓ — columns exist ([0002_teachers.sql:17](supabase/migrations/0002_teachers.sql#L17)) but absent from the form, so ordering is stuck at 0 and certs can't be entered. _Fix: add inputs._
- 🟡 **A9 — Promotional media: no edit (only upload/delete), `sort_order` uncontrolled** — [MediaAdmin.tsx:163](components/admin/MediaAdmin.tsx#L163). Wrong placement = delete & re-upload. _Fix: metadata-edit dialog + order input._
- 🟡 **A10 — Admin can't be demoted in the UI** — [CustomersTable.tsx:107](components/admin/CustomersTable.tsx#L107) ("you'll need a SQL update"). _Fix: `demote_from_admin` RPC + button._
- 🟡 **A11 — Bookings list capped at 200, no pagination/date filter** — [admin/bookings/page.tsx:20](app/admin/bookings/page.tsx#L20). History beyond 200 is invisible. _Fix: server-side pagination._
- 🟡 **A12 — Settings "Legal" tab is non-functional** — [admin/settings/page.tsx:53](app/admin/settings/page.tsx#L53) just says "edit the source files". A non-dev admin can't update policies. _Fix: move legal copy into `admin_settings`, or drop the tab._
- ⚪ **A13 — Admin settings serialize everything as strings** — [AdminSettingsForm.tsx:36](components/admin/AdminSettingsForm.tsx#L36); fine for text today but breaks the moment a number/bool field is added. _Fix: canonical (de)serialization per field type._
- ⚪ **A14 — Teacher `rating_avg`/`rating_count` have no manual seed override** — useful before real reviews exist. _Fix: optional override inputs._
- ⚪ **A15 — Customer prefs not visible to admin** — `experience_level`, `goals`, `referral_source`, `marketing_opt_in` never fetched on [admin/customers/page.tsx](app/admin/customers/page.tsx). _Fix: show in a detail drawer._
- ⚪ **A16 — Admin booking cancellations never set `cancellation_reason`** — [BookingsAdmin.tsx:61](components/admin/BookingsAdmin.tsx#L61). _Fix: optional reason input._

## 4. Public site, SEO, legal & content

- 🔴 **P1 — Privacy Policy & Terms are placeholder stubs** ✓ — [legal/privacy/page.tsx:13](app/(marketing)/legal/privacy/page.tsx#L13), [legal/terms/page.tsx:13](app/(marketing)/legal/terms/page.tsx#L13) literally say "Placeholder…". Taking PayPal payments from AU consumers without real policies is a compliance risk. _Fix: lawyer-reviewed Privacy (Privacy Act 1988) + Terms; list real sub-processors (Supabase, PayPal, Twilio, Google, Resend, PostHog)._
- 🟠 **P2 — No `sitemap`, `robots`, or OG/Twitter image** ✓ — none of `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.*` exist; OG metadata has no `images`. Weak crawling + imageless social shares for a conversion site. _Fix: add all three._
- 🟡 **P3 — Hardcoded fake trust numbers** ✓ — [FinalCTA.tsx:57](components/marketing/FinalCTA.tsx#L57) "Trusted by 1,200+ students · 4.9 ★" is a static string; mock fallbacks ship "1,200+ reviews"/"4.9" + invented per-teacher `rating_count` (312/187/142/421) in [landing.ts:165](lib/data/landing.ts#L165). Displaying fabricated review counts is an ACCC/consumer-law risk. _Fix: source from real data; don't ship invented counts._
- 🟡 **P4 — Hero "Next available 1:1" card is fake** ✓ — [Hero.tsx:163](components/marketing/Hero.tsx#L163) hardcodes "Gentle Hatha with Aarti · Tomorrow 7:30 AM AEST". Implies live availability in the most important viewport. _Fix: fetch a real slot or label it "example"._
- 🟡 **P5 — Placeholder ABN in the footer** ✓ — [Footer.tsx:74](components/marketing/Footer.tsx#L74) "ABN xx xxx xxx xxx." _Fix: real ABN or remove until registered._
- 🟡 **P6 — "HSA/FSA-style invoicing for AU rebates"** ✓ — [landing.ts:146](lib/data/landing.ts#L146). HSA/FSA are US concepts; misleading for AU. _Fix: accurate AU wording (private health fund claims), only if true._
- 🟡 **P7 — `schema-dts` installed but no JSON-LD emitted** ✓ — no structured data anywhere. _Fix: add `Organization`/`LocalBusiness` + teacher `Person` schema, or drop the dep._
- 🟡 **P8 — Real teacher photos missing everywhere** — all `MOCK_TEACHERS.avatar_url` are null → SVG silhouettes on marketing + booking pages (CLAUDE.md flags this as the top conversion lever). _Fix: upload real photos (now possible once the §0 video/image upload limits are applied)._
- 🟡 **P9 — Canonical domain is inconsistent** ✓ — fallback `myyogaclasses.com.au` in [layout.tsx](app/layout.tsx) vs `NEXT_PUBLIC_SITE_URL=…myyogaclasses.fit` vs `CNAME` = `myyogaclasses.fit`. Canonical/OG URLs will diverge. _Fix: pick one (the CNAME says `.fit`) and set the env everywhere._
- 🟡 **P10 — WhatsApp CTA silently vanishes if env unset** — [WhatsAppButton.tsx:14](components/shared/WhatsAppButton.tsx#L14) returns null without `NEXT_PUBLIC_WHATSAPP_NUMBER`; it's blank in the examples. _Fix: set the real number in the host's env._
- ⚪ **P11 — Legal/contact pages lack `description` metadata; contact is mailto-only; default Next.js SVGs left in `public/`** — minor SEO/cleanup ([contact/page.tsx](app/(marketing)/contact/page.tsx); `public/{file,globe,next,vercel,window}.svg`).

---

### Suggested order of attack
1. **🔴 first:** C1 (paid booking), I1 (email), I2 (Meet retry), A1 (reviews), P1 (legal). These are launch-blockers — broken core flows or legal exposure.
2. **🟠 next:** the auth/onboarding chain (C3–C6), admin scheduling gaps (A2–A4), SEO basics (P2).
3. Then work the 🟡/⚪ polish list per surface.

_This file is a snapshot; tick items off or delete it once triaged._
