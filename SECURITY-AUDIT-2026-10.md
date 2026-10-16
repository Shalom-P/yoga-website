# Security audit, October 2026

**Site:** myyogaclasses.fit (repo `Shalom-P/yoga-website`)
**Branch with fixes:** `security/audit-2026-10` (6 commits, 46 files). Not merged, not deployed.
**Audit date:** 16 October 2026

## 1. Summary

The whole repository was reviewed: the Next.js app and every API route, the Supabase migrations (RLS policies, RPCs, triggers, storage buckets), the four Edge Functions the iOS app calls, the dependency tree, and the security headers. Four parallel reviews (auth and routes; payments and bookings; database; uploads, XSS, headers and dependencies) produced about 30 findings. 26 are fixed on the branch. The rest are product decisions or dashboard settings, listed in section 5.

Everything on the branch was then double-checked: an independent review of the complete diff by a reviewer that had not seen the work (found 3 gaps, since fixed, and 7 nits, all addressed), a production build, an HTTP smoke test of the built app, Deno type-checks of the Edge Functions, and behaviour tests of both migrations against an in-memory Postgres. Details in section 6.

**What could not be checked:** the live Supabase database and the live Vercel project were not reachable from the audit session (the connected Supabase account held a different project; Vercel refused the team scope). Database findings therefore come from the migrations, and both new migrations end with queries to run against the live database after applying.

## 2. Severity at a glance

| Severity | Found | Fixed on branch | Left for owner |
|---|---|---|---|
| Critical | 1 | 1 | 0 |
| High | 6 | 6 | 0 |
| Medium | 10 | 9 | 1 (currency arbitrage) |
| Low | 13+ | 10 | 3+ (see section 5) |

## 3. How to ship this (order matters)

1. **Merge the branch and deploy** from a clean checkout of `main` (`npx vercel@latest --prod`; merging alone does not deploy). This ships Next.js 16.2.6 to 16.4.2.
2. **Redeploy the Edge Functions that changed:** `cancel-booking`, `book-session`, `document-url`.
3. **Then apply the two migrations** in the Supabase SQL editor or with psql:
   `supabase/migrations/0046_security_audit_hardening.sql`, then `0047_promo_cap_and_discount_checks.sql`.
   Run the "After applying" queries at the bottom of each file; they list any existing rows the new rules would reject, and then validate the deferred constraints.
4. **Run `verify-launch.sql`.** It now checks that the two dropped policies stay dropped and that the rate-limit RPC exists.
5. **Set in Supabase:** `BOOKING_ALLOWED_ORIGIN` (Edge Functions CORS). **Set in Vercel if not already:** `NEXT_PUBLIC_SITE_URL` (the CSRF check falls back to the request's own origin, which is fine on Vercel; the variable makes it explicit) and `RAZORPAY_WEBHOOK_SECRET` (see section 5).

**Why the order:** the new code works against both the old and the new schema (explicit column lists, service-role newsletter RPC, rate limiter and promo-cap check that fail open while their RPCs are missing). The old code does not work against the new schema: applying `0046` before the deploy makes the anonymous teacher and review queries fail, and the live site would then silently show the placeholder mock teachers and an empty testimonial wall, and newsletter signup would fail, until the deploy lands.

**Rollback:** the app changes can be reverted by redeploying `main`. The migrations are additive apart from dropped policies; to undo them, re-create `reviews_self_insert`, `reviews_self_update` (0018 text), `bookings_self_update_cancel` (0018), `teachers_public_read` (0002) and `grant select on public.teachers, public.reviews to anon`. There is no reason to do this: no code path on `main` depends on those policies either.

## 4. Findings and fixes

Severity, what was wrong, how it could be abused, what changed.

### Critical

**C1. Outdated Next.js with published remote-code-execution advisories.**
`package.json` pinned 16.2.6. `npm audit` lists for that version: RCE in the Image Optimization API with AVIF (GHSA-2xp9-vwfh-vxw4), RCE in `next/og` ImageResponse (GHSA-vcvr-r3jv-pc5j), SSRF in Image Optimization (GHSA-cjq9-62q9-8jv4), middleware/proxy bypass with Turbopack (GHSA-6gpp-xcg3-4w24), cache confusion and ISR poisoning. The image optimizer is enabled (`remotePatterns` for Supabase storage), so the first two are reachable.
*Fix:* `next` and `eslint-config-next` pinned to 16.4.2; lockfile updated; production build verified. `sharp` (libvips/libheif CVEs) is fixed by the same bump.

### High

**H1. Anyone could publish a fake approved, featured review on the homepage.**
`reviews_self_insert` (migration 0005) checked only `customer_id`. A free OTP sign-up could insert `is_approved = true, is_featured = true` with any text, teacher, display name and location; `lib/data/landing.ts` reads exactly that filter onto the homepage and `/reviews`. The real path, `/api/reviews`, inserts on the service role with `is_approved = false`, so the policy was never needed.
*Fix (0046 §1):* both self policies dropped; anon loses `reviews.customer_id` and `session_id` (reviewer auth ids); unique index `reviews_one_per_customer_session`; `/api/reviews` maps the 23505 race to `already_reviewed`. The "After applying" query lists any review published this way.

**H2. Cancelling after attending refunded the credit, or re-opened the free trial, forever.**
Both cancel paths (`/api/bookings/cancel`, Edge `cancel-booking`) checked only `status = 'confirmed'`. A booking stays confirmed until `no-show-sweep` flips it 2h after the end, and never if the Meet link failed. Attend, cancel, get the credit back; or attend the free trial, cancel, book another free trial (the trial index excludes cancelled rows).
*Fix:* both paths refuse once `sessions.start_at <= now()` (409 `not_cancellable`). The dashboard already only offers Cancel on upcoming sessions.

**H3. Medical documents: another patient's file could be read or deleted.**
The 0027 RLS checked only `storage_path LIKE '{uid}/%'`. `{uid}/../{victim}/{file}` satisfies it, and storage-js does not encode the path, so the service-role download route would sign the victim's object and the delete route would remove it. A teacher whose share was revoked already knows the path from earlier signed URLs.
*Fix:* `isSafeMedicalPath()` (`lib/medical/constants.ts`) enforced at every sink: register, download, delete, and mirrored in the Edge `document-url`. `0046 §5` makes the RLS traversal-proof, adds a table CHECK (`{customer_id}/{one safe segment}`), and a trigger so owners cannot move a path, re-home a row or un-delete a tombstone.

**H4. Open redirect after login.**
`safeNext` rejected `//` and `/\` but not control characters. The URL parser strips tab/LF/CR, so `/login?next=/%09/evil.com` sent the user to `https://evil.com/` after a real Google sign-in. Verified with the same `searchParams.get -> safeNext -> new URL` chain the callback uses.
*Fix:* `safeNext` rejects any control character or backslash, parses against a probe origin, and returns the normalised path only if the origin is unchanged. Tests added in `lib/auth/redirects.test.ts`.

**H5. Promo code caps could be bypassed.**
`reserve_discount_redemption` releases the caller's earlier unpaid reservation, and `commit_discount_redemption` resurrected `released` rows with no cap re-check. Open N discounted orders for a one-per-email code (each reserve frees the last), pay them all, get N discounted packs.
*Fix (0047 §1 + `lib/razorpay/fulfillment.ts`):* new `discount_redemption_commit_allowed()` re-checks `max_uses` and `per_email_max` under the code's row lock before a released row may resurrect; `commit_discount_redemption` calls it. Fulfilment checks it before any money action: an `authorized` hold past the cap is not captured (it expires and the funds return); a `captured` payment past the cap (Razorpay auto-capture, the account default) is **refunded in full** and no credits are granted. The webhook acknowledges these outcomes instead of retrying; `verify-payment` returns 409 with "This promo code reached its limit before your payment completed, so the payment has been refunded." The bank-transfer intent route voids a discounted payment whose reservation was superseded before it was linked (409 `promo_retry`), instead of leaving it for admin verify to grant uncounted.

**H6. Cancelled 1:1 sessions kept blocking the teacher's slot forever.**
`book_session` creates a capacity-1 session per booking; customer cancel updated only the booking. The overlap EXCLUDE ignores only cancelled *sessions*, so the slot stayed blocked, and a book-free-trial/cancel loop could block a teacher's whole calendar at zero cost.
*Fix:* both cancel paths set the session to `cancelled` when it has capacity 1, no live bookings left, is still `scheduled` and has not started. Group sessions are untouched. `meet-retry` already skips cancelled sessions on the forward pass and ignores status on the release pass, so Meet cleanup still happens.

### Medium

**M1. A customer could read any session's Meet link.** `bookings_self_update_cancel` (0018) pinned only `status`; a customer could set `status = 'cancelled'` **and** `session_id = <any session>` in one UPDATE, then read that session's `meet_link` through `sessions_booked_customer_read`. *Fix (0046 §2):* policy dropped; no browser code updates bookings. `verify-launch.sql` now asserts it stays dropped.

**M2. No CSRF defence beyond SameSite=Lax.** `req.json()` parses `text/plain`, so a cross-origin "simple" POST needs no preflight; any sibling subdomain is same-site. A page on another host could delete the visitor's account or, for an admin, grant credits. *Fix:* `middleware.ts` now runs for `/api/*` too (origin check only, no session refresh) and rejects state-changing requests whose `Origin` is not ours (apex/www of `NEXT_PUBLIC_SITE_URL`, the request's own origin, or the Capacitor shell). Requests with no `Origin` (Razorpay webhook, pg_cron, server-to-server) pass; those routes authenticate by signature or bearer secret. `lib/security/sameOrigin.ts` + tests. Verified over HTTP: evil origin 403, sibling subdomain 403, same-origin / no-origin / `capacitor://localhost` pass, GET unaffected.

**M3. Teachers could un-hide themselves and change studio-managed fields.** The 0026 trigger's deny-list predated `is_public`, `contact_email` and never covered the media columns. *Fix (0046 §3):* the trigger is now an allow-list of exactly the six fields `TeacherProfileForm` edits (display name, headline, bio, specialties, languages, years). The `auth.uid() IS NULL` carve-out that `promote_to_teacher` relies on is kept.

**M4. Anonymous visitors could read teachers' private fields and hidden teachers.** `teachers_public_read` (0002) exposed every column of every active teacher, including `contact_email` (personal addresses since 0040), `google_calendar_id`, `profile_id`, and did not filter `is_public`. *Fix (0046 §4):* anon policy now `is_active and is_public`; anon is column-granted only the public columns; authenticated users keep `is_active` row reads; anon loses `teacher_slot_overrides` (free-text blocked-day reasons). `lib/data/landing.ts` selects explicit column lists. *Remaining:* signed-in customers can still read `contact_email` and `google_calendar_id` because column grants are per role; see section 5.

**M5. Retired teachers kept access to shared medical records.** Retire only flips `is_active`; the login link and shares survive. *Fix:* download route and Edge `document-url` require the teacher to be active.

**M6. Two partial refunds could claw back the whole grant twice.** `reverseRazorpayPayment` decided "full refund" from the payment's current `amount_refunded` and deduped per refund id. *Fix:* one clawback per payment (checks for a prior `refund` ledger row; still releases the promo use on redelivery); `0047` adds `credit_ledger_payment_refund_once` as the DB guard, and both the webhook path and the admin `record_refund` path treat 23505 as already done.

**M7. No rate limiting.** Contact (each POST sends a Resend email from the same key as booking mail), newsletter (unverified third-party addresses), reviews, Meet-link creation, promo preview (code enumeration). *Fix:* `lib/security/rateLimit.ts`, a fixed-window limiter on a `rate_limit_hit` RPC (`0046 §9`, service role only, keys hashed). Limits: contact 3/10 min per IP, newsletter 5/h per IP, reviews 10/h per user, meet/create-link 5/min per user, promo preview 20/10 min per user. Fails open on any error so an outage cannot block the forms. `subscribe_newsletter` is revoked from client roles so the route is the only way in.

**M8. Fixed-amount promo codes with currency "Any".** INR 200 off (20000 minor units) became AED 200 off (40% instead of about 2%). *Fix (0047 §2):* CHECK constraints (`fixed` codes need a currency; value > 0; percentage <= 100); the admin form no longer offers "Any" for fixed codes.

**M9. Login page rendered attacker text in a trusted alert.** `/login?error=Your account is locked, call +91...` showed as an official banner. *Fix:* `?error=` carries a code; `lib/auth/loginErrors.ts` maps codes to fixed copy; the callback and native bridge send codes; the callback no longer forwards GoTrue's `error.message`.

**M10. Teachers could book sessions and free trials via the API.** The confirm route selected `role` but never used it; the Edge function had no check. *Fix:* both refuse `role = 'teacher'`.

### Low

**L1.** Hidden teachers' booking page reachable by slug from the dashboard: filtered on `is_public`.
**L2.** Public media buckets listable by anyone and accepting any mime type (SVG/HTML on the Supabase origin): admin-only listing; allow-list of image/video types including HEIC/HEIF (0046 §6).
**L3.** Admin credit grants wrote no audit row and could target staff accounts: `writeAuditLog` + customers only.
**L4.** An admin could verify their own bank transfer: refused (403).
**L5.** Raw Supabase/GoTrue text returned to the browser from the teacher-invite route, and Razorpay's error description from create-order: logged server-side, generic copy returned; teacher id validated as UUID.
**L6.** PostHog session replay was force-started after leaving a PHI page even when recording was off project-wide: resumes only if it was running.
**L7.** Exposed helper RPCs (`customer_booked_teacher` answered "has X booked teacher T" for anyone; `is_teacher`; the legacy `validate_discount_code` promo oracle): EXECUTE revoked from client roles (0046 §7).
**L8.** Contact-form name could contain CR/LF and went into the email subject: rejected by the schema.
**L9.** Revalidate route accepted any string as a slug: restricted to `[a-z0-9._-]`.
**L10.** Missing `Cross-Origin-Opener-Policy`: added `same-origin-allow-popups` (Razorpay runs in an iframe and Google sign-in is a redirect, so neither needs a cross-origin opener).

## 5. Not changed: owner decisions and dashboard settings

- **Cancellation window (product).** The Terms page promises a 24-hour cancellation rule that nothing enforces. Cancels are now refused once a class starts; whether a cancel inside 24h still refunds the credit is a product call. If wanted: in both cancel paths, skip `refund_session_credit` when `start_at < now() + 24h`.
- **Currency arbitrage (Medium, product).** Currency comes from GeoIP. An Indian buyer on a UAE VPN pays AED prices, about 35-40% cheaper at current `plan_prices`. Options: pin billing currency to the profile at first purchase, or to the verified phone country.
- **Throwaway accounts (Medium, product).** Free trials and `per_email_max` are per account; `+tag` emails and unverified phones defeat them. Options: normalise emails when snapshotting redemptions, gate the trial on a unique phone, rate-limit sign-ups.
- **Customers can still read teacher private fields (Low).** Column grants are per role; signed-in users keep `contact_email` and `google_calendar_id`. Full fix: move them to an admin-only `teacher_private` table.
- **Magic-link login CSRF (Low, Supabase dashboard).** A `/auth/callback?token_hash=...` link signs the visitor into whatever account the token belongs to, without a PKCE verifier. Switch the email template to `{{ .ConfirmationURL }}` (PKCE) or add a confirmation step.
- **Edge Function CORS (Low, Supabase env).** Defaults to `*` while `BOOKING_ALLOWED_ORIGIN` is unset. Bearer auth, so not exploitable as CSRF; set the variable anyway.
- **`RAZORPAY_WEBHOOK_SECRET` (Vercel env).** If unset, refunds do not claw back credits until an admin runs Resync, and `payment.dispute.*` (chargebacks) are ignored entirely.
- **Hard-coded admin bootstrap.** `handle_new_user` (0045) still auto-admins `poshithsreddy@gmail.com`; the same migration has a real customer's email in a comment. Remove once the admin exists.
- **Slot grid and horizon (Low).** Bookings may start at any minute inside a window and arbitrarily far ahead. Aligning them touches the shared availability code and the iOS parity test, so it is left for a focused change.
- **Push-token re-assignment (Low).** A token re-registered by another user moves to them. Accepted trade-off for shared devices.
- **Other dependency advisories.** `shadcn` (CLI, pulls proxy-addr/hono; build-time only, should move to devDependencies), `drizzle-orm` (identifier injection; no raw identifiers used), `axios` via razorpay/posthog-node (needs a prototype-pollution source; none found). Not runtime-reachable; update when convenient.

## 6. Verification performed

- `npm run typecheck`: clean. `npm test`: 315 passed, 1 skipped (the iOS parity test, by design). `npm run lint`: 0 errors, 6 pre-existing warnings in untouched lines.
- `npx next build` on the branch with Next 16.4.2: succeeds, 93 pages.
- **HTTP smoke test** of the built app (`next start`): security headers present; `/api/*` POST from `https://evil.com` and from a sibling subdomain 403; same-origin, no-Origin and `capacitor://localhost` reach the handler; GET unaffected; `/auth/callback?next=/%09/evil.com` and `?next=//evil.com` both redirect to `/dashboard`; a legitimate `?next=/dashboard/plan?x=1` round-trips.
- **Edge Functions** type-checked with Deno 2.2.7: `book-session` and `document-url` clean; `cancel-booking` and the untouched `delete-account` show the same pre-existing generic-type noise in a helper signature, unrelated to the edits.
- **Migrations** `0046` and `0047` applied twice each (idempotency) to an in-memory Postgres (PGlite 17) with stub tables, then behaviour-tested: rate limiter (3/window then refused, keys independent), teacher allow-list (profile copy editable, `is_public`/media/contact/`profile_id` pinned, service path unrestricted), medical path CHECK (valid path accepted, traversal and foreign folder rejected, owner cannot un-delete or move), dropped policies gone, anon column privileges (private columns denied, public columns readable), revoked RPCs unreachable from client roles, bucket mime list, promo resurrection under `per_email_max = 1` (one of two released rows commits), discount CHECKs, refund-once index (second refund row for a payment rejected; booking refunds with null `payment_id` unaffected). **Not run against the live database.**
- **Independent review** of the full diff by a reviewer with no prior sight of the work: no blockers; 3 should-fix items (bank-transfer unlinked-promo path, promo cap under auto-capture, refund early-return skipping promo release) and 7 nits, all fixed in the final commit. It also confirmed the audit table against the code, the ship order, the style constraints (no em-dashes or emojis in user-facing copy, error-copy boundary kept) and that `0046`/`0047` match the real schema.

## 7. Files changed

- **New:** `lib/security/sameOrigin.ts` (+test), `lib/security/rateLimit.ts`, `lib/auth/loginErrors.ts`, `supabase/migrations/0046_security_audit_hardening.sql`, `supabase/migrations/0047_promo_cap_and_discount_checks.sql`, this file.
- **Auth/redirects:** `lib/auth/redirects.ts` (+test), `app/(auth)/auth/callback/route.ts`, `components/shared/LoginForm.tsx`, `lib/native/capacitor.ts`, `middleware.ts`.
- **Bookings:** `app/api/bookings/cancel/route.ts`, `app/api/bookings/confirm/route.ts`, `app/(dashboard)/dashboard/book/[slug]/page.tsx`, `supabase/functions/cancel-booking/index.ts`, `supabase/functions/book-session/index.ts`.
- **Medical:** `lib/medical/constants.ts`, `app/api/medical-documents/route.ts`, `app/api/medical-documents/[id]/route.ts`, `app/api/medical-documents/[id]/download/route.ts`, `supabase/functions/document-url/index.ts`.
- **Payments:** `lib/razorpay/fulfillment.ts`, `app/api/razorpay/create-order/route.ts`, `app/api/razorpay/verify-payment/route.ts`, `app/api/razorpay/webhook/route.ts`, `app/api/payments/intent/route.ts`, `app/api/admin/payments/[id]/route.ts`, `app/api/admin/credits/route.ts`, `components/admin/DiscountsAdmin.tsx`.
- **Public data / forms:** `lib/data/landing.ts`, `app/api/contact/route.ts`, `app/api/newsletter/subscribe/route.ts`, `app/api/reviews/route.ts`, `app/api/meet/create-link/route.ts`, `app/api/promo/preview/route.ts`, `app/api/admin/revalidate/route.ts`, `app/api/admin/teachers/[id]/invite/route.ts`.
- **Config:** `next.config.ts` (COOP), `package.json`/`package-lock.json` (Next 16.4.2), `lib/supabase/types.ts` (two RPC types), `lib/analytics/events.ts`, `verify-launch.sql`.
