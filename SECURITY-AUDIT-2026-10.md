# Security audit, October 2026

Branch: `security/audit-2026-10`. Scope: the whole repo (Next.js app, API routes, Supabase migrations and Edge Functions, dependencies). The live Supabase database and Vercel project were **not** reachable from the audit session, so database findings come from the migrations; the "After applying" queries in `0046`/`0047` check the live state.

## How to ship this (order matters)

1. Merge, then deploy from a clean checkout of `main` (`npx vercel@latest --prod`). This includes Next.js 16.2.6 → 16.4.2.
2. Redeploy the Edge Functions that changed: `cancel-booking`, `book-session`, `document-url`.
3. **Then** apply `supabase/migrations/0046_security_audit_hardening.sql` and `0047_promo_cap_and_discount_checks.sql`, and run their "After applying" queries.
4. Run `verify-launch.sql`.

Applying `0046` *before* step 1 makes the public teacher/review pages and newsletter signup fail until the code ships. The code works against both the old and new schema.

## Findings and fixes

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | Critical | Next.js 16.2.6 has published RCE (image optimizer with AVIF, `next/og`), SSRF and middleware-bypass advisories; the image optimizer is enabled | Upgraded to 16.4.2 |
| 2 | High | Any signed-in user could insert a review already `is_approved` + `is_featured`, with any text and name, onto the homepage (`reviews_self_insert`) | `0046` drops the self INSERT/UPDATE policies; reviews only via `/api/reviews` (unapproved) |
| 3 | High | Cancel had no time check: attend a class, then cancel for a refunded credit, or re-claim the free trial, forever | Cancel refused once the session has started (web route + `cancel-booking`) |
| 4 | High | Medical documents: RLS checked only a `{uid}/` prefix, so `{uid}/../{victim}/{file}` let a user (e.g. a revoked teacher) get a signed URL for, or delete, another patient's file | Path check at every sink (`isSafeMedicalPath`), traversal-proof RLS, CHECK constraint, owners can't move paths or un-delete (`0046`) |
| 5 | High | Open redirect after login: `?next=/%09/evil.com` (tab/newline stripped by the URL parser) | `safeNext` rejects control chars/backslashes and verifies same-origin by parsing; tests added |
| 6 | High | Promo `per_email_max` / `max_uses` bypass: open N discounted orders (each reserve releases the last), pay them all | `0047` re-checks caps before resurrecting a released redemption; authorized payments past the cap are not captured; captured ones are flagged in Sentry |
| 7 | Medium | Customer could "cancel" a booking while moving it onto any session, then read that session's Meet link (`bookings_self_update_cancel`) | Policy dropped (`0046`); `verify-launch.sql` now checks it stays gone |
| 8 | Medium | No CSRF defence beyond SameSite=Lax; `req.json()` accepts text/plain, and any subdomain is same-site (account delete, admin grants) | Middleware rejects state-changing `/api/*` requests whose Origin isn't ours (webhooks/cron send none and pass) |
| 9 | Medium | Teachers could un-hide themselves (`is_public`) and change photo/video/contact email | Teacher self-edit trigger is now an allow-list of the six profile-copy fields (`0046`) |
| 10 | Medium | Anon could read every teacher's `contact_email`, `google_calendar_id`, `profile_id`, hidden teachers included | Anon sees only public teachers and public columns; anon loses `reviews.customer_id`, slot-override reasons (`0046`) |
| 11 | Medium | Retired teachers kept downloading shared medical records | Download (web + `document-url`) requires an active teacher |
| 12 | Medium | Cancelled 1:1 sessions kept blocking the teacher's slot forever (book-trial/cancel loops could block a calendar) | Customer cancel frees an empty capacity-1 session |
| 13 | Medium | Two partial refunds summing to full each clawed back the whole grant | One clawback per payment |
| 14 | Medium | No rate limits on contact (Resend quota shared with booking mail), newsletter, reviews, Meet link, promo preview | Postgres-backed fixed-window limiter (`rate_limit_hit`, fail-open); newsletter RPC no longer callable directly |
| 15 | Medium | Fixed-amount promo with currency "Any" (INR 200 off became AED 200 off) | DB CHECK + admin form requires a currency |
| 16 | Low | `/login?error=` rendered attacker text in a trusted alert | Error codes mapped to fixed copy (`lib/auth/loginErrors.ts`) |
| 17 | Low | Teachers could book sessions/free trials via the API | Refused in confirm route and `book-session` |
| 18 | Low | Hidden teacher's booking page reachable by slug | Filtered on `is_public` |
| 19 | Low | Public media buckets listable by anyone; any mime type accepted | Admin-only listing; image/video allow-list (`0046`) |
| 20 | Low | Admin credit grants unaudited, grantable to staff; admin could verify their own transfer | Audit log + customers only; self-verify refused |
| 21 | Low | Raw Supabase/Razorpay error text returned (teacher invite, create-order) | Logged, generic message returned |
| 22 | Low | PostHog replay force-started after a PHI page even if disabled | Resumes only if it was running |
| 23 | Low | Exposed helper RPCs (`customer_booked_teacher`, `is_teacher`, `validate_discount_code`) | EXECUTE revoked from client roles |
| 24 | Low | Misc: CR/LF in contact name (email subject), duplicate-review race, revalidate slug unvalidated, promo link race, COOP header | Fixed |

## Not changed: owner decisions or dashboard settings

- **Cancellation policy.** The Terms page promises a 24-hour rule that nothing enforces. Cancels are now refused once a class starts; whether a cancel inside 24h still refunds a credit is a product call.
- **Currency arbitrage.** An Indian buyer on a UAE VPN gets AED prices, about 35-40% cheaper. Pinning billing currency to the profile or phone country is a product call.
- **Throwaway accounts.** Free trials and per-email promo caps are per account; `+tag` emails and unverified phones defeat them. Options: normalise emails, gate the trial on a unique phone.
- **Customers can still read teacher private fields.** Column grants are per role, so signed-in customers can still read `contact_email` / `google_calendar_id`. The full fix is moving them to an admin-only table.
- **Magic-link login CSRF.** A `token_hash` link can sign a victim into the attacker's account. Switch the Supabase email template to the PKCE `{{ .ConfirmationURL }}` flow.
- **Edge Function CORS** defaults to `*`. Set `BOOKING_ALLOWED_ORIGIN` in Supabase.
- **`RAZORPAY_WEBHOOK_SECRET`.** If unset, refunds don't claw back credits until an admin runs Resync; chargebacks (`payment.dispute.*`) are ignored.
- **Hard-coded admin bootstrap** (`poshithsreddy@gmail.com` in `handle_new_user`, plus a customer email in a `0045` comment). Remove once no longer needed.
- **Slot grid / horizon.** Bookings can start at any minute and arbitrarily far ahead. Aligning them to the grid touches the shared availability code and the iOS parity test, so it is left for a focused change.
- **Push-token re-assignment** to whoever registers last is an accepted trade-off for shared devices.
- **Other dependencies.** `npm audit` highs in `shadcn` (CLI, build-time only), `drizzle-orm` (no raw identifiers used) and `axios` (no pollution source) are not runtime-reachable; update when convenient.

## Verification

- `npm run typecheck` clean; `npm test` 315 passed, 1 skipped (the iOS parity test, by design); `npm run lint` 0 errors (6 pre-existing warnings).
- New tests: `lib/auth/redirects.test.ts` (open-redirect cases), `lib/security/sameOrigin.test.ts`.
- `0046` and `0047` were applied twice to an in-memory Postgres (PGlite) with stub tables and behaviour-tested: rate limiter, teacher allow-list, medical path constraint and lock trigger, anon column grants, revoked RPCs, promo resurrection under `per_email_max`, discount CHECKs. Not run against the live database.
