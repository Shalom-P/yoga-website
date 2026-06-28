# 🚀 Pre-Launch Punch List — My Yoga Classes

This is an operator-facing, verifiable go-live checklist. Work it **top to bottom**: run **Section A** (the database verifier) first to confirm every migration/RPC/policy is live; then **Section B** to confirm host environment variables; then **Section C** to exercise the external services (Razorpay, Google Meet, Resend, Supabase Auth) with real probes; then **Section D** for the code/UX gaps that need a fix or a product decision. Every item below has a concrete PASS/FAIL test — a command, query, or dashboard check — and the exact fix when it fails. **All Section A checks and the Section C SQL probes are read-only and safe to run against production.** Replace `<PROD_DOMAIN>` with the live host and have `$CRON_SECRET`, `$RAZORPAY_KEY_ID`, `$RAZORPAY_KEY_SECRET`, `$RAZORPAY_WEBHOOK_SECRET`, and `$SUPABASE_DB_URL` exported in your shell before running the curl/psql probes. Blocker items are prefixed 🚫 and **must** be green before launch; high items 🔴.

---

## ✅ Live verification — run 2026-06-28 (Sydney/`ap-southeast-2` pooler, read-only)

**Section A (Database): all 40 checks PASS.** Every migration object 0007→0029 is applied to the live DB — including the `user_role` `'teacher'` enum value, all booking/billing/multi-currency objects, all medical-doc tables + the private bucket, and the teacher-provisioning RPCs. **The original "teacher view missing" issue was NOT a migration gap — it is a data/linkage + routing matter (see below).**

**Live data probes surfaced three real gaps that schema checks can't catch:**

- [ ] 🔴 **The one active, public-facing teacher (`dr-vaishnavi-mayya`) has no login linkage** — `teachers.profile_id IS NULL`, so she appears on the site and takes bookings but **cannot log in to `/teacher`** to see her schedule/students/documents. The only teacher row *with* a login is one of the 6 **inactive** rows. _(Has a real photo ✅ and 40 availability rows ✅, so the customer-facing booking funnel is walkable.)_ **Fix:** invite/link her email via `/admin/teachers/[id] → Invite` (the live continuation of the bug you found by testing).
- [ ] 🔴 **Cron: only `myc-medical-orphan-sweep` is scheduled** (`SELECT * FROM cron.job` returns 1 row) — **`reminders`, `no-show-sweep`, and `meet-retry` are NOT running.** No reminder emails, no no-show flips, and failed Meet links are never auto-retried. **Fix:** apply `0015` (or your scheduler) with the real `base_url` + `CRON_SECRET` for all four jobs.
- [ ] 🔴 **Google Meet provisioning is unreliable** — `sessions.meet_status` is **5 `failed` / 2 `created`** (all in the past; 0 upcoming). The active teacher has **no `google_calendar_id`** set, a likely cause. Combined with no `meet-retry` cron, failed links never recover. **Fix:** set per-teacher `google_calendar_id`, confirm OIDC env, schedule `meet-retry`.

**Live data confirmed GREEN:** multi-currency prices seeded (pack-5 = AED 435 / ₹10,000, pack-10 = AED 825 / ₹19,000, both currencies present); ≥1 admin + ≥1 teacher role exist; active teacher has a real photo and 40 availability slots.

> Sections **B, C, D** are host/code-side (env vars, Razorpay/Resend dashboards, branch code) and **cannot** be verified from the DB — work them from the live host as written below.

---

## A. Database — run `verify-launch.sql`

The script `verify-launch.sql` (in the repo root) runs ~42 **read-only** existence probes against the production database and prints a single `PASS / FAIL` table, FAILs sorted to the top, then by severity. No probe can raise (it avoids `::regclass` casts that throw on missing relations, joining `pg_class`/`pg_namespace` by name instead). Run it and confirm **zero FAIL rows**:

```bash
psql "$SUPABASE_DB_URL" -f verify-launch.sql
```

- [ ] 🚫 **`verify-launch.sql` returns zero FAIL rows at BLOCKER severity** — if any BLOCKER row reads `FAIL`, do not launch; apply the migration named in that row's `fix_if_fail` column.
- [ ] 🔴 **Zero FAIL rows at HIGH severity** — fix before onboarding teachers / taking payments.
- [ ] **Zero FAIL rows at MEDIUM severity** — fix or consciously defer.

Every check the script covers, with how to remediate a FAIL:

| Check | Severity | If it FAILs (the fix) |
|---|---|---|
| `book_session` RPC `public.book_session(uuid,uuid,timestamptz,timestamptz,boolean)` (0017) | 🚫 blocker | `psql -f supabase/migrations/0017_booking_integrity.sql` |
| `credit_ledger` table (0011) | 🚫 blocker | `psql -f supabase/migrations/0011_razorpay_billing.sql` |
| `grant_session_credits` RPC (0011) | 🚫 blocker | `psql -f supabase/migrations/0011_razorpay_billing.sql` |
| `customer_credits` table (0011) | 🚫 blocker | `psql -f supabase/migrations/0011_razorpay_billing.sql` |
| `medical_document_access_log` table (0027) | 🚫 blocker | `psql -f supabase/migrations/0027_medical_documents.sql` |
| `medical_document_shares` table (0027) | 🚫 blocker | `psql -f supabase/migrations/0027_medical_documents.sql` |
| `medical_documents` table (0027) | 🚫 blocker | `psql -f supabase/migrations/0027_medical_documents.sql` |
| `medical-documents` PRIVATE storage bucket (`public=false`) (0027) | 🚫 blocker | `psql -f supabase/migrations/0027_medical_documents.sql` |
| `payments.amount_cents` column (renamed from `amount_aud_cents`) (0022) | 🚫 blocker | `psql -f supabase/migrations/0022_multi_currency.sql` |
| `payments.razorpay_payment_id` + UNIQUE idempotency index (0011) | 🚫 blocker | `psql -f supabase/migrations/0011_razorpay_billing.sql` |
| `plan_prices` multi-currency child table (0022) | 🚫 blocker | `psql -f supabase/migrations/0022_multi_currency.sql` |
| `plans.price_base_cents` column (renamed from `price_aud_cents`) (0022) | 🚫 blocker | `psql -f supabase/migrations/0022_multi_currency.sql` |
| `profiles_lock_sensitive` trigger fires on INSERT **and** UPDATE (0029) | 🚫 blocker | `psql -f supabase/migrations/0029_profiles_role_service_path_fix.sql` |
| `promote_to_teacher` RPC `(uuid,uuid,uuid)` (0025) | 🚫 blocker | `psql -f supabase/migrations/0025_teacher_provisioning.sql` |
| `share_medical_document` RPC (0027) | 🚫 blocker | `psql -f supabase/migrations/0027_medical_documents.sql` |
| `teacher_has_document_share` RPC (0027) | 🚫 blocker | `psql -f supabase/migrations/0027_medical_documents.sql` |
| `user_role` enum has `'teacher'` value — **absence KILLS teacher login** (0024_teacher_role) | 🚫 blocker | `psql -f supabase/migrations/0024_teacher_role.sql` |
| `demote_from_admin(uuid)` RPC (0010) | 🔴 high | `psql -f supabase/migrations/0010_admin_demote.sql` |
| RLS policy `bookings_self_update_cancel` WITH CHECK hardening (0018) | 🔴 high | `psql -f supabase/migrations/0018_rls_and_grants_hardening.sql` |
| `billing_interval` enum has `'one_time'` (0020) | 🔴 high | `psql -f supabase/migrations/0020_credit_packs.sql` |
| `customer_booked_teacher` RPC (0027) | 🔴 high | `psql -f supabase/migrations/0027_medical_documents.sql` |
| `demote_from_teacher(uuid)` RPC (0025/0026) | 🔴 high | `psql -f supabase/migrations/0025_teacher_provisioning.sql` |
| `discount_type` enum has `'fixed_amount_cents'` (0022) | 🔴 high | `psql -f supabase/migrations/0022_multi_currency.sql` |
| `owns_medical_document` RPC (0027) | 🔴 high | `psql -f supabase/migrations/0027_medical_documents.sql` |
| `pack-5` / `pack-10` seeded with `session_credits>0` (0020) | 🔴 high | `psql -f supabase/migrations/0020_credit_packs.sql` |
| Per-booking refund-once index `credit_ledger_booking_refund_once` (0021) | 🔴 high | `psql -f supabase/migrations/0021_refund_idempotency_and_blocklist.sql` |
| `clawback_session_credits` RPC + `credit_ledger.external_ref` (0019) | 🔴 high | `psql -f supabase/migrations/0019_refund_reconciliation.sql` |
| `refund_session_credit(uuid,uuid)` RPC (0021) | 🔴 high | `psql -f supabase/migrations/0021_refund_idempotency_and_blocklist.sql` |
| `revoke_medical_document_share` RPC (0027) | 🔴 high | `psql -f supabase/migrations/0027_medical_documents.sql` |
| `sessions_no_overlap` EXCLUDE constraint (0017) | 🔴 high | `psql -f supabase/migrations/0017_booking_integrity.sql` |
| `teachers_profile_id_uniq` partial unique index (0028) | 🔴 high | `psql -f supabase/migrations/0028_teacher_link_integrity.sql` |
| `teachers.profile_id` column (since 0002; used by 0025) | 🔴 high | `psql -f supabase/migrations/0002_teachers.sql` |
| Trigger `teachers_revoke_shares_on_unlink` on `public.teachers` (PHI) (0028) | 🔴 high | `psql -f supabase/migrations/0028_teacher_link_integrity.sql` |
| `admin_kpis()` rebuilt for per-currency revenue (0022) | medium | `psql -f supabase/migrations/0022_multi_currency.sql` |
| `bookings.reminded_at_24h` / `reminded_at_1h` columns (0016) | medium | `psql -f supabase/migrations/0016_booking_reminder_idempotency.sql` |
| `class_categories.helps_with` content column (0023) | medium | `psql -f supabase/migrations/0023_goal_based_categories.sql` |
| `class_categories.what_to_expect` content column (0023) | medium | `psql -f supabase/migrations/0023_goal_based_categories.sql` |
| `subscribe_newsletter(text,text)` RPC (0007) | medium | `psql -f supabase/migrations/0007_security_fixes.sql` |
| storage bucket `promotional-media` (0008) | medium | `psql -f supabase/migrations/0008_storage_buckets.sql` |
| storage bucket `teacher-media` (0008) | medium | `psql -f supabase/migrations/0008_storage_buckets.sql` |

> **Caveats baked into the script (carry these forward):**
> - **`0024` filename collision:** the migrations dir has two `0024_*` files (`0024_category_copy_positive.sql` and `0024_teacher_role.sql`). The teacher-`'teacher'`-enum FAIL must be fixed with **`0024_teacher_role.sql`** specifically — a naive "apply 0024" can run the wrong file.
> - **The pack-seed check is distinct from the enum check.** `billing_interval='one_time'` existing does **not** prove the packs were seeded. 0020 exists precisely because the packs once had `session_credits=0` (customers bought a pack and got nothing) — the `pack-5/pack-10 … session_credits>0` row is the launch-critical one.
> - **0019 vs 0021 refund RPCs are different objects:** 0019 = `clawback_session_credits` + `credit_ledger.external_ref` (dedup on external ref); 0021 = `refund_session_credit` + `credit_ledger_booking_refund_once` (per-booking). Both rows must pass.
> - **0028** dropped the old non-unique `teachers_profile_id_idx` and created `teachers_profile_id_uniq` — the script checks the **new** name.

---

## B. Host environment variables

For each, run the `vercel env ls production | grep …` check (and the deeper pull/curl where noted). `NEXT_PUBLIC_*` vars are **baked into the bundle at build time** — after changing one you must **redeploy**.

- [ ] 🚫 **`RAZORPAY_KEY_ID`**
- [ ] 🚫 **`RAZORPAY_KEY_SECRET`**
- [ ] 🚫 **`NEXT_PUBLIC_RAZORPAY_KEY_ID`**
- [ ] 🚫 **`RAZORPAY_WEBHOOK_SECRET`**
- [ ] 🚫 **`SUPABASE_SERVICE_ROLE_KEY`**
- [ ] 🚫 **`NEXT_PUBLIC_SUPABASE_URL`**
- [ ] 🚫 **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**
- [ ] 🔴 **`RESEND_API_KEY`**
- [ ] 🔴 **`RESEND_FROM_EMAIL`**
- [ ] 🔴 **`CRON_SECRET`**
- [ ] 🔴 **`GOOGLE_WORKLOAD_IDENTITY_PROVIDER`**
- [ ] 🔴 **`GOOGLE_IMPERSONATE_SERVICE_ACCOUNT`**
- [ ] 🔴 **`GOOGLE_IMPERSONATE_SUBJECT`**
- [ ] 🔴 **`SUPABASE_DB_URL`**
- [ ] **`NEXT_PUBLIC_ABN`** (medium — should be **absent**)
- [ ] **`NEXT_PUBLIC_WHATSAPP_NUMBER`** (low)
- [ ] **`NEXT_PUBLIC_POSTHOG_KEY`** (low)

| Variable | Severity | How to check | Pass criteria |
|---|---|---|---|
| `RAZORPAY_KEY_ID` | 🚫 blocker | `vercel env ls production \| grep RAZORPAY_KEY_ID` then `vercel env pull --environment=production .env.prod && grep '^RAZORPAY_KEY_ID=' .env.prod` | Present in Production, value begins `rp_live_`, and **equals** `NEXT_PUBLIC_RAZORPAY_KEY_ID`. |
| `RAZORPAY_KEY_SECRET` | 🚫 blocker | `vercel env ls production \| grep RAZORPAY_KEY_SECRET` (encrypted; confirm it's the live-mode secret in Razorpay → Settings → API Keys) | Present (encrypted), is the **live** secret paired with the live key id, and is **not** in any `NEXT_PUBLIC_*` var. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | 🚫 blocker | `vercel env ls production \| grep NEXT_PUBLIC_RAZORPAY_KEY_ID` (eyeball it equals `RAZORPAY_KEY_ID`) | Present, value `=== RAZORPAY_KEY_ID`, starts `rp_live_`, and the deployed bundle was **built after** it was set. |
| `RAZORPAY_WEBHOOK_SECRET` | 🚫 blocker | `vercel env ls production \| grep RAZORPAY_WEBHOOK_SECRET` + confirm a matching active webhook in Razorpay → Webhooks at `https://<PROD_DOMAIN>/api/razorpay/webhook` | Present, **distinct** from `RAZORPAY_KEY_SECRET`, matches the live webhook's signing secret, webhook active & pointed at prod. (Memory flags this as previously PENDING.) |
| `SUPABASE_SERVICE_ROLE_KEY` | 🚫 blocker | `vercel env ls production \| grep SUPABASE_SERVICE_ROLE_KEY` | Present (encrypted), is the `service_role` (not anon) key for the **prod** project, never in a `NEXT_PUBLIC_*` var. |
| `NEXT_PUBLIC_SUPABASE_URL` | 🚫 blocker | `vercel env ls production \| grep NEXT_PUBLIC_SUPABASE_URL` | Present, points at the prod project (`https://<ref>.supabase.co`) matching the keys' ref, build newer than the value. If unset, marketing silently renders **mock** data. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 🚫 blocker | `vercel env ls production \| grep NEXT_PUBLIC_SUPABASE_ANON_KEY` | Present, is the **anon** key matching the prod project ref, build newer than the value. |
| `RESEND_API_KEY` | 🔴 high | `vercel env ls production \| grep RESEND_API_KEY` | Present (encrypted), valid `re_` key, sending domain verified in Resend. Missing ⇒ transactional email becomes a silent no-op (does **not** affect auth OTP — that's Supabase SMTP). |
| `RESEND_FROM_EMAIL` | 🔴 high | `vercel env pull --environment=production .env.prod && grep '^RESEND_FROM_EMAIL=' .env.prod` | Either **unset** (uses verified `hello@myyogaclasses.fit` default) **or** an address on a Resend-**Verified** domain. Must contain **no `.com.au`** (memory: value is stale on `.com.au`). |
| `CRON_SECRET` | 🔴 high | `vercel env ls production \| grep CRON_SECRET` then `curl -i -X POST https://<PROD_DOMAIN>/api/cron/reminders -H "Authorization: Bearer $CRON_SECRET"` | Present, matches the scheduler's bearer; authed curl → **200**, unauthed → **401/503**. Missing ⇒ `assertCron` fails closed (503) and **all** cron jobs stop. |
| `GOOGLE_WORKLOAD_IDENTITY_PROVIDER` | 🔴 high | `vercel env ls production \| grep GOOGLE_WORKLOAD_IDENTITY_PROVIDER` + confirm Vercel OIDC is ON | Present, full `//iam.googleapis.com/projects/<NUMBER>/locations/global/workloadIdentityPools/<POOL>/providers/<PROVIDER>` using project **number**, OIDC enabled. |
| `GOOGLE_IMPERSONATE_SERVICE_ACCOUNT` | 🔴 high | `vercel env ls production \| grep GOOGLE_IMPERSONATE_SERVICE_ACCOUNT` | Present, correct `…@<project>.iam.gserviceaccount.com` SA with domain-wide delegation authorized in Workspace admin. |
| `GOOGLE_IMPERSONATE_SUBJECT` | 🔴 high | `vercel env ls production \| grep GOOGLE_IMPERSONATE_SUBJECT` | Present, a real Meet-capable Workspace mailbox in the SA's DWD scope; a test booking yields `meet_status='created'`. |
| `SUPABASE_DB_URL` | 🔴 high | `vercel env ls production \| grep SUPABASE_DB_URL` (confirm the `[ref]` is the prod project, password current) | Present (encrypted), connects to the prod DB via a serverless-suitable pooler. Watch for a stale **ap-southeast-2 (AU)** pooler host. |
| `NEXT_PUBLIC_ABN` | medium | `vercel env ls production \| grep NEXT_PUBLIC_ABN` (expect **no output**) | **Not present** (or empty). If set, the footer prints a stale Australian Business Number — a trust/compliance problem; remove it. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | low | `vercel env ls production \| grep NEXT_PUBLIC_WHATSAPP_NUMBER` | Either intentionally unset (button hidden) **or** digits-only international number for a monitored line. |
| `NEXT_PUBLIC_POSTHOG_KEY` | low | `vercel env ls production \| grep NEXT_PUBLIC_POSTHOG_KEY` | Either intentionally unset (analytics off, no errors) **or** a valid `phc_` key with reachable host, build newer than value. |

---

## C. External services (Razorpay / Google / Resend / Supabase Auth)

- [ ] 🚫 **Razorpay International (AED orders) is enabled on the account.** AED is not gated by any code/DB check — `app/api/razorpay/create-order/route.ts:104` sends the AED price straight to Razorpay; if International is off, the Orders API itself rejects it. Reproduce the exact pack-5 AED order (43500 fils = AED 435.00) with an INR control:
  ```bash
  curl -u "$RAZORPAY_KEY_ID:$RAZORPAY_KEY_SECRET" \
    -X POST https://api.razorpay.com/v1/orders \
    -H 'Content-Type: application/json' \
    -d '{"amount":43500,"currency":"AED","receipt":"intl-probe-aed","notes":{"probe":"international-check"}}'
  # INR control (known-good, settles natively):
  curl -u "$RAZORPAY_KEY_ID:$RAZORPAY_KEY_SECRET" \
    -X POST https://api.razorpay.com/v1/orders \
    -H 'Content-Type: application/json' \
    -d '{"amount":1000000,"currency":"INR","receipt":"intl-probe-inr"}'
  ```
  **PASS:** AED call → HTTP 200 with `"id":"order_…","currency":"AED","amount":43500`, INR control also 200. **FAIL:** AED → 400 (`international … not enabled` / `Currency AED is not enabled for the account`) while INR succeeds (isolates it to International being off; bad keys would 401 on **both**). **Fix:** Razorpay Dashboard → Settings → International → enable International + add AED; contact Razorpay support to activate if absent. No code change — until enabled, UAE customers cannot check out.

- [ ] 🚫 **Razorpay webhook is registered, points at `/api/razorpay/webhook`, and has the matching secret + events.** The route verifies `X-Razorpay-Signature = HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)` (route.ts:36,46) and acts on `payment.captured`, `order.paid`, `refund.created`, `payment.refunded`. Confirm via dashboard + live signed delivery:
  ```bash
  # Negative control — secret must be enforced (unsigned must be rejected):
  curl -i -X POST https://<PROD_DOMAIN>/api/razorpay/webhook \
    -H 'Content-Type: application/json' -d '{}'
  #  expect HTTP 400 {"error":"missing_signature"}  (500 webhook_not_configured = secret env MISSING)
  # Positive control — correctly signed body:
  BODY='{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_probe","order_id":"order_probe"}}}}'
  SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$RAZORPAY_WEBHOOK_SECRET" -hex | sed 's/^.* //')
  curl -i -X POST https://<PROD_DOMAIN>/api/razorpay/webhook \
    -H 'Content-Type: application/json' -H "X-Razorpay-Signature: $SIG" -d "$BODY"
  #  expect HTTP 200 (signature accepted; fulfilment no-ops on the fake ids)
  ```
  Also: Razorpay Dashboard → Account & Settings → Webhooks shows an **Active** webhook at exactly `https://<PROD_DOMAIN>/api/razorpay/webhook` subscribed to all four events; use "Send test webhook" for `payment.captured` and watch for 200.
  **PASS:** dashboard webhook active + 4 events; unsigned → 400 `missing_signature` (not 500); signed → 200 (not 400 `invalid_signature`). **FAIL:** 500 (secret missing) or 400 `invalid_signature` (dashboard secret ≠ env). **Fix:** create/repair the webhook, copy its secret into `RAZORPAY_WEBHOOK_SECRET`, redeploy; if signed probe 400s, re-copy the secret (env & dashboard out of sync) and redeploy.

- [ ] 🔴 **pg_cron jobs are scheduled in Postgres and `base_url` is not the placeholder.** `0015_cron_schedule.sql` schedules exactly 3 jobs (`myc-meet-retry` `*/15`, `myc-reminders` `*/15`, `myc-no-show-sweep` `0 * * * *`) and reads `cron_secret` from Vault. **`medical-orphan-sweep` is NOT in 0015** and must be scheduled separately.
  ```sql
  -- 1) scheduled jobs
  SELECT jobid, jobname, schedule, active, command FROM cron.job
  WHERE jobname LIKE 'myc-%' ORDER BY jobname;
  -- 2) placeholder substituted? (must return ZERO rows)
  SELECT jobname, command FROM cron.job WHERE command LIKE '%YOUR_DOMAIN%';
  -- 3) secret present in Vault
  SELECT name FROM vault.decrypted_secrets WHERE name = 'cron_secret';
  -- 4) jobs actually firing
  SELECT j.jobname, r.status, r.start_time, r.return_message
  FROM cron.job_run_details r JOIN cron.job j USING (jobid)
  WHERE j.jobname LIKE 'myc-%' ORDER BY r.start_time DESC LIMIT 15;
  ```
  **PASS:** Q1 → exactly 3 `active=true` rows with expected schedules; Q2 → **zero** rows; Q3 → one row; Q4 → recent `status='succeeded'` within ~15 min for the `*/15` jobs. **Fix:** if 0 rows, 0015 was never applied — replace `https://YOUR_DOMAIN` (line 21) with the real domain, `select vault.create_secret('<CRON_SECRET>','cron_secret')` once, then `psql "$SUPABASE_DB_URL" -f supabase/migrations/0015_cron_schedule.sql`; add a separate `cron.schedule` for `/api/cron/medical-orphan-sweep`. (Memory: 0015 was historically never applied in prod.)

- [ ] 🔴 **All 4 cron endpoints respond 200 with the `CRON_SECRET` bearer.**
  ```bash
  for ep in meet-retry reminders no-show-sweep medical-orphan-sweep; do
    echo "== $ep =="
    curl -s -o /dev/null -w '%{http_code}\n' -X POST \
      https://<PROD_DOMAIN>/api/cron/$ep -H "Authorization: Bearer $CRON_SECRET"
  done
  # negative control (no bearer) — must NOT be 200:
  curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<PROD_DOMAIN>/api/cron/reminders
  ```
  **PASS:** each of the 4 → 200 with `{"ok":true,…}` (`meet-retry`/`reminders`/`no-show-sweep` → `"processed":N`; `medical-orphan-sweep` → `"scanned":N,"removed":N`); no-bearer control → 401 (or 503 if `CRON_SECRET` unset). **FAIL/Fix:** 503 on the authed call ⇒ set `CRON_SECRET` on host + redeploy; 401 ⇒ your shell `$CRON_SECRET` differs from the host's.

- [ ] 🔴 **Google Meet OIDC link provisioning is healthy (`meet_status` distribution).** `meet_status ∈ {pending, created, failed}`. New sessions start `pending`; `provisionMeet` flips to `created` on success, `failed` on any auth/Calendar error.
  ```sql
  SELECT meet_status, count(*) FROM sessions GROUP BY 1 ORDER BY 1;
  -- recent/imminent only (what the cron retries):
  SELECT meet_status, count(*) FROM sessions
  WHERE start_at > now() - interval '2 days' GROUP BY 1 ORDER BY 1;
  ```
  **PASS:** recent rows predominantly `created`, only a small just-booked `pending` tail, few/no `failed`. **FAIL:** many `pending`+`failed` and ~zero `created` ⇒ the `getAccessToken` chain (Vercel OIDC → WIF STS → signJwt → jwt-bearer) or the Calendar insert is failing for every session. **Fix:** verify the three `GOOGLE_*` env vars, Vercel OIDC enabled, route on Node runtime; in Sentry isolate the leg (STS 4xx = WIF audience/issuer mismatch; signJwt 403 = missing `iam.serviceAccountTokenCreator`; jwt-bearer `invalid_grant` = DWD not authorized in Workspace), then re-run `/api/cron/meet-retry` to drain the backlog.

- [ ] **Resend sending domain is verified and emails send from the correct From** (medium). Resend → Domains: the sending domain (`myyogaclasses.fit`, **not** `.com.au`) must be **Verified** with green SPF/DKIM/DMARC. Cross-check `RESEND_FROM_EMAIL` is on that domain. Open a delivered email's raw source (Gmail → Show original) and confirm `From:` and `DKIM-Signature d=` are both `@<verified-domain>` with **DKIM=pass / SPF=pass / DMARC=pass**. **FAIL** if the domain is Pending or the From/DKIM domain is `.com.au` or unverified. **Fix:** add the DNS records Resend lists, wait for green, set `RESEND_FROM_EMAIL` to an address on the verified domain, redeploy.

- [ ] **Supabase auth OTP emails actually send (custom SMTP, not the throttled built-in sender)** (medium). Supabase → Authentication → Emails → SMTP Settings: **Enable Custom SMTP** ON, host `smtp.resend.com`, port 465/587, username `resend`, sender on the verified domain. Templates → **Magic Link** body must contain `{{ .Token }}` (the inline 6-digit OTP flow depends on it; without it Supabase sends a magic **link** instead of a code). Live test: from `/login` request an email OTP for a mailbox you control → 6-digit code arrives within ~30s **and** appears as Delivered in Resend logs (proves it routed via custom SMTP). Repeat without hitting `email rate limit exceeded`. **FAIL** if custom SMTP is off, the template lacks `{{ .Token }}`, or the OTP never arrives / isn't in Resend logs. **Fix:** enable custom SMTP with Resend creds (needs the Resend domain verified first), add `{{ .Token }}` to the template, re-test.

---

## D. Code / UX gaps (need a fix or a product decision before launch)

- [ ] 🔴 **Mobile sticky CTA only renders on the home page — absent on all other marketing routes.** `<StickyMobileCTA />` is rendered **only** at `app/(marketing)/page.tsx:68`; `app/(marketing)/layout.tsx:1-39` wraps every marketing page but does not include it. Re-confirm: `rg -n "StickyMobileCTA" "app/(marketing)"` (still present: **yes**). **Recommendation:** move `<StickyMobileCTA />` into `app/(marketing)/layout.tsx` so it renders on `/pricing`, `/teachers`, `/classes`, `/reviews`, `/faq`, `/about`, `/contact`, and legal. CLAUDE.md calls the mobile sticky CTA "non-negotiable (75% of traffic is mobile)" — conversion-critical.

- [ ] 🔴 **Legal pages (terms, privacy, refund) ship a visible "Pending legal review" DRAFT banner to production.** Each renders a bold "Pending legal review." notice: `app/(marketing)/legal/terms/page.tsx:22`, `…/privacy/page.tsx:20`, `…/refund/page.tsx:20` (with `DRAFT` comments on line 1). Re-confirm: `rg -ni "pending legal review" "app/(marketing)/legal"` (still present: **yes**). **Recommendation:** get counsel to review the copy, then remove the banner. A public legal page that openly states it's an unreviewed draft is a trust liability for a payments-handling site (CLAUDE.md/MEMORY both flag "real legal review" as pending).

- [ ] **No customer-facing review submission UI / API** (medium). `app/(dashboard)` has no review file (only `documents/page.tsx`, unrelated medical docs); `app/api` has no review-create route. `/reviews` invites submissions and `/admin/reviews` approves them, but there is **no insert path**. Re-confirm: `rg -lni "review" "app/(dashboard)" app/api` (still present: **yes**). **Recommendation:** product decision + build — add a dashboard review form plus an authenticated POST route / Server Action that inserts into `reviews` as `pending`, feeding the existing `/admin/reviews` queue. Until then the public "submit a review" invitation has no backend.

- [ ] **Discount codes are stored but never applied at checkout** (medium). `app/api/razorpay/create-order/route.ts` resolves price only from `plan_prices` and stamps order `notes` (line 109); `rg -ni "discount|coupon"` returns **zero** matches in both `create-order/route.ts` and `lib/razorpay/fulfillment.ts`. Re-confirm: `rg -ni "discount|coupon" app/api/razorpay/create-order/route.ts lib/razorpay/fulfillment.ts` (still present: **yes**). **Recommendation:** product/eng decision — either wire `discount_codes` into create-order (validate server-side, apply to `amount_cents` before creating the order, record the applied code) **or** remove the discount feature/UI. As-is, any promo code a customer enters has no effect on the charged amount.

---

## Go / No-Go

**Do NOT take real payments, onboard real teachers, or handle real PHI until every one of these is green:**

- [ ] 🚫 **Section A: zero BLOCKER FAILs** in `verify-launch.sql` — in particular `book_session`, the Razorpay billing objects (`credit_ledger`, `grant_session_credits`, `customer_credits`, `payments.amount_cents` / `razorpay_payment_id`), multi-currency (`plan_prices`, `plans.price_base_cents`), all four medical-document tables + the **PRIVATE** `medical-documents` bucket + its RPCs, the `profiles_lock_sensitive` INSERT/UPDATE trigger, `promote_to_teacher`, and the **`user_role` enum `'teacher'` value** (its absence kills teacher login).
- [ ] 🚫 **Section B: all blocker env vars present in Production** — both Razorpay live keys (server + `NEXT_PUBLIC`, matching, `rp_live_`), `RAZORPAY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and both `NEXT_PUBLIC_SUPABASE_*` (with the build made **after** the public vars were set).
- [ ] 🚫 **Section C: Razorpay International (AED) enabled** — UAE customers cannot pay otherwise — **and** the Razorpay **webhook** is active, correctly signed (signed probe → 200, unsigned → 400), and pointed at the prod URL (the authoritative fulfilment path when the browser never returns).
- [ ] 🔴 **Pre-payment integrity:** Section A HIGH FAILs cleared — refund idempotency (`refund_session_credit` + `credit_ledger_booking_refund_once`), clawback (`clawback_session_credits` + `external_ref`), `sessions_no_overlap`, and **`pack-5`/`pack-10` seeded with `session_credits>0`** (else customers pay and get nothing).
- [ ] 🔴 **Before onboarding teachers:** teacher-link integrity (`teachers_profile_id_uniq`, `teachers_revoke_shares_on_unlink` trigger) green, and the cron pipeline live (pg_cron 3 jobs firing, no `YOUR_DOMAIN` placeholder, all 4 endpoints → 200) so reminders / no-show / meet-retry / orphan-sweep actually run.
- [ ] 🔴 **Trust gate:** remove the "Pending legal review" banner on terms/privacy/refund (counsel-reviewed) and ship the mobile sticky CTA site-wide before driving paid traffic.

**Safe to defer past launch (track, don't block):** customer review-submission path, discount-code application, `admin_kpis` per-currency rollup, PostHog analytics, WhatsApp button — none block taking a payment or protecting PHI. **`NEXT_PUBLIC_ABN` must be confirmed absent** (medium) so the footer doesn't print a stale Australian registration.

---

Script written to `/Users/shalomp/YOGA_WEBSITE/verify-launch.sql` (read-only, prod-safe). One addition worth flagging: the service-role/anon Supabase keys are **host env**, not DB objects, so Section A carries only a pointer row for them — the real check lives in Section B.
