-- 0033_payments_razorpay_id_total_unique.sql
-- Fix: Razorpay payment captured but no credits granted ("Payment received but
-- not yet confirmed" screenshot).
--
-- Root cause: lib/razorpay/fulfillment.ts upserts into public.payments with
--   .upsert({ ... }, { onConflict: "razorpay_payment_id" })
-- which supabase-js/PostgREST compiles to:
--   INSERT ... ON CONFLICT (razorpay_payment_id) DO UPDATE ...   (no WHERE)
-- But the ONLY unique index backing that column (migration 0011) is PARTIAL:
--   ... on public.payments(razorpay_payment_id) where razorpay_payment_id is not null
-- PostgreSQL will not use a partial unique index as the ON CONFLICT arbiter
-- unless the statement repeats a matching WHERE index_predicate, so the INSERT
-- raises SQLSTATE 42P10 ("no unique or exclusion constraint matching the ON
-- CONFLICT specification"). Fulfilment maps that to reason "payment_record_failed",
-- which the verify route renders as the generic 400. Money captured, no credits.
--
-- This was masked before the capture-on-authorize fix (commit 484d893): payments
-- dead-ended earlier at not_paid:authorized and never reached the upsert.
--
-- Fix: replace the PARTIAL unique index with a TOTAL one on
-- public.payments(razorpay_payment_id). PostgreSQL treats NULLs as distinct in a
-- unique index (NULLS DISTINCT, the default), so the many legacy/PayPal/
-- bank-transfer rows with NULL razorpay_payment_id do NOT collide — the total
-- index is safe without touching existing data. A bare ON CONFLICT
-- (razorpay_payment_id) can now infer this index, so the existing supabase-js
-- upsert works unchanged (no app code change required).
--
-- Idempotent + safe to re-run. Apply to the live DB via psql / SQL editor
-- (see CLAUDE.md "Schema ownership" — writing the file is not enough):
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0033_payments_razorpay_id_total_unique.sql
-- Verify after (must show NO "WHERE" clause):
--   SELECT indexdef FROM pg_indexes WHERE indexname = 'payments_razorpay_payment_id_key';

-- Wrap drop+create in one transaction so there is never a window in which the
-- razorpay_payment_id uniqueness guarantee is absent (non-CONCURRENT index ops
-- are transactional; the table is tiny so the brief write lock is negligible).
begin;

-- Fail fast with a clear message if any duplicate non-null razorpay_payment_id
-- already exists — it would otherwise abort CREATE UNIQUE INDEX with a cryptic
-- 23505. Expected to be zero: the upsert has always 42P10'd, so no Razorpay-rail
-- row was ever written. If this raises, dedupe (keep the earliest paid_at) first.
do $$
declare
  dup_count int;
begin
  select count(*) into dup_count
  from (
    select razorpay_payment_id
    from public.payments
    where razorpay_payment_id is not null
    group by razorpay_payment_id
    having count(*) > 1
  ) d;
  if dup_count > 0 then
    raise exception
      'Cannot build a total unique index: % duplicate non-null razorpay_payment_id value(s) exist. Dedupe first.',
      dup_count;
  end if;
end $$;

-- Drop the partial index (it cannot serve as the ON CONFLICT arbiter without a
-- matching WHERE predicate, which PostgREST .upsert cannot emit).
drop index if exists public.payments_razorpay_payment_id_key;

-- Recreate it as a TOTAL unique index under the SAME name. NULLs stay distinct,
-- so historical rows with a NULL razorpay_payment_id are unaffected; non-null
-- Razorpay ids remain unique, which is the fulfilment idempotency key the upsert
-- needs.
create unique index if not exists payments_razorpay_payment_id_key
  on public.payments(razorpay_payment_id);

commit;
